CREATE OR REPLACE FUNCTION private.actor_is_org_admin_for_business(p_business_id uuid,p_actor_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT p_actor_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.businesses b JOIN public.organization_members om ON om.organization_id=b.organization_id WHERE b.id=p_business_id AND om.user_id=p_actor_user_id AND om.active=true AND om.role IN ('owner','admin'));
$$;
CREATE OR REPLACE FUNCTION private.actor_business_role(p_business_id uuid,p_actor_user_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT bm.role FROM public.business_members bm WHERE p_actor_user_id IS NOT NULL AND bm.business_id=p_business_id AND bm.user_id=p_actor_user_id AND bm.active=true;
$$;
CREATE OR REPLACE FUNCTION private.actor_has_business_access(p_business_id uuid,p_actor_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT p_actor_user_id IS NOT NULL AND (private.actor_is_org_admin_for_business(p_business_id,p_actor_user_id) OR EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id=p_business_id AND bm.user_id=p_actor_user_id AND bm.active=true));
$$;
CREATE OR REPLACE FUNCTION private.actor_business_permission(p_business_id uuid,p_actor_user_id uuid,p_permission text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE m public.business_members%ROWTYPE;
BEGIN
 IF p_actor_user_id IS NULL OR p_permission IS NULL OR p_permission NOT IN ('can_manage_customers','can_manage_services','can_manage_staff','can_manage_forms','can_manage_messages','can_manage_automations','can_view_analytics','can_manage_billing') THEN RETURN false; END IF;
 IF private.actor_is_org_admin_for_business(p_business_id,p_actor_user_id) THEN RETURN true; END IF;
 SELECT * INTO m FROM public.business_members bm WHERE bm.business_id=p_business_id AND bm.user_id=p_actor_user_id AND bm.active=true;
 IF NOT FOUND THEN RETURN false; END IF;
 IF m.role='owner' THEN RETURN true; END IF;
 IF m.role<>'manager' THEN RETURN false; END IF;
 RETURN COALESCE(CASE p_permission WHEN 'can_manage_customers' THEN m.can_manage_customers WHEN 'can_manage_services' THEN m.can_manage_services WHEN 'can_manage_staff' THEN m.can_manage_staff WHEN 'can_manage_forms' THEN m.can_manage_forms WHEN 'can_manage_messages' THEN m.can_manage_messages WHEN 'can_manage_automations' THEN m.can_manage_automations WHEN 'can_view_analytics' THEN m.can_view_analytics WHEN 'can_manage_billing' THEN m.can_manage_billing ELSE false END,false);
END;
$$;
CREATE OR REPLACE FUNCTION private.actor_has_location_access(p_business_id uuid,p_location_id uuid,p_actor_user_id uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE m public.business_members%ROWTYPE;
BEGIN
 IF p_actor_user_id IS NULL THEN RETURN false; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.locations l WHERE l.id=p_location_id AND l.business_id=p_business_id) THEN RETURN false; END IF;
 IF private.actor_is_org_admin_for_business(p_business_id,p_actor_user_id) THEN RETURN true; END IF;
 SELECT * INTO m FROM public.business_members bm WHERE bm.business_id=p_business_id AND bm.user_id=p_actor_user_id AND bm.active=true;
 IF NOT FOUND THEN RETURN false; END IF;
 IF m.role='owner' OR (m.role='manager' AND m.all_locations) THEN RETURN true; END IF;
 RETURN EXISTS (SELECT 1 FROM public.member_locations ml WHERE ml.business_id=p_business_id AND ml.business_member_id=m.id AND ml.location_id=p_location_id);
END;
$$;
REVOKE ALL ON FUNCTION private.actor_is_org_admin_for_business(uuid,uuid),private.actor_business_role(uuid,uuid),private.actor_has_business_access(uuid,uuid),private.actor_business_permission(uuid,uuid,text),private.actor_has_location_access(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.actor_is_org_admin_for_business(uuid,uuid),private.actor_business_role(uuid,uuid),private.actor_has_business_access(uuid,uuid),private.actor_business_permission(uuid,uuid,text),private.actor_has_location_access(uuid,uuid,uuid) TO service_role;
DO $repair$
DECLARE f record; old_def text; new_def text; changed integer:=0;
BEGIN
 FOR f IN SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid) args FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('create_blocked_time','release_blocked_time','merge_customers','create_invoice','record_manual_payment','get_business_analytics','confirm_booking','reschedule_appointment','cancel_appointment') LOOP
  old_def:=pg_get_functiondef(f.oid); new_def:=old_def;
  new_def:=regexp_replace(new_def,'private\.business_permission\(([^,()]+),','private.actor_business_permission(\1, p_actor_user_id,','g');
  new_def:=regexp_replace(new_def,'private\.has_business_access\(([^,()]+)\)','private.actor_has_business_access(\1, p_actor_user_id)','g');
  new_def:=regexp_replace(new_def,'private\.has_location_access\(([^,()]+), ([^,()]+)\)','private.actor_has_location_access(\1, \2, p_actor_user_id)','g');
  new_def:=regexp_replace(new_def,'private\.business_member_role\(([^,()]+)\)','private.actor_business_role(\1, p_actor_user_id)','g');
  new_def:=regexp_replace(new_def,'private\.is_org_admin_for_business\(([^,()]+)\)','private.actor_is_org_admin_for_business(\1, p_actor_user_id)','g');
  IF f.proname='create_blocked_time' THEN
   new_def:=replace(new_def,'private.actor_business_role(p_business_id, p_actor_user_id) = ''manager''','COALESCE(private.actor_business_role(p_business_id, p_actor_user_id) = ''manager'', false)');
  END IF;
  IF f.proname='release_blocked_time' THEN
   new_def:=replace(new_def,'private.actor_business_role(v_block.business_id, p_actor_user_id) IN (''owner'',''manager'')','COALESCE(private.actor_business_role(v_block.business_id, p_actor_user_id) IN (''owner'',''manager''), false)');
   new_def:=replace(new_def,'  UPDATE blocked_times SET released_at = now()', E'  IF v_block.location_id IS NOT NULL AND NOT private.actor_has_location_access(v_block.business_id, v_block.location_id, p_actor_user_id) THEN\n    RAISE EXCEPTION ''no access to this location'' USING ERRCODE = ''P0403'';\n  END IF;\n\n  UPDATE blocked_times SET released_at = now()');
  END IF;
  IF old_def=new_def THEN RAISE EXCEPTION 'No authorization replacement for %',f.proname; END IF;
  IF new_def ~ 'auth.uid\(|private\.(business_member_role|business_permission|has_business_access|has_location_access|is_org_admin_for_business)\(' THEN RAISE EXCEPTION 'Unrepaired caller authorization in %',f.proname; END IF;
  EXECUTE new_def;
  EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',f.proname,f.args);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',f.proname,f.args);
  changed:=changed+1;
 END LOOP;
 IF changed<>9 THEN RAISE EXCEPTION 'Expected 9 changed functions, got %',changed; END IF;
 IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND pg_get_function_arguments(p.oid) LIKE '%p_actor_user_id%' AND p.prosrc ~ 'auth.uid\(|private\.(business_member_role|business_permission|has_business_access|has_location_access|is_org_admin_for_business)\(') THEN RAISE EXCEPTION 'Another explicit-actor RPC depends on request auth.uid'; END IF;
END;
$repair$;