CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============ private.check_rate_limit ============
CREATE OR REPLACE FUNCTION private.check_rate_limit(p_scope text, p_subject_hash text, p_limit integer, p_window_seconds integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_start timestamptz;
  v_count integer;
BEGIN
  v_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  INSERT INTO private.rate_limit_buckets (scope, subject_hash, window_start, window_seconds, request_count, expires_at)
  VALUES (p_scope, p_subject_hash, v_start, p_window_seconds, 1, v_start + make_interval(secs => p_window_seconds * 2))
  ON CONFLICT (scope, subject_hash, window_start)
  DO UPDATE SET request_count = private.rate_limit_buckets.request_count + 1
  RETURNING request_count INTO v_count;
  IF v_count > p_limit THEN
    RAISE EXCEPTION 'rate limit exceeded' USING ERRCODE = 'P0429';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.check_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.check_rate_limit(text, text, integer, integer) TO service_role;

-- ============ private.generate_capability_token ============
-- 32 cryptographically random bytes, URL-safe encoded. Raw value is returned once and never stored.
CREATE OR REPLACE FUNCTION private.generate_capability_token()
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
END;
$$;
REVOKE ALL ON FUNCTION private.generate_capability_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.generate_capability_token() TO service_role;

-- ============ private.is_slot_available ============
-- Checks reservations (buffers included), blocked times, approved time off, and external busy events.
CREATE OR REPLACE FUNCTION private.is_slot_available(
  p_business_id uuid, p_staff_id uuid, p_location_id uuid,
  p_start timestamptz, p_end timestamptz
)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.resource_reservations rr
    WHERE rr.business_id = p_business_id AND rr.staff_id = p_staff_id AND rr.active
      AND rr.occupied_range && tstzrange(p_start, p_end, '[)')
  ) THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM public.blocked_times bt
    WHERE bt.business_id = p_business_id AND bt.released_at IS NULL
      AND (bt.staff_id IS NULL OR bt.staff_id = p_staff_id)
      AND (bt.location_id IS NULL OR bt.location_id = p_location_id)
      AND tstzrange(bt.starts_at, bt.ends_at, '[)') && tstzrange(p_start, p_end, '[)')
  ) THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM public.staff_time_off t
    WHERE t.business_id = p_business_id AND t.staff_id = p_staff_id AND t.status = 'approved'
      AND tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(p_start, p_end, '[)')
  ) THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM public.calendar_events ce
    JOIN public.calendar_calendars cc ON cc.id = ce.calendar_id AND cc.business_id = ce.business_id
    JOIN public.calendar_connections cn ON cn.id = cc.connection_id AND cn.business_id = ce.business_id
    WHERE ce.business_id = p_business_id AND ce.busy AND NOT ce.cancelled AND ce.origin = 'external'
      AND cc.use_for_availability AND cc.active
      AND (cn.staff_id = p_staff_id OR (cn.staff_id IS NULL AND cn.location_id = p_location_id))
      AND tstzrange(ce.starts_at, ce.ends_at, '[)') && tstzrange(p_start, p_end, '[)')
  ) THEN RETURN false; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION private.is_slot_available(uuid, uuid, uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_slot_available(uuid, uuid, uuid, timestamptz, timestamptz) TO service_role;

-- ============ provision_business ============
CREATE OR REPLACE FUNCTION public.provision_business(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_organization_name text,
  p_business_name text,
  p_business_slug text,
  p_industry text,
  p_timezone text,
  p_currency text,
  p_location_name text,
  p_request_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions
AS $$
DECLARE
  v_org_id uuid;
  v_business_id uuid;
  v_location_id uuid;
  v_staff_id uuid;
  v_booking_page_id uuid;
  v_subscription_id uuid;
  v_plan_id uuid;
  v_existing private.idempotency_records%ROWTYPE;
  v_hash text;
  v_result jsonb;
  v_display_name text;
  v_day smallint;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'authenticated actor required';
  END IF;

  v_hash := encode(digest(concat_ws('|', p_organization_id, p_organization_name, p_business_name, p_business_slug, p_industry, p_timezone, p_currency, p_location_name), 'sha256'), 'hex');

  SELECT * INTO v_existing FROM private.idempotency_records
  WHERE scope = 'provision_business' AND subject_hash = p_actor_user_id::text AND request_key = p_request_key;
  IF FOUND THEN
    IF v_existing.request_hash <> v_hash THEN
      RAISE EXCEPTION 'same request key used with a different payload' USING ERRCODE = 'P0409';
    END IF;
    RETURN v_existing.response_body;
  END IF;

  INSERT INTO private.idempotency_records (scope, subject_hash, request_key, request_hash, status, expires_at)
  VALUES ('provision_business', p_actor_user_id::text, p_request_key, v_hash, 'processing', now() + interval '24 hours');

  IF p_organization_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = p_organization_id AND om.user_id = p_actor_user_id AND om.active
    ) THEN
      RAISE EXCEPTION 'actor is not an administrator of this organization';
    END IF;
    v_org_id := p_organization_id;
    SELECT s.id INTO v_subscription_id FROM subscriptions s
    WHERE s.organization_id = v_org_id AND s.status IN ('trialing','active','past_due','unpaid');
  ELSE
    INSERT INTO organizations (name, slug)
    VALUES (p_organization_name, 'org-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
    RETURNING id INTO v_org_id;
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (v_org_id, p_actor_user_id, 'owner');
    SELECT id INTO v_plan_id FROM subscription_plans WHERE code = 'starter';
    INSERT INTO subscriptions (organization_id, plan_id, status, trial_starts_at, trial_ends_at)
    VALUES (v_org_id, v_plan_id, 'trialing', now(), now() + interval '14 days')
    RETURNING id INTO v_subscription_id;
  END IF;

  INSERT INTO businesses (organization_id, name, slug, industry, timezone, currency, status)
  VALUES (v_org_id, p_business_name, p_business_slug, COALESCE(p_industry, ''), COALESCE(p_timezone, 'America/New_York'), COALESCE(p_currency, 'USD'), 'draft')
  RETURNING id INTO v_business_id;

  INSERT INTO business_members (business_id, user_id, role, all_locations)
  VALUES (v_business_id, p_actor_user_id, 'owner', true);

  INSERT INTO locations (business_id, name, slug, timezone)
  VALUES (v_business_id, p_location_name, 'main', COALESCE(p_timezone, 'America/New_York'))
  RETURNING id INTO v_location_id;

  UPDATE businesses SET default_location_id = v_location_id WHERE id = v_business_id;

  INSERT INTO business_settings (business_id) VALUES (v_business_id);

  SELECT COALESCE(nullif(p.full_name, ''), split_part(u.email, '@', 1), 'Owner')
  INTO v_display_name
  FROM auth.users u LEFT JOIN profiles p ON p.id = u.id
  WHERE u.id = p_actor_user_id;

  INSERT INTO staff_profiles (business_id, user_id, display_name)
  VALUES (v_business_id, p_actor_user_id, COALESCE(v_display_name, 'Owner'))
  RETURNING id INTO v_staff_id;

  INSERT INTO staff_locations (business_id, staff_id, location_id)
  VALUES (v_business_id, v_staff_id, v_location_id);

  FOR v_day IN 1..5 LOOP
    INSERT INTO business_hours (business_id, location_id, iso_weekday, opens_at, closes_at)
    VALUES (v_business_id, v_location_id, v_day, time '09:00', time '17:00');
    INSERT INTO staff_availability (business_id, staff_id, location_id, iso_weekday, opens_at, closes_at)
    VALUES (v_business_id, v_staff_id, v_location_id, v_day, time '09:00', time '17:00');
  END LOOP;

  INSERT INTO booking_pages (business_id, location_id, slug, title, status)
  VALUES (v_business_id, v_location_id, p_business_slug, p_business_name, 'draft')
  RETURNING id INTO v_booking_page_id;

  INSERT INTO integrations (business_id, provider, status)
  VALUES
    (v_business_id, 'google_calendar', 'not_configured'),
    (v_business_id, 'outlook_calendar', 'not_configured'),
    (v_business_id, 'stripe', 'not_configured'),
    (v_business_id, 'twilio', 'not_configured'),
    (v_business_id, 'resend', 'not_configured'),
    (v_business_id, 'voice', 'not_configured'),
    (v_business_id, 'google_booking', 'pending_approval');

  INSERT INTO private.audit_logs (organization_id, business_id, actor_user_id, actor_type, action, entity_type, entity_id, request_id)
  VALUES (v_org_id, v_business_id, p_actor_user_id, 'user', 'business.provisioned', 'business', v_business_id, p_request_key);

  INSERT INTO private.domain_events (business_id, event_type, entity_type, entity_id, idempotency_key)
  VALUES (v_business_id, 'business.created', 'business', v_business_id, 'provision:' || p_request_key::text);

  v_result := jsonb_build_object(
    'organization_id', v_org_id,
    'business_id', v_business_id,
    'location_id', v_location_id,
    'staff_id', v_staff_id,
    'booking_page_id', v_booking_page_id,
    'subscription_id', v_subscription_id
  );

  UPDATE private.idempotency_records
  SET status = 'completed', response_status = 200, response_body = v_result
  WHERE scope = 'provision_business' AND subject_hash = p_actor_user_id::text AND request_key = p_request_key;

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.provision_business(uuid, uuid, text, text, text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_business(uuid, uuid, text, text, text, text, text, text, text, uuid) TO service_role;

-- ============ get_public_booking_page ============
CREATE OR REPLACE FUNCTION public.get_public_booking_page(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'booking_page_id', bp.id,
    'title', bp.title,
    'description', bp.description,
    'accent_color', bp.accent_color,
    'background_color', bp.background_color,
    'instructions', bp.instructions,
    'terms_text', bp.terms_text,
    'cancellation_policy', bp.cancellation_policy,
    'required_customer_fields', bp.required_customer_fields,
    'staff_selection_enabled', bp.staff_selection_enabled,
    'business', jsonb_build_object(
      'name', b.name, 'description', b.description,
      'timezone', b.timezone, 'currency', b.currency, 'accent_color', b.accent_color
    ),
    'location', jsonb_build_object(
      'location_id', l.id, 'name', l.name,
      'address_line1', l.address_line1, 'address_line2', l.address_line2,
      'city', l.city, 'region', l.region, 'postal_code', l.postal_code,
      'country_code', l.country_code, 'timezone', l.timezone
    ),
    'services', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'service_id', s.id,
        'name', s.name,
        'description', s.description,
        'duration_minutes', COALESCE(sloc.duration_override_minutes, s.duration_minutes),
        'price_minor', COALESCE(sloc.price_override_minor, s.price_minor),
        'currency', s.currency,
        'appointment_type', s.appointment_type,
        'capacity', s.capacity,
        'delivery_mode', s.delivery_mode,
        'payment_requirement', s.payment_requirement,
        'deposit_type', s.deposit_type,
        'deposit_value', s.deposit_value,
        'addons', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'addon_id', a.id, 'name', a.name, 'description', a.description,
            'price_minor', a.price_minor,
            'additional_duration_minutes', a.additional_duration_minutes,
            'maximum_quantity', a.maximum_quantity
          ) ORDER BY a.sort_order)
          FROM service_addons a
          WHERE a.business_id = s.business_id AND a.service_id = s.id AND a.active
        ), '[]'::jsonb)
      ) ORDER BY s.sort_order)
      FROM services s
      JOIN service_locations sloc
        ON sloc.business_id = s.business_id AND sloc.service_id = s.id
       AND sloc.location_id = bp.location_id AND sloc.active
      WHERE s.business_id = bp.business_id AND s.active AND s.archived_at IS NULL
    ), '[]'::jsonb),
    'staff', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('staff_id', sp.id, 'display_name', sp.display_name, 'bio', sp.bio))
      FROM staff_profiles sp
      JOIN staff_locations sl2
        ON sl2.business_id = sp.business_id AND sl2.staff_id = sp.id AND sl2.location_id = bp.location_id
      WHERE sp.business_id = bp.business_id AND sp.active AND sp.bookable
    ), '[]'::jsonb)
  ) INTO v_result
  FROM booking_pages bp
  JOIN businesses b ON b.id = bp.business_id
  JOIN locations l ON l.id = bp.location_id AND l.business_id = bp.business_id
  WHERE bp.slug = p_slug AND bp.status = 'published' AND b.status = 'active';

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'booking page not found or not published' USING ERRCODE = 'P0404';
  END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_public_booking_page(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_booking_page(text) TO service_role;

-- ============ get_availability ============
CREATE OR REPLACE FUNCTION public.get_availability(
  p_booking_page_id uuid,
  p_service_id uuid,
  p_from_date date,
  p_through_date date,
  p_staff_id uuid,
  p_addon_quantities jsonb,
  p_seat_count integer
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions
AS $$
DECLARE
  v_page booking_pages%ROWTYPE;
  v_business businesses%ROWTYPE;
  v_settings business_settings%ROWTYPE;
  v_service services%ROWTYPE;
  v_location locations%ROWTYPE;
  v_duration integer;
  v_extra_duration integer := 0;
  v_slots jsonb := '[]'::jsonb;
  v_date date;
  v_staff RECORD;
  v_window RECORD;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_buf_before integer;
  v_buf_after integer;
  v_daily_count integer;
  v_session RECORD;
  v_occupied integer;
  v_earliest timestamptz;
  v_latest date;
BEGIN
  IF p_through_date < p_from_date OR p_through_date > p_from_date + 31 THEN
    RAISE EXCEPTION 'requested date span must be at most 31 days';
  END IF;

  SELECT * INTO v_page FROM booking_pages WHERE id = p_booking_page_id AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'booking page not found or not published' USING ERRCODE = 'P0404'; END IF;
  SELECT * INTO v_business FROM businesses WHERE id = v_page.business_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'business is not active' USING ERRCODE = 'P0404'; END IF;
  SELECT * INTO v_settings FROM business_settings WHERE business_id = v_page.business_id;
  SELECT * INTO v_location FROM locations WHERE id = v_page.location_id AND business_id = v_page.business_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'location is not active' USING ERRCODE = 'P0404'; END IF;
  SELECT * INTO v_service FROM services
  WHERE id = p_service_id AND business_id = v_page.business_id AND active AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'service not found or not active' USING ERRCODE = 'P0404'; END IF;

  SELECT COALESCE(sum((aq->>'quantity')::integer * a.additional_duration_minutes), 0)
  INTO v_extra_duration
  FROM jsonb_array_elements(COALESCE(p_addon_quantities, '[]'::jsonb)) aq
  JOIN service_addons a
    ON a.id = (aq->>'addon_id')::uuid AND a.business_id = v_page.business_id AND a.service_id = v_service.id AND a.active;

  v_duration := COALESCE((
    SELECT sl.duration_override_minutes FROM service_locations sl
    WHERE sl.business_id = v_page.business_id AND sl.service_id = v_service.id
      AND sl.location_id = v_page.location_id AND sl.active
  ), v_service.duration_minutes) + v_extra_duration;

  v_earliest := now() + make_interval(mins => v_settings.minimum_notice_minutes);
  v_latest := (now() AT TIME ZONE v_location.timezone)::date + v_settings.maximum_advance_days;

  FOR v_date IN SELECT generate_series(p_from_date, p_through_date, interval '1 day')::date LOOP
    IF v_date > v_latest THEN CONTINUE; END IF;

    FOR v_staff IN
      SELECT sp.id, sp.buffer_before_minutes, sp.buffer_after_minutes
      FROM staff_profiles sp
      JOIN staff_locations sloc
        ON sloc.business_id = sp.business_id AND sloc.staff_id = sp.id AND sloc.location_id = v_page.location_id
      JOIN staff_services ss
        ON ss.business_id = sp.business_id AND ss.staff_id = sp.id AND ss.service_id = v_service.id AND ss.active
      WHERE sp.business_id = v_page.business_id AND sp.active AND sp.bookable
        AND (p_staff_id IS NULL OR sp.id = p_staff_id)
    LOOP
      v_buf_before := greatest(v_service.buffer_before_minutes, v_staff.buffer_before_minutes);
      v_buf_after := greatest(v_service.buffer_after_minutes, v_staff.buffer_after_minutes);

      FOR v_window IN
        SELECT bh.opens_at AS w_open, bh.closes_at AS w_close
        FROM business_hours bh
        JOIN staff_availability sa
          ON sa.business_id = bh.business_id AND sa.location_id = bh.location_id
         AND sa.iso_weekday = bh.iso_weekday AND sa.active
         AND sa.staff_id = v_staff.id
         AND sa.effective_from <= v_date AND (sa.effective_until IS NULL OR sa.effective_until >= v_date)
         AND sa.opens_at < bh.closes_at AND bh.opens_at < sa.closes_at
        WHERE bh.business_id = v_page.business_id AND bh.location_id = v_page.location_id
          AND bh.iso_weekday = extract(isodow from v_date)::smallint AND bh.active
      LOOP
        v_slot_start := (v_date + v_window.w_open) AT TIME ZONE v_location.timezone;
        WHILE v_slot_start + make_interval(mins => v_duration)
              <= (v_date + v_window.w_close) AT TIME ZONE v_location.timezone LOOP
          v_slot_end := v_slot_start + make_interval(mins => v_duration);

          IF v_slot_start >= v_earliest THEN
            IF v_service.appointment_type = 'individual' THEN
              IF private.is_slot_available(
                v_page.business_id, v_staff.id, v_page.location_id,
                v_slot_start - make_interval(mins => v_buf_before),
                v_slot_end + make_interval(mins => v_buf_after)
              ) THEN
                IF v_settings.maximum_appointments_per_day IS NOT NULL THEN
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
                v_slots := v_slots || jsonb_build_object(
                  'session_id', null, 'staff_id', v_staff.id,
                  'starts_at', v_slot_start, 'ends_at', v_slot_end,
                  'timezone', v_location.timezone, 'remaining_capacity', 1
                );
              END IF;
            ELSE
              -- group service: existing scheduled sessions with remaining capacity
              FOR v_session IN
                SELECT bs.id, bs.staff_id, bs.starts_at, bs.ends_at, bs.capacity
                FROM booking_sessions bs
                WHERE bs.business_id = v_page.business_id
                  AND bs.primary_service_id = v_service.id
                  AND bs.staff_id = v_staff.id
                  AND bs.location_id = v_page.location_id
                  AND bs.session_type = 'group' AND bs.state = 'scheduled'
                  AND bs.starts_at = v_slot_start
                FOR UPDATE OF bs
              LOOP
                SELECT COALESCE(sum(ap.seat_count), 0) + COALESCE((
                  SELECT sum(h.seat_count) FROM appointment_holds h
                  WHERE h.business_id = v_page.business_id AND h.session_id = v_session.id
                    AND h.status = 'active' AND h.expires_at > now()
                ), 0) INTO v_occupied
                FROM appointments ap
                WHERE ap.business_id = v_page.business_id AND ap.session_id = v_session.id
                  AND ap.status IN ('pending','confirmed','checked_in');
                IF v_session.capacity - v_occupied >= COALESCE(p_seat_count, 1) THEN
                  v_slots := v_slots || jsonb_build_object(
                    'session_id', v_session.id, 'staff_id', v_session.staff_id,
                    'starts_at', v_session.starts_at, 'ends_at', v_session.ends_at,
                    'timezone', v_location.timezone,
                    'remaining_capacity', v_session.capacity - v_occupied
                  );
                END IF;
              END LOOP;
              -- brand-new group session at this slot
              IF private.is_slot_available(
                v_page.business_id, v_staff.id, v_page.location_id,
                v_slot_start - make_interval(mins => v_buf_before),
                v_slot_end + make_interval(mins => v_buf_after)
              ) AND v_service.capacity >= COALESCE(p_seat_count, 1) THEN
                v_slots := v_slots || jsonb_build_object(
                  'session_id', null, 'staff_id', v_staff.id,
                  'starts_at', v_slot_start, 'ends_at', v_slot_end,
                  'timezone', v_location.timezone, 'remaining_capacity', v_service.capacity
                );
              END IF;
            END IF;
          END IF;

          v_slot_start := v_slot_start + make_interval(mins => v_settings.slot_interval_minutes);
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN v_slots;
END;
$$;
REVOKE ALL ON FUNCTION public.get_availability(uuid, uuid, date, date, uuid, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_availability(uuid, uuid, date, date, uuid, jsonb, integer) TO service_role;