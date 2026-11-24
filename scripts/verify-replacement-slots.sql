-- Opt-in connected regression. Run as the migration owner, never at app startup.
-- All identifiers are generated and all fixture data is rolled back.
BEGIN;
DO $test$
DECLARE
 o uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); l uuid:=gen_random_uuid();
 s uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 bs uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); u uuid:=gen_random_uuid();
 d date:=(now() AT TIME ZONE 'America/New_York')::date+7;
 t timestamptz; result jsonb;
BEGIN
 INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(u,'replacement-'||u::text||'@example.test',now());
 INSERT INTO public.organizations(id,name,slug) VALUES(o,'Replacement rollback test','replacement-'||o::text);
 INSERT INTO public.businesses(id,organization_id,name,slug,status) VALUES(b,o,'Replacement rollback test','replacement-'||b::text,'active');
 INSERT INTO public.locations(id,business_id,name,slug,timezone) VALUES(l,b,'Location','replacement','America/New_York');
 INSERT INTO public.business_members(business_id,user_id,role) VALUES(b,u,'owner');
 INSERT INTO public.business_settings(business_id,minimum_notice_minutes,reschedule_notice_minutes,maximum_advance_days,maximum_appointments_per_day) VALUES(b,0,0,30,1);
 INSERT INTO public.staff_profiles(id,business_id,display_name) VALUES(s,b,'Staff');
 INSERT INTO public.services(id,business_id,name,duration_minutes) VALUES(v,b,'Service',30);
 INSERT INTO public.staff_locations(business_id,staff_id,location_id) VALUES(b,s,l);
 INSERT INTO public.staff_services(business_id,staff_id,service_id) VALUES(b,s,v);
 INSERT INTO public.business_hours(business_id,location_id,iso_weekday,opens_at,closes_at) VALUES(b,l,extract(isodow FROM d)::smallint,'09:00','17:00');
 INSERT INTO public.staff_availability(business_id,location_id,staff_id,iso_weekday,opens_at,closes_at,effective_from) VALUES(b,l,s,extract(isodow FROM d)::smallint,'09:00','15:00',d-1);
 INSERT INTO public.customers(id,business_id,full_name) VALUES(c,b,'Customer');
 t:=(d+time '09:00') AT TIME ZONE 'America/New_York';
 INSERT INTO public.booking_sessions(id,business_id,location_id,primary_service_id,staff_id,starts_at,ends_at,timezone,session_type,state,delivery_mode,buffer_before_minutes,buffer_after_minutes) VALUES(bs,b,l,v,s,t,t+interval '90 minutes','America/New_York','individual','scheduled','business_location',15,20);
 INSERT INTO public.appointments(id,business_id,session_id,customer_id,status,source,currency) VALUES(a,b,bs,c,'confirmed','dashboard','USD');
 INSERT INTO public.resource_reservations(business_id,staff_id,session_id,starts_at,ends_at) VALUES(b,s,bs,t-interval '15 minutes',t+interval '110 minutes');
 PERFORM set_config('role','service_role',true);
 result:=public.get_appointment_replacement_slots(a,d,NULL,u,1);
 IF jsonb_array_length(result->'slots')<>10 THEN RAISE EXCEPTION 'expected 10 replacement slots at daily cap 1'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(result->'slots') x WHERE (x->>'starts_at')::timestamptz=t) THEN RAISE EXCEPTION 'own reservation not excluded'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(result->'slots') x WHERE (x->>'ends_at')::timestamptz-(x->>'starts_at')::timestamptz<>interval '90 minutes') THEN RAISE EXCEPTION 'saved duration changed to current service duration'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(result->'slots') x WHERE ((x->>'starts_at')::timestamptz AT TIME ZONE 'America/New_York')::time<time '09:00' OR ((x->>'ends_at')::timestamptz AT TIME ZONE 'America/New_York')::time>time '15:00') THEN RAISE EXCEPTION 'staff/business intersection not enforced'; END IF;
 BEGIN PERFORM public.get_appointment_replacement_slots(a,d,NULL,NULL,1); RAISE EXCEPTION 'id-only request allowed'; EXCEPTION WHEN SQLSTATE 'P0403' THEN NULL; END;
 BEGIN PERFORM public.get_appointment_replacement_slots(a,d,NULL,u,0); RAISE EXCEPTION 'stale version allowed'; EXCEPTION WHEN SQLSTATE 'P0409' THEN NULL; END;
 BEGIN PERFORM public.get_appointment_replacement_slots(a,d,NULL,u,NULL); RAISE EXCEPTION 'null version allowed'; EXCEPTION WHEN SQLSTATE 'P0409' THEN NULL; END;
 EXECUTE 'RESET ROLE';
 IF NOT EXISTS(SELECT 1 FROM public.appointments WHERE id=a AND row_version=1) OR NOT EXISTS(SELECT 1 FROM public.booking_sessions WHERE id=bs AND starts_at=t AND row_version=1) OR NOT EXISTS(SELECT 1 FROM public.resource_reservations WHERE business_id=b AND session_id=bs AND active AND row_version=1) THEN RAISE EXCEPTION 'read mutated saved state'; END IF;
 RAISE NOTICE 'PASS: owner, cap/self exclusion, duration, hours, ID denial, stale/null versions, read-only state';
END;
$test$;
ROLLBACK;