CREATE TABLE private.booking_page_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, page_id uuid NOT NULL, location_id uuid NOT NULL,
 title text NOT NULL, description text NOT NULL, staff_selection_enabled boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), row_version bigint NOT NULL DEFAULT 1,
 UNIQUE(page_id), UNIQUE(business_id,page_id,location_id),
 FOREIGN KEY(business_id,page_id) REFERENCES public.booking_pages(business_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(business_id,location_id) REFERENCES public.locations(business_id,id) ON DELETE RESTRICT
);
GRANT ALL ON private.booking_page_drafts TO service_role;
ALTER TABLE private.booking_page_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_only ON private.booking_page_drafts FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE TRIGGER booking_page_drafts_updated BEFORE UPDATE ON private.booking_page_drafts FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TABLE private.booking_page_draft_services (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, page_id uuid NOT NULL, location_id uuid NOT NULL, service_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), row_version bigint NOT NULL DEFAULT 1,
 UNIQUE(business_id,page_id,service_id),
 FOREIGN KEY(business_id,page_id,location_id) REFERENCES private.booking_page_drafts(business_id,page_id,location_id) ON DELETE RESTRICT,
 FOREIGN KEY(business_id,service_id,location_id) REFERENCES public.service_locations(business_id,service_id,location_id) ON DELETE RESTRICT
);
GRANT ALL ON private.booking_page_draft_services TO service_role;
ALTER TABLE private.booking_page_draft_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_only ON private.booking_page_draft_services FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE TRIGGER booking_page_draft_services_updated BEFORE UPDATE ON private.booking_page_draft_services FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TABLE private.booking_page_publication_states (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, page_id uuid NOT NULL, location_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), row_version bigint NOT NULL DEFAULT 1,
 UNIQUE(page_id), UNIQUE(business_id,page_id,location_id),
 FOREIGN KEY(business_id,page_id) REFERENCES public.booking_pages(business_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(business_id,location_id) REFERENCES public.locations(business_id,id) ON DELETE RESTRICT
);
GRANT ALL ON private.booking_page_publication_states TO service_role;
ALTER TABLE private.booking_page_publication_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_only ON private.booking_page_publication_states FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE TRIGGER booking_page_publication_states_updated BEFORE UPDATE ON private.booking_page_publication_states FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TABLE private.booking_page_live_services (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, page_id uuid NOT NULL, location_id uuid NOT NULL, service_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), row_version bigint NOT NULL DEFAULT 1,
 UNIQUE(business_id,page_id,service_id),
 FOREIGN KEY(business_id,page_id,location_id) REFERENCES private.booking_page_publication_states(business_id,page_id,location_id) ON DELETE RESTRICT,
 FOREIGN KEY(business_id,service_id,location_id) REFERENCES public.service_locations(business_id,service_id,location_id) ON DELETE RESTRICT
);
GRANT ALL ON private.booking_page_live_services TO service_role;
ALTER TABLE private.booking_page_live_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_only ON private.booking_page_live_services FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE TRIGGER booking_page_live_services_updated BEFORE UPDATE ON private.booking_page_live_services FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE FUNCTION private.booking_page_owner_target(p_business_id uuid,p_actor_user_id uuid) RETURNS public.booking_pages
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $fn$
DECLARE page public.booking_pages%ROWTYPE;
BEGIN
 IF private.actor_business_role(p_business_id,p_actor_user_id) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'active business owner required' USING ERRCODE='P0403'; END IF;
 IF (SELECT count(*) FROM public.booking_pages WHERE business_id=p_business_id)<>1 THEN RAISE EXCEPTION 'exactly one booking page is required for this business' USING ERRCODE='P0409'; END IF;
 SELECT * INTO page FROM public.booking_pages WHERE business_id=p_business_id;
 RETURN page;
END; $fn$;
CREATE FUNCTION private.booking_page_service_is_public(p_page_id uuid,p_service_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $fn$
 SELECT EXISTS(SELECT 1 FROM public.booking_pages bp
 JOIN public.service_locations sl ON sl.business_id=bp.business_id AND sl.location_id=bp.location_id AND sl.service_id=p_service_id AND sl.active
 JOIN public.services s ON s.business_id=sl.business_id AND s.id=sl.service_id AND s.active AND s.archived_at IS NULL
 WHERE bp.id=p_page_id AND (NOT EXISTS(SELECT 1 FROM private.booking_page_publication_states ps WHERE ps.page_id=bp.id AND ps.business_id=bp.business_id)
 OR EXISTS(SELECT 1 FROM private.booking_page_live_services ls WHERE ls.page_id=bp.id AND ls.business_id=bp.business_id AND ls.location_id=bp.location_id AND ls.service_id=p_service_id)));
$fn$;
CREATE FUNCTION private.validate_booking_page_services(p_business_id uuid,p_location_id uuid,p_service_ids uuid[]) RETURNS void
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $fn$
BEGIN
 IF p_service_ids IS NULL OR EXISTS(SELECT 1 FROM unnest(p_service_ids) x WHERE x IS NULL) THEN RAISE EXCEPTION 'service_ids must be a non-null list of service IDs' USING ERRCODE='P0422'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_service_ids) x WHERE NOT EXISTS(SELECT 1 FROM public.services s JOIN public.service_locations sl ON sl.business_id=s.business_id AND sl.service_id=s.id WHERE s.business_id=p_business_id AND s.id=x AND s.active AND s.archived_at IS NULL AND sl.location_id=p_location_id AND sl.active)) THEN RAISE EXCEPTION 'services must be active and assigned to the booking page location' USING ERRCODE='P0422'; END IF;
END; $fn$;
CREATE FUNCTION private.booking_page_draft_response(p_page_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $fn$
 WITH live AS (
 SELECT bp.*, CASE WHEN EXISTS(SELECT 1 FROM private.booking_page_publication_states ps WHERE ps.page_id=bp.id AND ps.business_id=bp.business_id)
 THEN coalesce((SELECT jsonb_agg(ls.service_id ORDER BY ls.service_id) FROM private.booking_page_live_services ls WHERE ls.page_id=bp.id AND ls.business_id=bp.business_id AND ls.location_id=bp.location_id),'[]'::jsonb)
 ELSE coalesce((SELECT jsonb_agg(sl.service_id ORDER BY sl.service_id) FROM public.service_locations sl JOIN public.services s ON s.id=sl.service_id AND s.business_id=sl.business_id WHERE sl.business_id=bp.business_id AND sl.location_id=bp.location_id AND sl.active AND s.active AND s.archived_at IS NULL),'[]'::jsonb) END live_ids
 FROM public.booking_pages bp WHERE bp.id=p_page_id)
 SELECT jsonb_build_object('booking_page_id',bp.id,'location_id',bp.location_id,'slug',bp.slug,
 'title',coalesce(d.title,bp.title),'description',coalesce(d.description,bp.description),'staff_selection_enabled',coalesce(d.staff_selection_enabled,bp.staff_selection_enabled),
 'service_ids',CASE WHEN d.id IS NULL THEN bp.live_ids ELSE coalesce((SELECT jsonb_agg(ds.service_id ORDER BY ds.service_id) FROM private.booking_page_draft_services ds WHERE ds.page_id=bp.id AND ds.business_id=bp.business_id),'[]'::jsonb) END,
 'live_service_ids',bp.live_ids,'row_version',bp.row_version,'published',bp.status='published')
 FROM live bp LEFT JOIN private.booking_page_drafts d ON d.page_id=bp.id AND d.business_id=bp.business_id AND d.location_id=bp.location_id;
$fn$;
CREATE FUNCTION public.get_booking_page_draft(p_business_id uuid,p_actor_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $fn$
DECLARE page public.booking_pages%ROWTYPE;
BEGIN
 page:=private.booking_page_owner_target(p_business_id,p_actor_user_id);
 RETURN private.booking_page_draft_response(page.id);
END; $fn$;
CREATE FUNCTION public.save_booking_page_draft(p_business_id uuid,p_actor_user_id uuid,p_expected_row_version bigint,p_title text,p_description text,p_staff_selection_enabled boolean,p_service_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE page public.booking_pages%ROWTYPE;
BEGIN
 page:=private.booking_page_owner_target(p_business_id,p_actor_user_id);
 SELECT * INTO page FROM public.booking_pages WHERE business_id=p_business_id AND id=page.id FOR UPDATE;
 IF p_expected_row_version IS NULL OR page.row_version<>p_expected_row_version THEN RAISE EXCEPTION 'booking page changed; refresh and retry' USING ERRCODE='P0409'; END IF;
 IF p_title IS NULL OR btrim(p_title)='' OR length(p_title)>200 OR p_description IS NULL OR length(p_description)>10000 OR p_staff_selection_enabled IS NULL THEN RAISE EXCEPTION 'valid title, description and staff-selection boolean required' USING ERRCODE='P0422'; END IF;
 IF EXISTS(SELECT 1 FROM private.booking_page_drafts WHERE page_id=page.id AND location_id<>page.location_id) THEN RAISE EXCEPTION 'booking page location changed; draft requires review' USING ERRCODE='P0409'; END IF;
 PERFORM private.validate_booking_page_services(p_business_id,page.location_id,p_service_ids);
 INSERT INTO private.booking_page_drafts(business_id,page_id,location_id,title,description,staff_selection_enabled)
 VALUES(p_business_id,page.id,page.location_id,p_title,p_description,p_staff_selection_enabled)
 ON CONFLICT(page_id) DO UPDATE SET title=excluded.title,description=excluded.description,staff_selection_enabled=excluded.staff_selection_enabled;
 DELETE FROM private.booking_page_draft_services WHERE business_id=p_business_id AND page_id=page.id;
 INSERT INTO private.booking_page_draft_services(business_id,page_id,location_id,service_id)
 SELECT p_business_id,page.id,page.location_id,x FROM (SELECT DISTINCT unnest(p_service_ids) x) q;
 UPDATE public.booking_pages SET updated_at=now() WHERE business_id=p_business_id AND id=page.id;
 INSERT INTO private.audit_logs(business_id,actor_user_id,actor_type,action,entity_type,entity_id,changes)
 VALUES(p_business_id,p_actor_user_id,'user','booking_page.draft_saved','booking_page',page.id,jsonb_build_object('service_ids',p_service_ids,'staff_selection_enabled',p_staff_selection_enabled));
 RETURN private.booking_page_draft_response(page.id);
END; $fn$;
CREATE FUNCTION public.set_booking_page_publication(p_business_id uuid,p_actor_user_id uuid,p_expected_row_version bigint,p_published boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE page public.booking_pages%ROWTYPE; config jsonb; ids uuid[];
BEGIN
 page:=private.booking_page_owner_target(p_business_id,p_actor_user_id);
 SELECT * INTO page FROM public.booking_pages WHERE business_id=p_business_id AND id=page.id FOR UPDATE;
 IF p_expected_row_version IS NULL OR page.row_version<>p_expected_row_version THEN RAISE EXCEPTION 'booking page changed; refresh and retry' USING ERRCODE='P0409'; END IF;
 IF p_published IS NULL THEN RAISE EXCEPTION 'published boolean required' USING ERRCODE='P0422'; END IF;
 IF EXISTS(SELECT 1 FROM private.booking_page_drafts WHERE page_id=page.id AND location_id<>page.location_id) OR EXISTS(SELECT 1 FROM private.booking_page_publication_states WHERE page_id=page.id AND location_id<>page.location_id) THEN RAISE EXCEPTION 'booking page location changed; publication requires review' USING ERRCODE='P0409'; END IF;
 IF p_published THEN
  config:=private.booking_page_draft_response(page.id);
  SELECT coalesce(array_agg(value::uuid),ARRAY[]::uuid[]) INTO ids FROM jsonb_array_elements_text(config->'service_ids');
  PERFORM private.validate_booking_page_services(p_business_id,page.location_id,ids);
  IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=p_business_id AND status='active') OR NOT EXISTS(SELECT 1 FROM public.locations WHERE id=page.location_id AND business_id=p_business_id AND active) THEN RAISE EXCEPTION 'active business and location required for publishing' USING ERRCODE='P0409'; END IF;
  INSERT INTO private.booking_page_publication_states(business_id,page_id,location_id) VALUES(p_business_id,page.id,page.location_id) ON CONFLICT(page_id) DO NOTHING;
  DELETE FROM private.booking_page_live_services WHERE business_id=p_business_id AND page_id=page.id;
  INSERT INTO private.booking_page_live_services(business_id,page_id,location_id,service_id) SELECT p_business_id,page.id,page.location_id,x FROM unnest(ids) x;
  UPDATE public.booking_pages SET title=config->>'title',description=config->>'description',staff_selection_enabled=(config->>'staff_selection_enabled')::boolean,status='published',published_at=now() WHERE business_id=p_business_id AND id=page.id;
 ELSE
  UPDATE public.booking_pages SET status='draft',published_at=NULL WHERE business_id=p_business_id AND id=page.id;
 END IF;
 INSERT INTO private.audit_logs(business_id,actor_user_id,actor_type,action,entity_type,entity_id,changes)
 VALUES(p_business_id,p_actor_user_id,'user',CASE WHEN p_published THEN 'booking_page.published' ELSE 'booking_page.unpublished' END,'booking_page',page.id,jsonb_build_object('published',p_published));
 RETURN private.booking_page_draft_response(page.id);
END; $fn$;

DO $cores$
DECLARE src text; patched text; signature regprocedure; acl aclitem[]; definer boolean; settings text[];
BEGIN
 signature:='public.get_availability(uuid,uuid,date,date,uuid,jsonb,integer)'::regprocedure;
 SELECT proacl,prosecdef,proconfig INTO acl,definer,settings FROM pg_proc WHERE oid=signature;
 src:=pg_get_functiondef(signature);
 patched:=replace(src,'public.get_availability(', 'private.booking_availability_core(');
 patched:=replace(patched,'p_seat_count integer)', 'p_seat_count integer, p_public boolean)');
 patched:=replace(patched,'id = p_booking_page_id AND status = ''published''','id = p_booking_page_id AND (NOT p_public OR status = ''published'')');
 patched:=replace(patched,'IF NOT FOUND THEN RAISE EXCEPTION ''service not found or not active'' USING ERRCODE = ''P0404''; END IF;', 'IF NOT FOUND THEN RAISE EXCEPTION ''service not found or not active'' USING ERRCODE = ''P0404''; END IF;
  IF p_public AND NOT private.booking_page_service_is_public(v_page.id,p_service_id) THEN RAISE EXCEPTION ''service is not public on this booking page'' USING ERRCODE=''P0404''; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.service_locations sl WHERE sl.business_id=v_page.business_id AND sl.service_id=p_service_id AND sl.location_id=v_page.location_id AND sl.active) THEN RAISE EXCEPTION ''service is not assigned to this location'' USING ERRCODE=''P0404''; END IF;');
 patched:=replace(patched,'AND (p_staff_id IS NULL OR sp.id = p_staff_id)','AND (p_staff_id IS NULL OR (p_public AND NOT v_page.staff_selection_enabled) OR sp.id = p_staff_id)');
 IF position('p_public boolean' IN patched)=0 OR position('service is not public on this booking page' IN patched)=0 OR position('NOT v_page.staff_selection_enabled' IN patched)=0 THEN RAISE EXCEPTION 'availability source mismatch'; END IF;
 EXECUTE patched;
 EXECUTE 'CREATE OR REPLACE FUNCTION public.get_availability(p_booking_page_id uuid,p_service_id uuid,p_from_date date,p_through_date date,p_staff_id uuid,p_addon_quantities jsonb,p_seat_count integer) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''public'',''extensions'' AS $wrap$ SELECT private.booking_availability_core(p_booking_page_id,p_service_id,p_from_date,p_through_date,p_staff_id,p_addon_quantities,p_seat_count,true); $wrap$';
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=signature AND (proacl IS DISTINCT FROM acl OR prosecdef IS DISTINCT FROM definer OR proconfig IS DISTINCT FROM settings)) THEN RAISE EXCEPTION 'availability security/grants changed'; END IF;
 signature:='public.create_booking_hold(text,uuid,uuid,uuid,uuid,timestamptz,jsonb,integer,uuid)'::regprocedure;
 SELECT proacl,prosecdef,proconfig INTO acl,definer,settings FROM pg_proc WHERE oid=signature;
 src:=pg_get_functiondef(signature);
 patched:=replace(src,'public.create_booking_hold(', 'private.booking_hold_core(');
 patched:=replace(patched,'p_request_key uuid)', 'p_request_key uuid, p_public boolean)');
 patched:=replace(patched,'id = p_booking_page_id AND status = ''published''','id = p_booking_page_id AND (NOT p_public OR status = ''published'') FOR SHARE');
 patched:=replace(patched,'IF NOT FOUND THEN RAISE EXCEPTION ''service not found or not active'' USING ERRCODE = ''P0404''; END IF;', 'IF NOT FOUND THEN RAISE EXCEPTION ''service not found or not active'' USING ERRCODE = ''P0404''; END IF;
  IF p_public AND NOT private.booking_page_service_is_public(v_page.id,p_service_id) THEN RAISE EXCEPTION ''service is not public on this booking page'' USING ERRCODE=''P0409''; END IF;');
 patched:=replace(patched,'public.get_availability(', 'private.booking_availability_core(');
 patched:=replace(patched,'p_staff_id, p_addon_quantities, v_seats','p_staff_id, p_addon_quantities, v_seats, p_public');
 IF position('p_public boolean' IN patched)=0 OR position('service is not public on this booking page' IN patched)=0 OR position('FOR SHARE' IN patched)=0 OR position('v_seats, p_public' IN patched)=0 OR position('public.get_availability(' IN patched)>0 THEN RAISE EXCEPTION 'hold source mismatch'; END IF;
 EXECUTE patched;
 EXECUTE 'CREATE OR REPLACE FUNCTION public.create_booking_hold(p_subject_hash text,p_booking_page_id uuid,p_service_id uuid,p_staff_id uuid,p_session_id uuid,p_starts_at timestamptz,p_addon_quantities jsonb,p_seat_count integer,p_request_key uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''public'',''extensions'' AS $wrap$ SELECT private.booking_hold_core(p_subject_hash,p_booking_page_id,p_service_id,p_staff_id,p_session_id,p_starts_at,p_addon_quantities,p_seat_count,p_request_key,true); $wrap$';
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=signature AND (proacl IS DISTINCT FROM acl OR prosecdef IS DISTINCT FROM definer OR proconfig IS DISTINCT FROM settings)) THEN RAISE EXCEPTION 'hold security/grants changed'; END IF;
 signature:='public.get_public_booking_page(text)'::regprocedure;
 SELECT proacl,prosecdef,proconfig INTO acl,definer,settings FROM pg_proc WHERE oid=signature;
 src:=pg_get_functiondef(signature);
 patched:=replace(src,'WHERE s.business_id = bp.business_id AND s.active AND s.archived_at IS NULL','WHERE s.business_id = bp.business_id AND s.active AND s.archived_at IS NULL AND private.booking_page_service_is_public(bp.id,s.id)');
 IF patched=src THEN RAISE EXCEPTION 'public page source mismatch'; END IF;
 EXECUTE patched;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=signature AND (proacl IS DISTINCT FROM acl OR prosecdef IS DISTINCT FROM definer OR proconfig IS DISTINCT FROM settings)) THEN RAISE EXCEPTION 'projection security/grants changed'; END IF;
END; $cores$;
CREATE FUNCTION public.get_dashboard_booking_availability(p_booking_page_id uuid,p_service_id uuid,p_from_date date,p_through_date date,p_staff_id uuid,p_addon_quantities jsonb,p_seat_count integer,p_actor_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE page public.booking_pages%ROWTYPE;
BEGIN
 SELECT * INTO page FROM public.booking_pages WHERE id=p_booking_page_id;
 IF NOT FOUND OR NOT private.actor_business_permission(page.business_id,p_actor_user_id,'can_manage_customers') OR NOT private.actor_has_location_access(page.business_id,page.location_id,p_actor_user_id) THEN RAISE EXCEPTION 'not authorized to create dashboard bookings' USING ERRCODE='P0403'; END IF;
 RETURN private.booking_availability_core(p_booking_page_id,p_service_id,p_from_date,p_through_date,p_staff_id,p_addon_quantities,p_seat_count,false);
END; $fn$;
CREATE FUNCTION public.create_dashboard_booking_hold(p_subject_hash text,p_booking_page_id uuid,p_service_id uuid,p_staff_id uuid,p_session_id uuid,p_starts_at timestamptz,p_addon_quantities jsonb,p_seat_count integer,p_request_key uuid,p_actor_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE page public.booking_pages%ROWTYPE;
BEGIN
 SELECT * INTO page FROM public.booking_pages WHERE id=p_booking_page_id;
 IF NOT FOUND OR NOT private.actor_business_permission(page.business_id,p_actor_user_id,'can_manage_customers') OR NOT private.actor_has_location_access(page.business_id,page.location_id,p_actor_user_id) THEN RAISE EXCEPTION 'not authorized to create dashboard bookings' USING ERRCODE='P0403'; END IF;
 RETURN private.booking_hold_core(p_subject_hash,p_booking_page_id,p_service_id,p_staff_id,p_session_id,p_starts_at,p_addon_quantities,p_seat_count,p_request_key,false);
END; $fn$;
DO $grants$
DECLARE fn record;
BEGIN
 FOR fn IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE
 (n.nspname='public' AND p.proname IN ('get_booking_page_draft','save_booking_page_draft','set_booking_page_publication','get_dashboard_booking_availability','create_dashboard_booking_hold')) OR
 (n.nspname='private' AND p.proname IN ('booking_page_owner_target','booking_page_service_is_public','validate_booking_page_services','booking_page_draft_response','booking_availability_core','booking_hold_core')) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',fn.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',fn.signature);
 END LOOP;
END; $grants$;