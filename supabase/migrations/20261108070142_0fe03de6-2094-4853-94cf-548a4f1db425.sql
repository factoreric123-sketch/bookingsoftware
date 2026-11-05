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
