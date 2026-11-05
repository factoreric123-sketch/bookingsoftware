-- Reproduce the stale-version gap using the isolated authorization-verification appointment.
DO $baseline$
DECLARE
  v_id uuid := '58b4c1fe-55f8-4f88-bcb8-256d225e5a4b';
  v_actor uuid := '47fff988-90c4-4129-b072-146f8e35b701';
  v_version bigint;
  v_after bigint;
  v_start timestamptz;
  v_subject text := 'row-version-baseline-' || extensions.gen_random_uuid()::text;
BEGIN
  BEGIN
    EXECUTE 'SET LOCAL ROLE service_role';
    SELECT a.row_version,s.starts_at INTO STRICT v_version,v_start
    FROM public.appointments a JOIN public.booking_sessions s ON s.id=a.session_id AND s.business_id=a.business_id
    JOIN public.businesses b ON b.id=a.business_id
    WHERE a.id=v_id AND b.name='Authorization verification A' AND s.session_type='individual';
    PERFORM public.reschedule_appointment(v_subject,v_id,v_start+interval '7 days',NULL,v_actor,v_version,extensions.gen_random_uuid());
    SELECT row_version INTO STRICT v_after FROM public.appointments WHERE id=v_id;
    IF v_after <> v_version THEN RAISE EXCEPTION 'Baseline unexpected: version already advances'; END IF;
    PERFORM public.reschedule_appointment(v_subject,v_id,v_start+interval '14 days',NULL,v_actor,v_version,extensions.gen_random_uuid());
    RAISE EXCEPTION 'baseline verified; rollback' USING ERRCODE='Z0001';
  EXCEPTION WHEN SQLSTATE 'Z0001' THEN
    RAISE NOTICE 'Baseline reproduced: first move left version unchanged; stale second move succeeded. All baseline changes rolled back.';
  END;
END;
$baseline$;

-- Preserve the live function byte-for-byte except for the appointment touch before RETURN.
DO $repair$
DECLARE
  v_oid oid := 'public.reschedule_appointment(text,uuid,timestamptz,text,uuid,bigint,uuid)'::regprocedure;
  v_definition text;
  v_anchor text := '  RETURN jsonb_build_object(''appointment_id'', v_ap.id, ''starts_at'', p_new_starts_at, ''ends_at'', v_new_ends, ''status'', v_ap.status);';
  v_acl aclitem[];
BEGIN
  SELECT pg_get_functiondef(oid),proacl INTO v_definition,v_acl FROM pg_proc WHERE oid=v_oid;
  IF (length(v_definition)-length(replace(v_definition,v_anchor,'')))/length(v_anchor) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one reschedule return anchor';
  END IF;
  EXECUTE replace(v_definition,v_anchor,
    '  UPDATE public.appointments SET updated_at = now()' || E'\n' ||
    '  WHERE id = v_ap.id AND business_id = v_ap.business_id;' || E'\n\n' || v_anchor);
  IF (SELECT proacl FROM pg_proc WHERE oid=v_oid) IS DISTINCT FROM v_acl THEN
    RAISE EXCEPTION 'Reschedule EXECUTE grants changed';
  END IF;
  IF has_function_privilege('anon',v_oid,'EXECUTE') OR has_function_privilege('authenticated',v_oid,'EXECUTE')
     OR NOT has_function_privilege('service_role',v_oid,'EXECUTE') THEN
    RAISE EXCEPTION 'Reschedule must retain service-role-only client execution';
  END IF;
END;
$repair$;

-- Connected regression as service_role; success marker rolls back all fixture mutations.
DO $regression$
DECLARE
  v_id uuid := '58b4c1fe-55f8-4f88-bcb8-256d225e5a4b';
  v_actor uuid := '47fff988-90c4-4129-b072-146f8e35b701';
  v_business uuid;
  v_session uuid;
  v_version bigint;
  v_current bigint;
  v_start timestamptz;
  v_read timestamptz;
  v_rejected boolean := false;
  v_subject text := 'row-version-regression-' || extensions.gen_random_uuid()::text;
BEGIN
  BEGIN
    EXECUTE 'SET LOCAL ROLE service_role';
    SELECT a.business_id,a.session_id,a.row_version,s.starts_at
    INTO STRICT v_business,v_session,v_version,v_start
    FROM public.appointments a JOIN public.booking_sessions s ON s.id=a.session_id AND s.business_id=a.business_id
    JOIN public.businesses b ON b.id=a.business_id
    WHERE a.id=v_id AND b.name='Authorization verification A' AND s.session_type='individual';

    PERFORM public.reschedule_appointment(v_subject,v_id,v_start+interval '7 days',NULL,v_actor,v_version,extensions.gen_random_uuid());
    SELECT row_version INTO STRICT v_current FROM public.appointments WHERE id=v_id AND business_id=v_business;
    SELECT starts_at INTO STRICT v_read FROM public.booking_sessions WHERE id=v_session AND business_id=v_business;
    IF v_current <> v_version+1 OR v_read <> v_start+interval '7 days' THEN
      RAISE EXCEPTION 'First move must advance appointment version by exactly one and move the session';
    END IF;

    BEGIN
      PERFORM public.reschedule_appointment(v_subject,v_id,v_start+interval '14 days',NULL,v_actor,v_version,extensions.gen_random_uuid());
    EXCEPTION WHEN SQLSTATE 'P0409' THEN
      IF SQLERRM <> 'appointment was modified; refresh and retry' THEN RAISE; END IF;
      v_rejected := true;
    END;
    IF NOT v_rejected THEN RAISE EXCEPTION 'Stale version was not rejected P0409'; END IF;
    SELECT starts_at INTO STRICT v_read FROM public.booking_sessions WHERE id=v_session AND business_id=v_business;
    IF v_read <> v_start+interval '7 days' OR
       (SELECT row_version FROM public.appointments WHERE id=v_id) <> v_current THEN
      RAISE EXCEPTION 'Stale retry changed moved time or appointment version';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.resource_reservations WHERE business_id=v_business AND session_id=v_session AND active
      AND starts_at=(SELECT starts_at-make_interval(mins=>buffer_before_minutes) FROM public.booking_sessions WHERE id=v_session)) THEN
      RAISE EXCEPTION 'Stale retry changed moved reservation';
    END IF;

    PERFORM public.reschedule_appointment(v_subject,v_id,v_start+interval '14 days',NULL,v_actor,v_current,extensions.gen_random_uuid());
    SELECT starts_at INTO STRICT v_read FROM public.booking_sessions WHERE id=v_session AND business_id=v_business;
    IF v_read <> v_start+interval '14 days' OR
       (SELECT row_version FROM public.appointments WHERE id=v_id) <> v_current+1 THEN
      RAISE EXCEPTION 'Current-version retry must succeed and advance version again';
    END IF;
    RAISE NOTICE 'PASS: first move version % -> %; stale version % rejected P0409 with time/reservation/version unchanged; current version % succeeded -> %.',v_version,v_current,v_version,v_current,v_current+1;
    RAISE EXCEPTION 'regression verified; rollback' USING ERRCODE='Z0002';
  EXCEPTION WHEN SQLSTATE 'Z0002' THEN
    RAISE NOTICE 'All connected regression mutations rolled back (sessions, reservations, appointments, history, events, audit and rate limits).';
  END;
END;
$regression$;