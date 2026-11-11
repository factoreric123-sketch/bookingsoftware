DO $repair$
DECLARE
  v_hold_oid oid := 'public.create_booking_hold(text,uuid,uuid,uuid,uuid,timestamp with time zone,jsonb,integer,uuid)'::regprocedure;
  v_availability_oid oid := 'public.get_availability(uuid,uuid,date,date,uuid,jsonb,integer)'::regprocedure;
  v_hold_definition text;
  v_availability_definition text;
  v_old text;
  v_new text;
  v_hold_acl aclitem[];
  v_availability_acl aclitem[];
BEGIN
  SELECT pg_get_functiondef(oid), proacl INTO v_hold_definition, v_hold_acl FROM pg_proc WHERE oid = v_hold_oid;
  SELECT pg_get_functiondef(oid), proacl INTO v_availability_definition, v_availability_acl FROM pg_proc WHERE oid = v_availability_oid;

  v_old := E'  v_seats integer := GREATEST(COALESCE(p_seat_count, 1), 1);';
  v_new := v_old || E'\n  v_daily_count bigint;\n  v_cap_date date;\n  v_cap_location_id uuid;\n  v_cap_timezone text;';
  IF (length(v_hold_definition) - length(replace(v_hold_definition, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION 'create_booking_hold declaration anchor changed';
  END IF;
  v_hold_definition := replace(v_hold_definition, v_old, v_new);

  v_old := E'  IF p_starts_at < now() + make_interval(mins => v_settings.minimum_notice_minutes) THEN';
  v_new := $cap$  -- Serialize all hold creators for this business. Read the cap again after waiting.
  SELECT * INTO v_settings FROM business_settings
  WHERE business_id = v_page.business_id FOR UPDATE;
  IF v_settings.maximum_appointments_per_day IS NOT NULL THEN
    v_cap_location_id := v_page.location_id;
    v_cap_timezone := v_location.timezone;
    v_cap_date := (p_starts_at AT TIME ZONE v_cap_timezone)::date;
    -- An existing group hold belongs to the session's actual location and date,
    -- not an arbitrary caller-supplied start time.
    IF v_service.appointment_type <> 'individual' AND p_session_id IS NOT NULL THEN
      SELECT bs.location_id, l.timezone, (bs.starts_at AT TIME ZONE l.timezone)::date
      INTO v_cap_location_id, v_cap_timezone, v_cap_date
      FROM booking_sessions bs
      JOIN locations l ON l.business_id = bs.business_id AND l.id = bs.location_id
      WHERE bs.id = p_session_id AND bs.business_id = v_page.business_id
        AND bs.session_type = 'group' AND bs.state IN ('holding','scheduled');
      IF NOT FOUND THEN
        RAISE EXCEPTION 'group session not found' USING ERRCODE = 'P0404';
      END IF;
    END IF;
    SELECT
      (SELECT count(*) FROM appointments ap
       JOIN booking_sessions bs ON bs.id = ap.session_id AND bs.business_id = ap.business_id
       WHERE ap.business_id = v_page.business_id AND bs.location_id = v_cap_location_id
         AND (bs.starts_at AT TIME ZONE v_cap_timezone)::date = v_cap_date
         AND ap.status IN ('pending','confirmed','checked_in'))
      + (SELECT count(*) FROM appointment_holds h
         JOIN booking_sessions bs ON bs.id = h.session_id AND bs.business_id = h.business_id
         WHERE h.business_id = v_page.business_id AND bs.location_id = v_cap_location_id
           AND (bs.starts_at AT TIME ZONE v_cap_timezone)::date = v_cap_date
           AND h.status = 'active' AND h.expires_at > now())
    INTO v_daily_count;
    IF v_daily_count >= v_settings.maximum_appointments_per_day THEN
      RAISE EXCEPTION 'maximum appointments per day reached' USING ERRCODE = 'P0409';
    END IF;
  END IF;

$cap$ || v_old;
  IF (length(v_hold_definition) - length(replace(v_hold_definition, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION 'create_booking_hold notice anchor changed';
  END IF;
  v_hold_definition := replace(v_hold_definition, v_old, v_new);

  v_old := E'    IF v_date > v_latest THEN CONTINUE; END IF;';
  v_new := v_old || $cap$

    -- One active customer appointment or unexpired active hold counts once,
    -- including group attendees with multiple seats. Applies to all slot paths.
    IF v_settings.maximum_appointments_per_day IS NOT NULL THEN
      SELECT
        (SELECT count(*) FROM appointments ap
         JOIN booking_sessions bs ON bs.id = ap.session_id AND bs.business_id = ap.business_id
         WHERE ap.business_id = v_page.business_id AND bs.location_id = v_page.location_id
           AND (bs.starts_at AT TIME ZONE v_location.timezone)::date = v_date
           AND ap.status IN ('pending','confirmed','checked_in'))
        + (SELECT count(*) FROM appointment_holds h
           JOIN booking_sessions bs ON bs.id = h.session_id AND bs.business_id = h.business_id
           WHERE h.business_id = v_page.business_id AND bs.location_id = v_page.location_id
             AND (bs.starts_at AT TIME ZONE v_location.timezone)::date = v_date
             AND h.status = 'active' AND h.expires_at > now())
      INTO v_daily_count;
      IF v_daily_count >= v_settings.maximum_appointments_per_day THEN
        CONTINUE;
      END IF;
    END IF;$cap$;
  IF (length(v_availability_definition) - length(replace(v_availability_definition, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION 'get_availability date anchor changed';
  END IF;
  v_availability_definition := replace(v_availability_definition, v_old, v_new);

  v_old := $old$                IF v_settings.maximum_appointments_per_day IS NOT NULL THEN
                  SELECT count(*) INTO v_daily_count
                  FROM appointments ap
                  JOIN booking_sessions bs ON bs.id = ap.session_id AND bs.business_id = ap.business_id
                  WHERE ap.business_id = v_page.business_id
                    AND bs.location_id = v_page.location_id
                    AND (bs.starts_at AT TIME ZONE v_location.timezone)::date = v_date
                    AND ap.status IN ('pending','confirmed','checked_in');
                  IF v_daily_count >= v_settings.maximum_appointments_per_day THEN
                    EXIT;
                  END IF;
                END IF;
$old$;
  IF (length(v_availability_definition) - length(replace(v_availability_definition, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION 'get_availability old individual cap anchor changed';
  END IF;
  v_availability_definition := replace(v_availability_definition, v_old, '');

  EXECUTE v_hold_definition;
  EXECUTE v_availability_definition;
  IF (SELECT proacl FROM pg_proc WHERE oid = v_hold_oid) IS DISTINCT FROM v_hold_acl
     OR (SELECT proacl FROM pg_proc WHERE oid = v_availability_oid) IS DISTINCT FROM v_availability_acl
     OR (SELECT prosecdef FROM pg_proc WHERE oid = v_hold_oid)
     OR (SELECT prosecdef FROM pg_proc WHERE oid = v_availability_oid)
     OR has_function_privilege('anon', v_hold_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_hold_oid, 'EXECUTE')
     OR has_function_privilege('anon', v_availability_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_availability_oid, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_hold_oid, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_availability_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'booking RPC security or grants changed';
  END IF;
END;
$repair$;