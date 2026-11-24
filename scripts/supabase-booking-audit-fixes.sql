-- Apply atomically through the Supabase connector.
CREATE FUNCTION private.guard_required_intake_form()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE linked_services text;
BEGIN
  IF NEW.status='published' AND NEW.active_version_id IS NOT NULL
    AND EXISTS(SELECT FROM public.form_versions v WHERE v.business_id=NEW.business_id
      AND v.form_id=NEW.id AND v.id=NEW.active_version_id AND v.published_at IS NOT NULL)
    AND NOT EXISTS(SELECT FROM public.form_fields f WHERE f.business_id=NEW.business_id
      AND f.form_version_id=NEW.active_version_id AND f.field_type='file')
  THEN RETURN NEW; END IF;
  SELECT string_agg(s.name, ', ' ORDER BY s.name) INTO linked_services
    FROM private.service_intake_settings i JOIN public.services s ON s.business_id=i.business_id AND s.id=i.service_id
    WHERE i.business_id=OLD.business_id AND i.form_id=OLD.id AND i.timing='required_before';
  IF linked_services IS NOT NULL THEN
    RAISE EXCEPTION 'Replace or remove this required intake form from Forms → Service intake first: %',left(linked_services,300)
      USING ERRCODE='P0409';
  END IF;
  RETURN NEW;
END;
$fn$;
CREATE TRIGGER guard_required_intake_form BEFORE UPDATE OF status,active_version_id ON public.forms
  FOR EACH ROW EXECUTE FUNCTION private.guard_required_intake_form();

CREATE FUNCTION private.lock_required_intake_form()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE active_version uuid;
BEGIN
  IF NEW.timing <> 'required_before' THEN RETURN NEW; END IF;
  SELECT active_version_id INTO active_version FROM public.forms
    WHERE business_id=NEW.business_id AND id=NEW.form_id AND status='published' FOR SHARE;
  IF active_version IS NULL OR NOT EXISTS(SELECT FROM public.form_versions v WHERE v.business_id=NEW.business_id
    AND v.form_id=NEW.form_id AND v.id=active_version AND v.published_at IS NOT NULL)
    OR EXISTS(SELECT FROM public.form_fields f WHERE f.business_id=NEW.business_id
      AND f.form_version_id=active_version AND f.field_type='file')
  THEN RAISE EXCEPTION 'Choose a published form without file uploads' USING ERRCODE='P0422'; END IF;
  RETURN NEW;
END;
$fn$;
CREATE TRIGGER lock_required_intake_form BEFORE INSERT OR UPDATE ON private.service_intake_settings
  FOR EACH ROW EXECUTE FUNCTION private.lock_required_intake_form();

CREATE FUNCTION public.decide_pending_booking(p_business_id uuid,p_appointment_id uuid,p_actor_user_id uuid,
  p_approve boolean,p_expected_row_version bigint,p_request_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE a public.appointments%ROWTYPE; s public.booking_sessions%ROWTYPE; next_status text; decision text; event_name text;
BEGIN
  IF p_actor_user_id IS NULL OR NOT coalesce(private.actor_business_permission(p_business_id,p_actor_user_id,'can_manage_customers'),false) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE='P0403';
  END IF;
  IF p_request_key IS NULL OR p_approve IS NULL OR p_expected_row_version IS NULL THEN
    RAISE EXCEPTION 'A decision and current appointment version are required' USING ERRCODE='P0422';
  END IF;
  SELECT * INTO a FROM public.appointments WHERE business_id=p_business_id AND id=p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found' USING ERRCODE='P0404'; END IF;
  SELECT * INTO STRICT s FROM public.booking_sessions WHERE business_id=a.business_id AND id=a.session_id FOR UPDATE;
  IF NOT coalesce(private.actor_has_location_access(p_business_id,s.location_id,p_actor_user_id),false) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE='P0403';
  END IF;
  IF a.status<>'pending' OR a.row_version<>p_expected_row_version THEN
    RAISE EXCEPTION 'The booking request changed. Refresh before deciding.' USING ERRCODE='P0409';
  END IF;
  IF p_approve AND s.starts_at<=now() THEN
    RAISE EXCEPTION 'This appointment has already started. Decline it or choose a new time.' USING ERRCODE='P0409';
  END IF;
  next_status:=CASE WHEN p_approve THEN 'confirmed' ELSE 'cancelled' END;
  decision:=CASE WHEN p_approve THEN 'Booking request approved' ELSE 'Booking request declined' END;
  event_name:=CASE WHEN p_approve THEN 'booking.approved' ELSE 'booking.cancelled' END;
  IF p_approve THEN
    UPDATE public.appointments SET status='confirmed' WHERE business_id=a.business_id AND id=a.id;
  ELSE
    UPDATE public.appointments SET status='cancelled',cancelled_at=now(),cancelled_by_user_id=p_actor_user_id,cancellation_reason=decision
      WHERE business_id=a.business_id AND id=a.id;
    IF s.session_type='individual' OR (s.created_from_hold
      AND NOT EXISTS(SELECT FROM public.appointments ap WHERE ap.business_id=a.business_id AND ap.session_id=s.id
        AND ap.status IN ('pending','confirmed','checked_in'))
      AND NOT EXISTS(SELECT FROM public.appointment_holds h WHERE h.business_id=a.business_id AND h.session_id=s.id
        AND h.status='active' AND h.expires_at>now())) THEN
      UPDATE public.booking_sessions SET state='cancelled' WHERE business_id=a.business_id AND id=s.id;
      UPDATE public.resource_reservations SET active=false WHERE business_id=a.business_id AND session_id=s.id AND active;
    END IF;
  END IF;
  INSERT INTO public.appointment_status_history (business_id,appointment_id,from_status,to_status,actor_user_id,actor_type,reason)
    VALUES(a.business_id,a.id,'pending',next_status,p_actor_user_id,'user',decision);
  INSERT INTO private.domain_events (business_id,event_type,entity_type,entity_id,idempotency_key)
    VALUES(a.business_id,event_name,'appointment',a.id,'request-decision:'||p_request_key::text);
  INSERT INTO private.audit_logs (business_id,actor_user_id,actor_type,action,entity_type,entity_id,request_id)
    VALUES(a.business_id,p_actor_user_id,'user',event_name,'appointment',a.id,p_request_key);
  RETURN jsonb_build_object('appointment_id',a.id,'status',next_status);
END;
$fn$;

DO $patch$
DECLARE old_source text; new_source text;
BEGIN
  old_source:=pg_get_functiondef('public.get_appointment_replacement_slots(uuid,date,text,uuid,bigint)'::regprocedure);
  new_source:=replace(old_source,'IF slot_start>=earliest AND private.replacement_slot_is_available',
    'IF slot_start>=earliest AND slot_start<>bs.starts_at AND private.replacement_slot_is_available');
  IF new_source=old_source THEN RAISE EXCEPTION 'Replacement availability source changed'; END IF;
  EXECUTE new_source;
  old_source:=pg_get_functiondef('private.booking_hold_core(text,uuid,uuid,uuid,uuid,timestamptz,jsonb,integer,uuid,boolean)'::regprocedure);
  new_source:=replace(old_source,$anchor$v_result := v_result || jsonb_build_object('intake_form',($anchor$,
    $code$v_result := v_result || jsonb_build_object('optional_intake', coalesce((
      SELECT h.price_snapshot->'intake'->>'timing'='optional_after' FROM public.appointment_holds h
      WHERE h.business_id=v_page.business_id AND h.id=v_hold_id),false), 'intake_form',($code$);
  IF new_source=old_source THEN RAISE EXCEPTION 'Intake response source changed'; END IF;
  EXECUTE new_source;
END;
$patch$;

REVOKE ALL ON FUNCTION private.guard_required_intake_form(),private.lock_required_intake_form(),
  public.decide_pending_booking(uuid,uuid,uuid,boolean,bigint,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.guard_required_intake_form(),private.lock_required_intake_form(),
  public.decide_pending_booking(uuid,uuid,uuid,boolean,bigint,uuid) TO service_role;
