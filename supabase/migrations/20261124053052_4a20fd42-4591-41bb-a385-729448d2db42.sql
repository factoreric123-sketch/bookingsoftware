DO $helper$
DECLARE old_def text; new_def text;
BEGIN
 old_def := pg_get_functiondef('private.is_slot_available(uuid,uuid,uuid,timestamptz,timestamptz)'::regprocedure);
 new_def := replace(old_def, 'private.is_slot_available(', 'private.replacement_slot_is_available(');
 new_def := replace(new_def, 'p_end timestamp with time zone)', 'p_end timestamp with time zone, p_excluded_session_id uuid)');
 new_def := replace(new_def, 'AND rr.occupied_range &&', 'AND (rr.session_id IS DISTINCT FROM p_excluded_session_id) AND rr.occupied_range &&');
 IF new_def = old_def OR position('p_excluded_session_id uuid' IN new_def)=0 OR position('rr.session_id IS DISTINCT FROM p_excluded_session_id' IN new_def)=0 THEN RAISE EXCEPTION 'replacement availability helper source mismatch'; END IF;
 EXECUTE new_def;
END;
$helper$;
REVOKE ALL ON FUNCTION private.replacement_slot_is_available(uuid,uuid,uuid,timestamptz,timestamptz,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.replacement_slot_is_available(uuid,uuid,uuid,timestamptz,timestamptz,uuid) TO service_role;

CREATE FUNCTION public.get_appointment_replacement_slots(
 p_appointment_id uuid, p_date date, p_management_token text,
 p_actor_user_id uuid, p_expected_row_version bigint
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $function$
DECLARE
 ap public.appointments%ROWTYPE;
 bs public.booking_sessions%ROWTYPE;
 cfg public.business_settings%ROWTYPE;
 loc public.locations%ROWTYPE;
 authorized boolean := false;
 duration interval;
 earliest timestamptz;
 min_date date;
 max_date date;
 v_window record;
 slot_start timestamptz;
 slot_end timestamptz;
 slots jsonb := '[]'::jsonb;
 daily_count bigint;
BEGIN
 SELECT * INTO ap FROM public.appointments WHERE id=p_appointment_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'appointment not found' USING ERRCODE='P0404'; END IF;
 IF p_management_token IS NOT NULL THEN
  authorized := EXISTS (SELECT 1 FROM private.capability_tokens ct
   WHERE ct.kind='appointment_manage' AND ct.appointment_id=ap.id AND ct.business_id=ap.business_id
    AND ct.token_hash=extensions.digest(p_management_token,'sha256') AND ct.revoked_at IS NULL AND ct.expires_at>now());
 END IF;
 IF NOT authorized AND p_actor_user_id IS NOT NULL THEN
  authorized := private.actor_has_business_access(ap.business_id,p_actor_user_id);
 END IF;
 IF NOT authorized THEN RAISE EXCEPTION 'not authorized to reschedule this appointment' USING ERRCODE='P0403'; END IF;
 IF p_expected_row_version IS NULL OR ap.row_version<>p_expected_row_version THEN
  RAISE EXCEPTION 'appointment was modified; refresh and retry' USING ERRCODE='P0409';
 END IF;
 IF ap.status NOT IN ('pending','confirmed') THEN
  RAISE EXCEPTION 'only pending or confirmed appointments can be rescheduled' USING ERRCODE='P0409';
 END IF;
 SELECT * INTO bs FROM public.booking_sessions WHERE id=ap.session_id AND business_id=ap.business_id;
 IF NOT FOUND OR bs.session_type<>'individual' THEN
  RAISE EXCEPTION 'group attendee rescheduling requires a target session; use the backend flow' USING ERRCODE='P0409';
 END IF;
 SELECT * INTO cfg FROM public.business_settings WHERE business_id=ap.business_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'business settings not found' USING ERRCODE='P0404'; END IF;
 IF bs.starts_at < now()+make_interval(mins=>cfg.reschedule_notice_minutes) THEN
  RAISE EXCEPTION 'inside the rescheduling notice period' USING ERRCODE='P0409';
 END IF;
 SELECT * INTO loc FROM public.locations WHERE id=bs.location_id AND business_id=ap.business_id AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'location is not active' USING ERRCODE='P0409'; END IF;
 earliest := now()+make_interval(mins=>cfg.minimum_notice_minutes);
 min_date := (earliest AT TIME ZONE loc.timezone)::date;
 max_date := (now() AT TIME ZONE loc.timezone)::date+cfg.maximum_advance_days;
 IF p_date IS NULL THEN RAISE EXCEPTION 'date is required' USING ERRCODE='P0422'; END IF;
 duration := bs.ends_at-bs.starts_at;
 IF p_date BETWEEN min_date AND max_date
 AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=ap.business_id AND b.status='active')
 AND EXISTS (SELECT 1 FROM public.staff_profiles sp
  JOIN public.staff_locations sl ON sl.business_id=sp.business_id AND sl.staff_id=sp.id AND sl.location_id=bs.location_id
  JOIN public.staff_services ss ON ss.business_id=sp.business_id AND ss.staff_id=sp.id AND ss.service_id=bs.primary_service_id AND ss.active
  WHERE sp.id=bs.staff_id AND sp.business_id=ap.business_id AND sp.active AND sp.bookable) THEN
  SELECT (SELECT count(*) FROM public.appointments a
    JOIN public.booking_sessions s ON s.id=a.session_id AND s.business_id=a.business_id
    WHERE a.business_id=ap.business_id AND a.id<>ap.id AND s.location_id=bs.location_id
     AND (s.starts_at AT TIME ZONE loc.timezone)::date=p_date AND a.status IN ('pending','confirmed','checked_in'))
   +(SELECT count(*) FROM public.appointment_holds h
    JOIN public.booking_sessions s ON s.id=h.session_id AND s.business_id=h.business_id
    WHERE h.business_id=ap.business_id AND s.location_id=bs.location_id
     AND (s.starts_at AT TIME ZONE loc.timezone)::date=p_date AND h.status='active' AND h.expires_at>now()) INTO daily_count;
  IF cfg.maximum_appointments_per_day IS NULL OR daily_count<cfg.maximum_appointments_per_day THEN
   FOR v_window IN
    SELECT greatest(bh.opens_at,sa.opens_at) w_open, least(bh.closes_at,sa.closes_at) w_close
    FROM public.business_hours bh JOIN public.staff_availability sa
     ON sa.business_id=bh.business_id AND sa.location_id=bh.location_id AND sa.iso_weekday=bh.iso_weekday
      AND sa.staff_id=bs.staff_id AND sa.active AND sa.effective_from<=p_date
      AND (sa.effective_until IS NULL OR sa.effective_until>=p_date)
      AND sa.opens_at<bh.closes_at AND bh.opens_at<sa.closes_at
    WHERE bh.business_id=ap.business_id AND bh.location_id=bs.location_id AND bh.active
     AND bh.iso_weekday=extract(isodow FROM p_date)::smallint
   LOOP
    slot_start := (p_date+v_window.w_open) AT TIME ZONE loc.timezone;
    WHILE slot_start+duration <= (p_date+v_window.w_close) AT TIME ZONE loc.timezone LOOP
     slot_end := slot_start+duration;
     IF slot_start>=earliest AND private.replacement_slot_is_available(ap.business_id,bs.staff_id,bs.location_id,
      slot_start-make_interval(mins=>bs.buffer_before_minutes),slot_end+make_interval(mins=>bs.buffer_after_minutes),bs.id) THEN
      slots := slots || jsonb_build_object('starts_at',slot_start,'ends_at',slot_end,'timezone',loc.timezone);
     END IF;
     slot_start := slot_start+make_interval(mins=>cfg.slot_interval_minutes);
    END LOOP;
   END LOOP;
  END IF;
 END IF;
 SELECT coalesce(jsonb_agg(x ORDER BY x->>'starts_at'),'[]'::jsonb) INTO slots FROM (SELECT DISTINCT value x FROM jsonb_array_elements(slots)) q;
 RETURN jsonb_build_object('appointment_id',ap.id,'row_version',ap.row_version,'date',p_date,'timezone',loc.timezone,
  'min_date',min_date,'max_date',max_date,'slots',slots,'group_rescheduling_supported',false);
END;
$function$;
REVOKE ALL ON FUNCTION public.get_appointment_replacement_slots(uuid,date,text,uuid,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_appointment_replacement_slots(uuid,date,text,uuid,bigint) TO service_role;