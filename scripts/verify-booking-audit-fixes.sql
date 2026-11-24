-- Run inside a rollback transaction against the isolated authorization business.
DO $test$
DECLARE b uuid; l uuid; p uuid; u uuid; s uuid; a uuid; booked_session uuid; v bigint;
  f uuid:=gen_random_uuid(); fv uuid:=gen_random_uuid(); slot jsonb; h jsonb; booking jsonb; res jsonb;
  d date:=(now() AT TIME ZONE 'America/New_York')::date+12;
BEGIN
  SELECT bp.business_id,bp.location_id,bp.id,bm.user_id INTO STRICT b,l,p,u
    FROM public.booking_pages bp JOIN public.business_members bm ON bm.business_id=bp.business_id
    WHERE bp.slug='authz-verification-b-20261107' AND bm.role='owner' AND bm.active;
  SELECT service_id INTO STRICT s FROM public.service_locations WHERE business_id=b AND location_id=l AND active;
  -- Find an open local date instead of assuming the fixture's weekday schedule.
  FOR i IN 0..6 LOOP
    slot:=public.get_availability(p,s,d,d,NULL,'[]',1)->0;
    EXIT WHEN slot IS NOT NULL;
    d:=d+1;
  END LOOP;
  IF slot IS NULL THEN RAISE EXCEPTION 'No fixture slot'; END IF;
  UPDATE public.business_settings SET manual_approval_required=true,cancellation_notice_minutes=43200 WHERE business_id=b;
  h:=public.create_booking_hold('audit-fixes',p,s,(slot->>'staff_id')::uuid,NULL,(slot->>'starts_at')::timestamptz,'[]',1,gen_random_uuid());
  booking:=public.confirm_booking('audit-fixes',h->>'hold_token',NULL,NULL,
    jsonb_build_object('full_name','Audit test','email',gen_random_uuid()::text||'@example.test'),'','[]',gen_random_uuid());
  a:=(booking->>'appointment_id')::uuid;
  SELECT ap.row_version,ap.session_id INTO STRICT v,booked_session FROM public.appointments ap WHERE ap.id=a;
  BEGIN
    PERFORM public.cancel_appointment('audit-fixes',a,'Customer cancellation',booking->>'management_token',NULL,v,gen_random_uuid());
    RAISE EXCEPTION 'Customer cutoff was bypassed';
  EXCEPTION WHEN SQLSTATE 'P0409' THEN IF SQLERRM NOT LIKE '%cancellation notice%' THEN RAISE; END IF;
  END;
  res:=public.get_appointment_replacement_slots(a,d,NULL,u,v);
  IF jsonb_array_length(res->'slots')=0 OR EXISTS(SELECT FROM jsonb_array_elements(res->'slots') x
    WHERE (x->>'starts_at')::timestamptz=(slot->>'starts_at')::timestamptz)
  THEN RAISE EXCEPTION 'Replacement options should exclude the current start but retain other eligible times'; END IF;
  BEGIN
    PERFORM public.decide_pending_booking(b,a,NULL,false,v,gen_random_uuid());
    RAISE EXCEPTION 'Unverified actor reached the approval queue';
  EXCEPTION WHEN SQLSTATE 'P0403' THEN NULL; END;
  BEGIN
    PERFORM public.decide_pending_booking(b,a,u,false,v+1,gen_random_uuid());
    RAISE EXCEPTION 'Stale booking decision was accepted';
  EXCEPTION WHEN SQLSTATE 'P0409' THEN NULL; END;
  res:=public.decide_pending_booking(b,a,u,false,v,gen_random_uuid());
  IF res->>'status' IS DISTINCT FROM 'cancelled' OR EXISTS(SELECT FROM public.resource_reservations rr
    WHERE rr.business_id=b AND rr.session_id=booked_session AND rr.active)
  THEN RAISE EXCEPTION 'Staff decline did not release capacity'; END IF;
  IF NOT EXISTS(SELECT FROM public.appointment_status_history sh WHERE sh.appointment_id=a
    AND sh.from_status='pending' AND sh.to_status='cancelled' AND sh.actor_user_id=u)
  THEN RAISE EXCEPTION 'Staff decline was missing history'; END IF;
  h:=public.create_booking_hold('audit-fixes-approve',p,s,(slot->>'staff_id')::uuid,NULL,
    (slot->>'starts_at')::timestamptz,'[]',1,gen_random_uuid());
  booking:=public.confirm_booking('audit-fixes-approve',h->>'hold_token',NULL,NULL,
    jsonb_build_object('full_name','Audit test','email',gen_random_uuid()::text||'@example.test'),'','[]',gen_random_uuid());
  a:=(booking->>'appointment_id')::uuid;
  SELECT ap.row_version,ap.session_id INTO STRICT v,booked_session FROM public.appointments ap WHERE ap.id=a;
  res:=public.decide_pending_booking(b,a,u,true,v,gen_random_uuid());
  IF res->>'status' IS DISTINCT FROM 'confirmed' OR NOT EXISTS(SELECT FROM public.resource_reservations rr
    WHERE rr.business_id=b AND rr.session_id=booked_session AND rr.active)
  THEN RAISE EXCEPTION 'Approval did not confirm the request and retain capacity'; END IF;

  INSERT INTO public.forms(id,business_id,name,slug) VALUES(f,b,'Audit required form','audit-'||f::text);
  INSERT INTO public.form_versions(id,business_id,form_id,version_number,published_at) VALUES(fv,b,f,1,now());
  UPDATE public.forms SET status='published',active_version_id=fv WHERE id=f;
  PERFORM public.save_service_intake_settings(b,u,s,f,'required_before',NULL);
  BEGIN
    UPDATE public.forms SET status='draft' WHERE id=f;
    RAISE EXCEPTION 'Required intake form was unpublished';
  EXCEPTION WHEN SQLSTATE 'P0409' THEN NULL; END;
  PERFORM public.save_service_intake_settings(b,u,s,NULL,NULL,1);
  UPDATE public.forms SET status='draft' WHERE id=f;
  IF NOT EXISTS(SELECT FROM public.forms WHERE id=f AND status='draft') THEN RAISE EXCEPTION 'Detached form could not be unpublished'; END IF;
END;
$test$;
