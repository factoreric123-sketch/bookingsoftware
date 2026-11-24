-- Apply as one Supabase migration using the Supabase connector.
CREATE TABLE private.location_date_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  location_id uuid NOT NULL,
  date date NOT NULL,
  closed boolean NOT NULL,
  opens_at time,
  closes_at time,
  reason text NOT NULL DEFAULT '' CHECK (length(reason) <= 300),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, location_id, date),
  FOREIGN KEY (business_id, location_id) REFERENCES public.locations (business_id, id),
  CHECK ((closed AND opens_at IS NULL AND closes_at IS NULL)
      OR (NOT closed AND opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at))
);
ALTER TABLE private.location_date_hours ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.location_date_hours TO service_role;
REVOKE ALL ON private.location_date_hours FROM PUBLIC, anon, authenticated;
CREATE POLICY location_date_hours_service ON private.location_date_hours TO service_role USING (true) WITH CHECK (true);

CREATE FUNCTION private.special_hours_owner(p_business_id uuid, p_location_id uuid, p_actor_user_id uuid)
RETURNS public.locations LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE location public.locations%ROWTYPE;
BEGIN
  IF private.actor_business_role(p_business_id,p_actor_user_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Owner access is required' USING ERRCODE = 'P0403';
  END IF;
  SELECT * INTO location FROM public.locations l WHERE l.business_id=p_business_id AND l.id=p_location_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Location not found' USING ERRCODE = 'P0404'; END IF;
  RETURN location;
END;
$fn$;

CREATE FUNCTION private.effective_staff_hours(bid uuid, lid uuid, sid uuid, day date)
RETURNS TABLE (w_open time, w_close time) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
  WITH exception AS (
    SELECT closed, opens_at, closes_at FROM private.location_date_hours
    WHERE business_id=bid AND location_id=lid AND date=day
  ), hours AS (
    SELECT opens_at, closes_at FROM exception WHERE NOT closed
    UNION ALL
    SELECT opens_at, closes_at FROM public.business_hours
    WHERE business_id=bid AND location_id=lid AND active
      AND iso_weekday=extract(isodow FROM day) AND NOT EXISTS (SELECT FROM exception)
  )
  SELECT DISTINCT greatest(h.opens_at,s.opens_at), least(h.closes_at,s.closes_at)
  FROM hours h JOIN public.staff_availability s ON s.business_id=bid AND s.location_id=lid
    AND s.staff_id=sid AND s.iso_weekday=extract(isodow FROM day) AND s.active
    AND s.effective_from<=day AND (s.effective_until IS NULL OR s.effective_until>=day)
    AND s.opens_at<h.closes_at AND h.opens_at<s.closes_at;
$fn$;

CREATE FUNCTION public.get_schedule_exceptions(p_business_id uuid,p_location_id uuid,p_actor_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
BEGIN
  PERFORM private.special_hours_owner(p_business_id,p_location_id,p_actor_user_id);
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(e)-'business_id'-'location_id' ORDER BY e.date)
    FROM private.location_date_hours e WHERE e.business_id=p_business_id AND e.location_id=p_location_id),'[]');
END;
$fn$;

CREATE FUNCTION public.preview_schedule_exception(p_business_id uuid,p_location_id uuid,p_actor_user_id uuid,
  p_exception_date date,p_closed boolean,p_opens_at time,p_closes_at time,p_reason text,p_expected_row_version bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE location public.locations%ROWTYPE; zone text; version bigint;
BEGIN
  location := private.special_hours_owner(p_business_id,p_location_id,p_actor_user_id);
  zone := location.timezone;
  IF p_exception_date IS NULL OR p_closed IS NULL OR length(coalesce(p_reason,''))>300
    OR (p_closed AND (p_opens_at IS NOT NULL OR p_closes_at IS NOT NULL))
    OR (NOT p_closed AND (p_opens_at IS NULL OR p_closes_at IS NULL OR p_opens_at>=p_closes_at))
  THEN RAISE EXCEPTION 'Enter a date and valid special hours' USING ERRCODE = 'P0422'; END IF;
  SELECT e.row_version INTO version FROM private.location_date_hours e
  WHERE e.business_id=p_business_id AND e.location_id=p_location_id AND e.date=p_exception_date;
  IF version IS DISTINCT FROM p_expected_row_version THEN
    RAISE EXCEPTION 'Special hours changed. Reload the calendar before saving.' USING ERRCODE = 'P0409';
  END IF;
  RETURN jsonb_build_object('affected',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'appointment_id',a.id,'starts_at',s.starts_at,'timezone',zone,'service_name',svc.name) ORDER BY s.starts_at)
    FROM public.booking_sessions s
    JOIN public.appointments a ON a.business_id=s.business_id AND a.session_id=s.id
    JOIN public.services svc ON svc.business_id=s.business_id AND svc.id=s.primary_service_id
    WHERE s.business_id=p_business_id AND s.location_id=p_location_id
      AND a.status IN ('pending','confirmed','checked_in')
      AND s.starts_at<((p_exception_date+1)::timestamp AT TIME ZONE zone)
      AND s.ends_at>(p_exception_date::timestamp AT TIME ZONE zone)
      AND (p_closed OR s.starts_at<((p_exception_date+p_opens_at) AT TIME ZONE zone)
        OR s.ends_at>((p_exception_date+p_closes_at) AT TIME ZONE zone))),'[]'));
END;
$fn$;

CREATE FUNCTION public.save_schedule_exception(p_business_id uuid,p_location_id uuid,p_actor_user_id uuid,
  p_exception_date date,p_closed boolean,p_opens_at time,p_closes_at time,p_reason text,p_expected_row_version bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE impact jsonb;
BEGIN
  PERFORM private.special_hours_owner(p_business_id,p_location_id,p_actor_user_id);
  PERFORM 1 FROM public.locations WHERE business_id=p_business_id AND id=p_location_id FOR UPDATE;
  impact := public.preview_schedule_exception(p_business_id,p_location_id,p_actor_user_id,p_exception_date,
    p_closed,p_opens_at,p_closes_at,p_reason,p_expected_row_version);
  INSERT INTO private.location_date_hours AS e (business_id,location_id,date,closed,opens_at,closes_at,reason)
  VALUES (p_business_id,p_location_id,p_exception_date,p_closed,p_opens_at,p_closes_at,btrim(coalesce(p_reason,'')))
  ON CONFLICT (business_id,location_id,date) DO UPDATE SET closed=excluded.closed,opens_at=excluded.opens_at,
    closes_at=excluded.closes_at,reason=excluded.reason,row_version=e.row_version+1;
  RETURN impact;
END;
$fn$;

CREATE FUNCTION public.remove_schedule_exception(p_business_id uuid,p_location_id uuid,p_actor_user_id uuid,
  p_exception_date date,p_expected_row_version bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
BEGIN
  PERFORM private.special_hours_owner(p_business_id,p_location_id,p_actor_user_id);
  PERFORM 1 FROM public.locations WHERE business_id=p_business_id AND id=p_location_id FOR UPDATE;
  DELETE FROM private.location_date_hours
  WHERE business_id=p_business_id AND location_id=p_location_id AND date=p_exception_date AND row_version=p_expected_row_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'Special hours changed. Reload the calendar before removing.' USING ERRCODE='P0409'; END IF;
  RETURN jsonb_build_object('removed',true);
END;
$fn$;

DO $patch$
DECLARE source text; modified text; signature regprocedure; start_at int; loop_at int;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'private.booking_availability_core(uuid,uuid,date,date,uuid,jsonb,integer,boolean)'::regprocedure,
    'public.get_appointment_replacement_slots(uuid,date,text,uuid,bigint)'::regprocedure
  ] LOOP
    source := pg_get_functiondef(signature);
    start_at := strpos(source,'FOR v_window IN')+length('FOR v_window IN');
    loop_at := strpos(substr(source,start_at),'LOOP');
    IF start_at<=length('FOR v_window IN') OR loop_at=0
      OR strpos(substr(source,start_at,loop_at-1),'business_hours')=0 THEN
      RAISE EXCEPTION 'Availability window source changed: %',signature;
    END IF;
    modified := substr(source,1,start_at-1) ||
      CASE WHEN signature='private.booking_availability_core(uuid,uuid,date,date,uuid,jsonb,integer,boolean)'::regprocedure
        THEN E'\n        SELECT * FROM private.effective_staff_hours(v_page.business_id,v_page.location_id,v_staff.id,v_date)\n      '
        ELSE E'\n    SELECT * FROM private.effective_staff_hours(ap.business_id,bs.location_id,bs.staff_id,p_date)\n   ' END
      || substr(source,start_at+loop_at-1);
    EXECUTE modified;
  END LOOP;
  signature := 'private.booking_hold_core(text,uuid,uuid,uuid,uuid,timestamptz,jsonb,integer,uuid,boolean)'::regprocedure;
  source := pg_get_functiondef(signature);
  modified := replace(source,'SELECT * INTO v_location FROM locations WHERE id = v_page.location_id AND business_id = v_page.business_id AND active;',
    'SELECT * INTO v_location FROM locations WHERE id = v_page.location_id AND business_id = v_page.business_id AND active FOR SHARE;');
  IF source=modified THEN RAISE EXCEPTION 'Booking hold location lock source changed'; END IF;
  EXECUTE modified;
  signature := 'public.reschedule_appointment(text,uuid,timestamptz,text,uuid,bigint,uuid)'::regprocedure;
  source := pg_get_functiondef(signature);
  modified := replace(source,'v_new_ends := p_new_starts_at + v_duration;', $code$v_new_ends := p_new_starts_at + v_duration;
    PERFORM 1 FROM public.locations WHERE business_id=v_ap.business_id AND id=v_session.location_id FOR SHARE;
    IF EXISTS (
      SELECT 1 FROM private.location_date_hours e
      WHERE e.business_id=v_ap.business_id AND e.location_id=v_session.location_id
      AND p_new_starts_at<((e.date+1)::timestamp AT TIME ZONE v_session.timezone)
      AND v_new_ends>(e.date::timestamp AT TIME ZONE v_session.timezone)
      AND (e.closed OR p_new_starts_at<((e.date+e.opens_at) AT TIME ZONE v_session.timezone)
        OR v_new_ends>((e.date+e.closes_at) AT TIME ZONE v_session.timezone))
    ) THEN RAISE EXCEPTION 'The location is unavailable during these hours; the original booking is unchanged' USING ERRCODE='P0409'; END IF;$code$);
  IF source=modified THEN RAISE EXCEPTION 'Reschedule source changed'; END IF;
  EXECUTE modified;
END;
$patch$;

DO $permissions$
DECLARE signature regprocedure;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'private.special_hours_owner(uuid,uuid,uuid)'::regprocedure,
    'private.effective_staff_hours(uuid,uuid,uuid,date)'::regprocedure,
    'public.get_schedule_exceptions(uuid,uuid,uuid)'::regprocedure,
    'public.preview_schedule_exception(uuid,uuid,uuid,date,boolean,time,time,text,bigint)'::regprocedure,
    'public.save_schedule_exception(uuid,uuid,uuid,date,boolean,time,time,text,bigint)'::regprocedure,
    'public.remove_schedule_exception(uuid,uuid,uuid,date,bigint)'::regprocedure
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',signature);
  END LOOP;
END;
$permissions$;
