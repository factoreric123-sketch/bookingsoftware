-- Run inside BEGIN/ROLLBACK against the isolated authorization test business.
DO $test$
DECLARE
  b uuid; l uuid; page uuid; u uuid; svc uuid;
  form uuid:=gen_random_uuid(); version uuid:=gen_random_uuid(); field uuid:=gen_random_uuid();
  d date:=(now() AT TIME ZONE 'America/New_York')::date+9;
  slot jsonb; hold jsonb; booked jsonb; intake jsonb; request_id uuid;
  contact jsonb := jsonb_build_object('full_name','Intake rollback','email',gen_random_uuid()::text||'@example.test');
  payload jsonb:=jsonb_build_object('version_id',version,'answers',jsonb_build_object('reason','Consultation'));
BEGIN
  SELECT bp.business_id,bp.location_id,bp.id,bm.user_id INTO STRICT b,l,page,u
    FROM public.booking_pages bp JOIN public.business_members bm ON bm.business_id=bp.business_id
    WHERE bp.slug='authz-verification-b-20261107' AND bm.role='owner' AND bm.active;
  SELECT service_id INTO STRICT svc FROM public.service_locations WHERE business_id=b AND location_id=l AND active;
  INSERT INTO public.forms(id,business_id,name,slug) VALUES(form,b,'Intake rollback','intake-'||form::text);
  INSERT INTO public.form_versions(id,business_id,form_id,version_number) VALUES(version,b,form,1);
  INSERT INTO public.form_fields(id,business_id,form_version_id,field_key,label,field_type,required,sort_order)
    VALUES(field,b,version,'reason','Reason for your visit','text',true,1);
  UPDATE public.form_versions SET published_at=now() WHERE id=version;
  UPDATE public.forms SET status='published',active_version_id=version WHERE id=form;
  PERFORM public.save_service_intake_settings(b,u,svc,form,'required_before',NULL);
  slot:=public.get_availability(page,svc,d,d,NULL,'[]',1)->0;
  IF slot IS NULL THEN RAISE EXCEPTION 'Verification fixture needs an open date'; END IF;
  hold:=public.create_booking_hold('intake-rollback-required',page,svc,(slot->>'staff_id')::uuid,
    NULL,(slot->>'starts_at')::timestamptz,'[]',1,gen_random_uuid());
  IF hold->'intake_form'->>'version_id' IS DISTINCT FROM version::text THEN RAISE EXCEPTION 'Hold did not snapshot intake'; END IF;
  request_id:=gen_random_uuid();
  BEGIN
    PERFORM public.confirm_booking('intake-rollback-required',hold->>'hold_token',NULL,NULL,contact,'','[]',request_id);
    RAISE EXCEPTION 'Required intake could be skipped';
  EXCEPTION WHEN SQLSTATE 'P0422' THEN NULL; END;
  BEGIN
    PERFORM public.confirm_booking('intake-rollback-required',hold->>'hold_token',NULL,NULL,
      contact||jsonb_build_object('intake',jsonb_build_object('version_id',version,'answers','{}'::jsonb)),'','[]',request_id);
    RAISE EXCEPTION 'Required field could be skipped';
  EXCEPTION WHEN SQLSTATE 'P0422' THEN NULL; END;
  PERFORM public.save_service_intake_settings(b,u,svc,form,'optional_after',1);
  booked:=public.confirm_booking('intake-rollback-required',hold->>'hold_token',NULL,NULL,
    contact||jsonb_build_object('intake',payload),'','[]',request_id);
  IF NOT EXISTS (SELECT FROM public.form_submissions s JOIN public.form_submission_answers a
    ON a.business_id=s.business_id AND a.submission_id=s.id
    WHERE s.appointment_id=(booked->>'appointment_id')::uuid AND a.form_field_id=field
      AND a.value='"Consultation"'::jsonb) THEN RAISE EXCEPTION 'Required answer not attached to booked appointment'; END IF;
  slot:=public.get_availability(page,svc,d,d,NULL,'[]',1)->0;
  hold:=public.create_booking_hold('intake-rollback-optional',page,svc,(slot->>'staff_id')::uuid,
    NULL,(slot->>'starts_at')::timestamptz,'[]',1,gen_random_uuid());
  IF hold->'intake_form' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Optional intake interrupted checkout'; END IF;
  IF hold->>'optional_intake' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Optional intake was not signaled to checkout'; END IF;
  booked:=public.confirm_booking('intake-rollback-optional',hold->>'hold_token',NULL,NULL,contact,'','[]',gen_random_uuid());
  BEGIN
    PERFORM public.get_appointment_intake(gen_random_uuid()::text,'intake-rollback-optional');
    RAISE EXCEPTION 'Unrelated token reached intake';
  EXCEPTION WHEN SQLSTATE 'P0403' THEN NULL; END;
  intake:=public.get_appointment_intake(booked->>'management_token','intake-rollback-optional');
  IF intake->>'submitted' IS DISTINCT FROM 'false' OR intake->'form'->>'version_id' IS DISTINCT FROM version::text
  THEN RAISE EXCEPTION 'Optional intake was not offered through the management link'; END IF;
  FOR retry IN 1..2 LOOP
    PERFORM public.submit_appointment_intake(booked->>'management_token','intake-rollback-optional',payload,gen_random_uuid());
  END LOOP;
  IF (SELECT count(*) FROM public.form_submissions WHERE appointment_id=(booked->>'appointment_id')::uuid AND source='booking')<>1
  THEN RAISE EXCEPTION 'Optional intake was not attached exactly once'; END IF;
  IF public.get_appointment_intake(booked->>'management_token','intake-rollback-optional')->>'submitted' IS DISTINCT FROM 'true'
  THEN RAISE EXCEPTION 'Optional intake did not report completion'; END IF;
END;
$test$;
