-- Run in the same transaction as the migration for preflight, or wrap in BEGIN/ROLLBACK after rollout.
DO $test$
DECLARE
  u uuid;
  b uuid;
  l uuid;
  page uuid;
  svc uuid;
  staff uuid;
  d date := (now() AT TIME ZONE 'America/New_York')::date + 8;
  slots jsonb;
  before_count int;
  target record;
  version bigint;
  booked jsonb;
  held jsonb;
  impact jsonb;
  original timestamptz;
  appointment uuid;
  appointment_version bigint;
  special_count int := 0;
BEGIN
  SELECT bp.business_id,bp.location_id,bp.id,bm.user_id
  INTO STRICT b,l,page,u
  FROM public.booking_pages bp JOIN public.business_members bm
    ON bm.business_id=bp.business_id AND bm.role='owner' AND bm.active
  WHERE bp.slug='authz-verification-b-20261107';
  SELECT sl.service_id INTO STRICT svc FROM public.service_locations sl
  WHERE sl.business_id=b AND sl.location_id=l AND sl.active;
  slots := public.get_availability(page,svc,d,d,NULL,'[]',1);
  before_count := jsonb_array_length(slots);
  IF before_count<1 THEN RAISE EXCEPTION 'Verification fixture needs an open date'; END IF;
  staff := (slots->0->>'staff_id')::uuid;
  BEGIN
    PERFORM public.get_schedule_exceptions(b,l,NULL);
    RAISE EXCEPTION 'Unverified actor reached owner settings';
  EXCEPTION WHEN SQLSTATE 'P0403' THEN NULL;
  END;
  held := public.create_booking_hold('special-hours-fixture',page,svc,staff,NULL,
    (slots->0->>'starts_at')::timestamptz,'[]',1,gen_random_uuid());
  booked := public.confirm_booking('special-hours-fixture',held->>'hold_token',NULL,NULL,
    jsonb_build_object('full_name','Special hours rollback','email',gen_random_uuid()::text||'@example.test'),
    '', '[]', gen_random_uuid());
  appointment := (booked->>'appointment_id')::uuid;
  SELECT a.row_version,s.starts_at INTO STRICT appointment_version,original
    FROM public.appointments a JOIN public.booking_sessions s ON s.id=a.session_id
    WHERE a.id=appointment;
  before_count := jsonb_array_length(public.get_availability(page,svc,d,d,NULL,'[]',1));
  impact := public.preview_schedule_exception(b,l,u,d,true,NULL,NULL,'rollback verification',NULL);
  IF NOT EXISTS (SELECT FROM jsonb_array_elements(impact->'affected') e WHERE e->>'appointment_id'=appointment::text)
  THEN RAISE EXCEPTION 'Closure preview omitted the existing booking'; END IF;
  PERFORM public.save_schedule_exception(b,l,u,d,true,NULL,NULL,'rollback verification',NULL);
  IF jsonb_array_length(public.get_availability(page,svc,d,d,NULL,'[]',1))<>0
    OR jsonb_array_length(public.get_dashboard_booking_availability(page,svc,d,d,NULL,'[]',1,u))<>0
  THEN RAISE EXCEPTION 'Closure left public or dashboard slots'; END IF;
  BEGIN
    PERFORM public.create_booking_hold('special-hours-rollback',page,svc,staff,NULL,(slots->0->>'starts_at')::timestamptz,'[]',1,gen_random_uuid());
    RAISE EXCEPTION 'Closure accepted a new hold';
  EXCEPTION WHEN SQLSTATE 'P0409' THEN NULL;
  END;
  IF jsonb_array_length(public.get_appointment_replacement_slots(appointment,d,NULL,u,appointment_version)->'slots')<>0
  THEN RAISE EXCEPTION 'Closure left replacement slots'; END IF;
  BEGIN
    PERFORM public.reschedule_appointment('special-hours-fixture',appointment,original+interval '15 minutes',
      NULL,u,appointment_version,gen_random_uuid());
    RAISE EXCEPTION 'Closure accepted a move';
  EXCEPTION WHEN SQLSTATE 'P0409' THEN NULL;
  END;
  IF NOT EXISTS (SELECT FROM public.appointments a JOIN public.booking_sessions s ON s.id=a.session_id
    WHERE a.id=appointment AND a.row_version=appointment_version AND s.starts_at=original)
  THEN RAISE EXCEPTION 'Closure changed an existing appointment'; END IF;
  SELECT e.row_version INTO STRICT version FROM private.location_date_hours e WHERE e.business_id=b AND e.location_id=l AND e.date=d;
  BEGIN
    PERFORM public.save_schedule_exception(b,l,u,d,false,'10:00','12:00','rollback verification',NULL);
    RAISE EXCEPTION 'Stale update accepted';
  EXCEPTION WHEN SQLSTATE 'P0409' THEN NULL;
  END;
  PERFORM public.save_schedule_exception(b,l,u,d,false,'10:00','12:00','rollback verification',version);
  FOR target IN SELECT x FROM jsonb_array_elements(public.get_availability(page,svc,d,d,NULL,'[]',1)) x LOOP
    special_count := special_count+1;
    IF ((target.x->>'starts_at')::timestamptz AT TIME ZONE
      (SELECT timezone FROM public.locations WHERE id=l))::time < time '10:00'
      OR ((target.x->>'ends_at')::timestamptz AT TIME ZONE
      (SELECT timezone FROM public.locations WHERE id=l))::time > time '12:00'
    THEN RAISE EXCEPTION 'Special hours returned a slot outside the window'; END IF;
  END LOOP;
  IF special_count=0 THEN RAISE EXCEPTION 'Special hours did not return any open slots'; END IF;
  PERFORM public.remove_schedule_exception(b,l,u,d,version+1);
  IF jsonb_array_length(public.get_availability(page,svc,d,d,NULL,'[]',1))<>before_count
  THEN RAISE EXCEPTION 'Removing special hours did not restore normal availability'; END IF;
END;
$test$;
