DO $repair$
DECLARE
  v_oid oid := 'public.create_booking_hold(text,uuid,uuid,uuid,uuid,timestamptz,jsonb,integer,uuid)'::regprocedure;
  v_before text;
  v_after text;
  v_acl aclitem[];
  v_definer boolean;
  v_config text[];
  v_anchor text := '  IF p_starts_at < now() + make_interval(mins => v_settings.minimum_notice_minutes) THEN';
  v_pick text;
  v_validation text := $validation$  -- Validate the exact requested slot under the existing business-settings lock.
  -- Availability is read-only with respect to hold creation: it never calls this RPC.
  SELECT (slot->>'staff_id')::uuid INTO v_staff_id
  FROM jsonb_array_elements(public.get_availability(
    p_booking_page_id, p_service_id,
    (p_starts_at AT TIME ZONE v_location.timezone)::date,
    (p_starts_at AT TIME ZONE v_location.timezone)::date,
    p_staff_id, p_addon_quantities, v_seats
  )) AS candidates(slot)
  WHERE (slot->>'starts_at')::timestamptz = p_starts_at
    AND (p_staff_id IS NULL OR (slot->>'staff_id')::uuid = p_staff_id)
    AND (slot->>'session_id')::uuid IS NOT DISTINCT FROM p_session_id
    AND (v_service.appointment_type <> 'individual' OR p_session_id IS NULL)
    AND (v_service.appointment_type = 'individual' OR p_session_id IS NOT NULL OR p_staff_id IS NOT NULL)
  ORDER BY (slot->>'staff_id')::uuid
  LIMIT 1;
  IF NOT FOUND OR v_staff_id IS NULL THEN
    RAISE EXCEPTION 'requested slot is not available' USING ERRCODE = 'P0409';
  END IF;

$validation$;
BEGIN
  SELECT pg_get_functiondef(oid), proacl, prosecdef, proconfig
  INTO v_before, v_acl, v_definer, v_config FROM pg_proc WHERE oid = v_oid;
  IF position('create_booking_hold' IN pg_get_functiondef('public.get_availability(uuid,uuid,date,date,uuid,jsonb,integer)'::regprocedure)) > 0 THEN
    RAISE EXCEPTION 'availability must not call hold creation';
  END IF;
  IF (length(v_before)-length(replace(v_before,v_anchor,'')))/length(v_anchor) <> 1 THEN
    RAISE EXCEPTION 'expected exactly one validation insertion anchor';
  END IF;
  v_pick := substring(v_before FROM '(    -- Pick an eligible staff member when none was requested[\s\S]*?    END IF;)');
  -- Capture through the outer END IF, rather than the inner no-staff check.
  v_pick := substring(v_before FROM '(    -- Pick an eligible staff member when none was requested[\s\S]*?    END IF;\n\n    SELECT greatest)');
  IF v_pick IS NULL THEN RAISE EXCEPTION 'staff-selection anchor missing'; END IF;
  v_pick := left(v_pick, length(v_pick)-length(E'\n\n    SELECT greatest'));
  v_after := replace(v_before, v_anchor, v_validation || v_anchor);
  v_after := replace(v_after, v_pick, '    -- v_staff_id was selected from the exact authoritative availability slot.');
  IF v_after = v_before OR position('Pick an eligible staff member' IN v_after)>0 THEN
    RAISE EXCEPTION 'staff-selection replacement failed';
  END IF;
  EXECUTE v_after;
  IF pg_get_functiondef(v_oid) <> v_after THEN RAISE EXCEPTION 'unexpected function-text change'; END IF;
  IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=v_oid AND (proacl IS DISTINCT FROM v_acl OR prosecdef IS DISTINCT FROM v_definer OR proconfig IS DISTINCT FROM v_config)) THEN
    RAISE EXCEPTION 'function grants or security changed';
  END IF;
  IF has_function_privilege('anon',v_oid,'EXECUTE') OR has_function_privilege('authenticated',v_oid,'EXECUTE') OR NOT has_function_privilege('service_role',v_oid,'EXECUTE') THEN
    RAISE EXCEPTION 'service-role-only grants must be preserved';
  END IF;
END $repair$;