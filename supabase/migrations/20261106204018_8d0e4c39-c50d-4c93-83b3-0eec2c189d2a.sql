-- ============ expire_holds (shared logic, also scheduled) ============
CREATE OR REPLACE FUNCTION public.expire_holds()
RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions
AS $$
DECLARE
  v_hold RECORD;
  v_count integer := 0;
BEGIN
  FOR v_hold IN
    SELECT h.id, h.business_id, h.session_id
    FROM appointment_holds h
    WHERE h.status = 'active' AND h.expires_at <= now()
    FOR UPDATE OF h SKIP LOCKED
  LOOP
    UPDATE appointment_holds SET status = 'expired' WHERE id = v_hold.id AND business_id = v_hold.business_id;
    UPDATE private.capability_tokens SET revoked_at = now()
    WHERE business_id = v_hold.business_id AND hold_id = v_hold.id AND revoked_at IS NULL;
    -- Release empty individual holding sessions and their reservations
    UPDATE booking_sessions bs SET state = 'cancelled'
    WHERE bs.id = v_hold.session_id AND bs.business_id = v_hold.business_id
      AND bs.state = 'holding' AND bs.session_type = 'individual'
      AND NOT EXISTS (
        SELECT 1 FROM appointment_holds h2
        WHERE h2.business_id = v_hold.business_id AND h2.session_id = v_hold.session_id
          AND h2.status = 'active' AND h2.expires_at > now()
      )
      AND NOT EXISTS (
        SELECT 1 FROM appointments ap
        WHERE ap.business_id = v_hold.business_id AND ap.session_id = v_hold.session_id
          AND ap.status IN ('pending','confirmed','checked_in')
      );
    UPDATE resource_reservations rr SET active = false
    WHERE rr.business_id = v_hold.business_id AND rr.session_id = v_hold.session_id
      AND NOT EXISTS (
        SELECT 1 FROM booking_sessions bs
        WHERE bs.id = v_hold.session_id AND bs.business_id = v_hold.business_id AND bs.state <> 'cancelled'
      );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_holds() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_holds() TO service_role;

-- ============ create_booking_hold ============
CREATE OR REPLACE FUNCTION public.create_booking_hold(
  p_subject_hash text,
  p_booking_page_id uuid,
  p_service_id uuid,
  p_staff_id uuid,
  p_session_id uuid,
  p_starts_at timestamptz,
  p_addon_quantities jsonb,
  p_seat_count integer,
  p_request_key uuid
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
  v_staff_id uuid;
  v_duration integer;
  v_extra_duration integer := 0;
  v_addon_total bigint := 0;
  v_price_minor bigint;
  v_ends_at timestamptz;
  v_buf_before integer;
  v_buf_after integer;
  v_session_id uuid;
  v_hold_id uuid;
  v_token text;
  v_capacity integer;
  v_occupied integer;
  v_existing private.idempotency_records%ROWTYPE;
  v_hash text;
  v_result jsonb;
  v_seats integer := GREATEST(COALESCE(p_seat_count, 1), 1);
BEGIN
  PERFORM private.check_rate_limit('booking_hold', p_subject_hash, 10, 60);
  PERFORM public.expire_holds();

  v_hash := encode(digest(concat_ws('|', p_booking_page_id, p_service_id, p_staff_id, p_session_id, p_starts_at, p_addon_quantities, v_seats), 'sha256'), 'hex');
  SELECT * INTO v_existing FROM private.idempotency_records
  WHERE scope = 'booking_hold' AND subject_hash = p_subject_hash AND request_key = p_request_key;
  IF FOUND THEN
    IF v_existing.request_hash <> v_hash THEN
      RAISE EXCEPTION 'same request key used with a different payload' USING ERRCODE = 'P0409';
    END IF;
    RETURN v_existing.response_body;
  END IF;

  SELECT * INTO v_page FROM booking_pages WHERE id = p_booking_page_id AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'booking page not found or not published' USING ERRCODE = 'P0404'; END IF;
  SELECT * INTO v_business FROM businesses WHERE id = v_page.business_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'business is not active' USING ERRCODE = 'P0404'; END IF;
  SELECT * INTO v_settings FROM business_settings WHERE business_id = v_page.business_id;
  SELECT * INTO v_location FROM locations WHERE id = v_page.location_id AND business_id = v_page.business_id AND active;
  SELECT * INTO v_service FROM services
  WHERE id = p_service_id AND business_id = v_page.business_id AND active AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'service not found or not active' USING ERRCODE = 'P0404'; END IF;

  IF p_starts_at < now() + make_interval(mins => v_settings.minimum_notice_minutes) THEN
    RAISE EXCEPTION 'slot is inside the minimum notice period' USING ERRCODE = 'P0409';
  END IF;
  IF (p_starts_at AT TIME ZONE v_location.timezone)::date > (now() AT TIME ZONE v_location.timezone)::date + v_settings.maximum_advance_days THEN
    RAISE EXCEPTION 'slot is beyond the advance booking window' USING ERRCODE = 'P0409';
  END IF;

  SELECT COALESCE(sum((aq->>'quantity')::integer * a.additional_duration_minutes), 0),
         COALESCE(sum((aq->>'quantity')::integer * a.price_minor), 0)
  INTO v_extra_duration, v_addon_total
  FROM jsonb_array_elements(COALESCE(p_addon_quantities, '[]'::jsonb)) aq
  JOIN service_addons a
    ON a.id = (aq->>'addon_id')::uuid AND a.business_id = v_page.business_id AND a.service_id = v_service.id AND a.active;

  v_price_minor := COALESCE((
    SELECT sl.price_override_minor FROM service_locations sl
    WHERE sl.business_id = v_page.business_id AND sl.service_id = v_service.id
      AND sl.location_id = v_page.location_id AND sl.active
  ), v_service.price_minor) + v_addon_total;

  v_duration := COALESCE((
    SELECT sl.duration_override_minutes FROM service_locations sl
    WHERE sl.business_id = v_page.business_id AND sl.service_id = v_service.id
      AND sl.location_id = v_page.location_id AND sl.active
  ), v_service.duration_minutes) + v_extra_duration;

  v_ends_at := p_starts_at + make_interval(mins => v_duration);

  IF v_service.appointment_type = 'individual' THEN
    -- Pick an eligible staff member when none was requested
    IF p_staff_id IS NOT NULL THEN
      v_staff_id := p_staff_id;
    ELSE
      SELECT sp.id INTO v_staff_id
      FROM staff_profiles sp
      JOIN staff_locations sloc ON sloc.business_id = sp.business_id AND sloc.staff_id = sp.id AND sloc.location_id = v_page.location_id
      JOIN staff_services ss ON ss.business_id = sp.business_id AND ss.staff_id = sp.id AND ss.service_id = v_service.id AND ss.active
      WHERE sp.business_id = v_page.business_id AND sp.active AND sp.bookable
        AND private.is_slot_available(v_page.business_id, sp.id, v_page.location_id,
          p_starts_at - make_interval(mins => greatest(v_service.buffer_before_minutes, sp.buffer_before_minutes)),
          v_ends_at + make_interval(mins => greatest(v_service.buffer_after_minutes, sp.buffer_after_minutes)))
      ORDER BY sp.created_at
      LIMIT 1;
      IF v_staff_id IS NULL THEN
        RAISE EXCEPTION 'no staff member is available at this time' USING ERRCODE = 'P0409';
      END IF;
    END IF;

    SELECT greatest(v_service.buffer_before_minutes, sp.buffer_before_minutes),
           greatest(v_service.buffer_after_minutes, sp.buffer_after_minutes)
    INTO v_buf_before, v_buf_after
    FROM staff_profiles sp WHERE sp.id = v_staff_id AND sp.business_id = v_page.business_id;

    IF NOT private.is_slot_available(v_page.business_id, v_staff_id, v_page.location_id,
        p_starts_at - make_interval(mins => v_buf_before), v_ends_at + make_interval(mins => v_buf_after)) THEN
      RAISE EXCEPTION 'this time is no longer available' USING ERRCODE = 'P0409';
    END IF;

    INSERT INTO booking_sessions (business_id, location_id, primary_service_id, staff_id, starts_at, ends_at, timezone, buffer_before_minutes, buffer_after_minutes, capacity, session_type, state, delivery_mode)
    VALUES (v_page.business_id, v_page.location_id, v_service.id, v_staff_id, p_starts_at, v_ends_at, v_location.timezone, v_buf_before, v_buf_after, 1, 'individual', 'holding', v_service.delivery_mode)
    RETURNING id INTO v_session_id;

    INSERT INTO resource_reservations (business_id, staff_id, session_id, starts_at, ends_at)
    VALUES (v_page.business_id, v_staff_id, v_session_id,
            p_starts_at - make_interval(mins => v_buf_before), v_ends_at + make_interval(mins => v_buf_after));
  ELSE
    -- Group session: reuse or create, lock, check capacity
    IF p_session_id IS NOT NULL THEN
      SELECT bs.id, bs.capacity, bs.staff_id INTO v_session_id, v_capacity, v_staff_id
      FROM booking_sessions bs
      WHERE bs.id = p_session_id AND bs.business_id = v_page.business_id
        AND bs.session_type = 'group' AND bs.state IN ('holding','scheduled')
      FOR UPDATE;
      IF v_session_id IS NULL THEN RAISE EXCEPTION 'group session not found' USING ERRCODE = 'P0404'; END IF;
    ELSE
      IF p_staff_id IS NULL THEN RAISE EXCEPTION 'staff_id is required to open a new group session'; END IF;
      v_staff_id := p_staff_id;
      SELECT greatest(v_service.buffer_before_minutes, sp.buffer_before_minutes),
             greatest(v_service.buffer_after_minutes, sp.buffer_after_minutes)
      INTO v_buf_before, v_buf_after
      FROM staff_profiles sp WHERE sp.id = v_staff_id AND sp.business_id = v_page.business_id;
      IF NOT private.is_slot_available(v_page.business_id, v_staff_id, v_page.location_id,
          p_starts_at - make_interval(mins => v_buf_before), v_ends_at + make_interval(mins => v_buf_after)) THEN
        RAISE EXCEPTION 'this time is no longer available' USING ERRCODE = 'P0409';
      END IF;
      INSERT INTO booking_sessions (business_id, location_id, primary_service_id, staff_id, starts_at, ends_at, timezone, buffer_before_minutes, buffer_after_minutes, capacity, session_type, state, delivery_mode)
      VALUES (v_page.business_id, v_page.location_id, v_service.id, v_staff_id, p_starts_at, v_ends_at, v_location.timezone, v_buf_before, v_buf_after, v_service.capacity, 'group', 'holding', v_service.delivery_mode)
      RETURNING id INTO v_session_id;
      INSERT INTO resource_reservations (business_id, staff_id, session_id, starts_at, ends_at)
      VALUES (v_page.business_id, v_staff_id, v_session_id,
              p_starts_at - make_interval(mins => v_buf_before), v_ends_at + make_interval(mins => v_buf_after));
      v_capacity := v_service.capacity;
    END IF;

    SELECT COALESCE((SELECT sum(ap.seat_count) FROM appointments ap
        WHERE ap.business_id = v_page.business_id AND ap.session_id = v_session_id
          AND ap.status IN ('pending','confirmed','checked_in')), 0)
         + COALESCE((SELECT sum(h.seat_count) FROM appointment_holds h
        WHERE h.business_id = v_page.business_id AND h.session_id = v_session_id
          AND h.status = 'active' AND h.expires_at > now()), 0)
    INTO v_occupied;
    IF v_capacity - v_occupied < v_seats THEN
      RAISE EXCEPTION 'not enough remaining capacity in this session' USING ERRCODE = 'P0409';
    END IF;
  END IF;

  INSERT INTO appointment_holds (business_id, session_id, seat_count, expires_at, price_snapshot, request_fingerprint)
  VALUES (v_page.business_id, v_session_id, v_seats, now() + interval '10 minutes',
          jsonb_build_object('service_id', v_service.id, 'price_minor', v_price_minor, 'currency', v_service.currency,
                             'duration_minutes', v_duration, 'addon_total_minor', v_addon_total, 'seat_count', v_seats),
          encode(digest(concat_ws('|', p_subject_hash, p_request_key), 'sha256'), 'hex'))
  RETURNING id INTO v_hold_id;

  v_token := private.generate_capability_token();
  INSERT INTO private.capability_tokens (business_id, kind, hold_id, token_hash, expires_at)
  VALUES (v_page.business_id, 'booking_hold', v_hold_id, digest(v_token, 'sha256'), now() + interval '10 minutes');

  v_result := jsonb_build_object(
    'hold_id', v_hold_id,
    'hold_token', v_token,
    'expires_at', now() + interval '10 minutes',
    'session_id', v_session_id,
    'staff_id', v_staff_id,
    'price', jsonb_build_object('price_minor', v_price_minor, 'currency', v_service.currency, 'duration_minutes', v_duration)
  );

  INSERT INTO private.idempotency_records (business_id, scope, subject_hash, request_key, request_hash, status, response_status, response_body, expires_at)
  VALUES (v_page.business_id, 'booking_hold', p_subject_hash, p_request_key, v_hash, 'completed', 200,
          v_result - 'hold_token', now() + interval '24 hours');

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.create_booking_hold(text, uuid, uuid, uuid, uuid, timestamptz, jsonb, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_hold(text, uuid, uuid, uuid, uuid, timestamptz, jsonb, integer, uuid) TO service_role;

-- ============ confirm_booking ============
CREATE OR REPLACE FUNCTION public.confirm_booking(
  p_subject_hash text,
  p_hold_token text,
  p_actor_user_id uuid,
  p_customer_id uuid,
  p_contact jsonb,
  p_customer_notes text,
  p_consent_decisions jsonb,
  p_request_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions
AS $$
DECLARE
  v_token_row private.capability_tokens%ROWTYPE;
  v_hold appointment_holds%ROWTYPE;
  v_session booking_sessions%ROWTYPE;
  v_service services%ROWTYPE;
  v_settings business_settings%ROWTYPE;
  v_customer_id uuid;
  v_appointment_id uuid;
  v_manage_token text;
  v_status text;
  v_email text;
  v_existing private.idempotency_records%ROWTYPE;
  v_hash text;
  v_result jsonb;
  v_occupied integer;
  v_consent jsonb;
  v_payment_status text;
  v_address jsonb;
BEGIN
  PERFORM private.check_rate_limit('booking_confirm', p_subject_hash, 10, 600);

  v_hash := encode(digest(concat_ws('|', p_hold_token, p_customer_id, p_contact, p_customer_notes), 'sha256'), 'hex');
  SELECT * INTO v_existing FROM private.idempotency_records
  WHERE scope = 'booking_confirm' AND subject_hash = p_subject_hash AND request_key = p_request_key;
  IF FOUND THEN
    IF v_existing.request_hash <> v_hash THEN
      RAISE EXCEPTION 'same request key used with a different payload' USING ERRCODE = 'P0409';
    END IF;
    RETURN v_existing.response_body;
  END IF;

  SELECT * INTO v_token_row FROM private.capability_tokens
  WHERE kind = 'booking_hold' AND token_hash = digest(p_hold_token, 'sha256');
  IF NOT FOUND OR v_token_row.revoked_at IS NOT NULL OR v_token_row.expires_at <= now() THEN
    RAISE EXCEPTION 'hold token is missing, expired, or revoked' USING ERRCODE = 'P0403';
  END IF;

  SELECT * INTO v_hold FROM appointment_holds
  WHERE id = v_token_row.hold_id AND business_id = v_token_row.business_id
  FOR UPDATE;
  IF NOT FOUND OR v_hold.status <> 'active' OR v_hold.expires_at <= now() THEN
    RAISE EXCEPTION 'hold is no longer active' USING ERRCODE = 'P0409';
  END IF;

  SELECT * INTO v_session FROM booking_sessions
  WHERE id = v_hold.session_id AND business_id = v_hold.business_id
  FOR UPDATE;
  IF NOT FOUND OR v_session.state = 'cancelled' THEN
    RAISE EXCEPTION 'session is no longer available' USING ERRCODE = 'P0409';
  END IF;

  SELECT * INTO v_service FROM services WHERE id = v_session.primary_service_id AND business_id = v_hold.business_id;
  SELECT * INTO v_settings FROM business_settings WHERE business_id = v_hold.business_id;

  -- Recheck group capacity
  IF v_session.session_type = 'group' THEN
    SELECT COALESCE((SELECT sum(ap.seat_count) FROM appointments ap
        WHERE ap.business_id = v_hold.business_id AND ap.session_id = v_session.id
          AND ap.status IN ('pending','confirmed','checked_in')), 0)
         + COALESCE((SELECT sum(h.seat_count) FROM appointment_holds h
        WHERE h.business_id = v_hold.business_id AND h.session_id = v_session.id
          AND h.status = 'active' AND h.expires_at > now() AND h.id <> v_hold.id), 0)
    INTO v_occupied;
    IF v_session.capacity - v_occupied < v_hold.seat_count THEN
      RAISE EXCEPTION 'session capacity is no longer available' USING ERRCODE = 'P0409';
    END IF;
  END IF;

  -- Payment requirement: without a configured provider, never claim success
  IF v_service.payment_requirement IN ('deposit','full') THEN
    IF NOT EXISTS (
      SELECT 1 FROM integrations i
      WHERE i.business_id = v_hold.business_id AND i.provider = 'stripe' AND i.status = 'connected'
    ) THEN
      RAISE EXCEPTION 'payment is required for this service but no payment provider is configured' USING ERRCODE = 'P0402';
    END IF;
  END IF;

  -- Customer: dashboard actors may supply a known customer; guests match by email within this business only
  IF p_customer_id IS NOT NULL THEN
    IF p_actor_user_id IS NULL OR NOT private.business_permission(v_hold.business_id, 'can_manage_customers') THEN
      RAISE EXCEPTION 'guest clients cannot select a customer record' USING ERRCODE = 'P0403';
    END IF;
    SELECT c.id INTO v_customer_id FROM customers c
    WHERE c.id = p_customer_id AND c.business_id = v_hold.business_id AND c.status = 'active';
    IF v_customer_id IS NULL THEN RAISE EXCEPTION 'customer not found in this business' USING ERRCODE = 'P0404'; END IF;
  ELSE
    v_email := nullif(lower(btrim(COALESCE(p_contact->>'email', ''))), '');
    IF v_email IS NOT NULL THEN
      SELECT c.id INTO v_customer_id FROM customers c
      WHERE c.business_id = v_hold.business_id AND c.normalized_email = v_email AND c.status = 'active';
    END IF;
    IF v_customer_id IS NULL THEN
      INSERT INTO customers (business_id, full_name, email, phone_e164, source)
      VALUES (v_hold.business_id,
              COALESCE(nullif(btrim(p_contact->>'full_name'), ''), 'Guest'),
              nullif(btrim(p_contact->>'email'), ''),
              nullif(btrim(p_contact->>'phone_e164'), ''),
              'booking_page')
      RETURNING id INTO v_customer_id;
    END IF;
  END IF;

  v_address := p_contact->'address';
  v_status := CASE WHEN v_settings.manual_approval_required THEN 'pending' ELSE 'confirmed' END;
  v_payment_status := CASE WHEN v_service.payment_requirement = 'pay_later' AND (v_hold.price_snapshot->>'price_minor')::bigint = 0
                           THEN 'not_required' ELSE 'unpaid' END;

  INSERT INTO appointments (business_id, session_id, customer_id, seat_count, status, source, customer_notes, customer_address,
                            currency, subtotal_minor, total_minor, amount_due_now_minor, payment_status, created_by_user_id)
  VALUES (v_hold.business_id, v_session.id, v_customer_id, v_hold.seat_count, v_status, 'booking_page',
          COALESCE(p_customer_notes, ''), v_address,
          v_hold.price_snapshot->>'currency',
          (v_hold.price_snapshot->>'price_minor')::bigint,
          (v_hold.price_snapshot->>'price_minor')::bigint,
          0, v_payment_status, p_actor_user_id)
  RETURNING id INTO v_appointment_id;

  INSERT INTO appointment_services (business_id, appointment_id, service_id, sequence, service_name, duration_minutes, unit_price_minor, quantity, line_total_minor)
  VALUES (v_hold.business_id, v_appointment_id, v_service.id, 1, v_service.name,
          (v_hold.price_snapshot->>'duration_minutes')::integer,
          v_service.price_minor, 1, (v_hold.price_snapshot->>'price_minor')::bigint);

  UPDATE appointment_holds SET status = 'consumed', consumed_appointment_id = v_appointment_id
  WHERE id = v_hold.id AND business_id = v_hold.business_id;
  UPDATE private.capability_tokens SET last_used_at = now(), revoked_at = now() WHERE id = v_token_row.id;

  IF v_session.session_type = 'individual' THEN
    UPDATE booking_sessions SET state = 'scheduled' WHERE id = v_session.id AND business_id = v_hold.business_id;
  ELSE
    UPDATE booking_sessions SET state = 'scheduled' WHERE id = v_session.id AND business_id = v_hold.business_id AND state = 'holding';
  END IF;

  -- Management capability: expires 30 days after the appointment ends
  v_manage_token := private.generate_capability_token();
  INSERT INTO private.capability_tokens (business_id, kind, appointment_id, token_hash, expires_at)
  VALUES (v_hold.business_id, 'appointment_manage', v_appointment_id, digest(v_manage_token, 'sha256'), v_session.ends_at + interval '30 days');

  -- Consent decisions
  FOR v_consent IN SELECT * FROM jsonb_array_elements(COALESCE(p_consent_decisions, '[]'::jsonb)) LOOP
    INSERT INTO customer_consents (business_id, customer_id, channel, purpose, decision, source, disclosure_text, disclosure_version)
    VALUES (v_hold.business_id, v_customer_id,
            v_consent->>'channel', v_consent->>'purpose', v_consent->>'decision',
            'booking_page', COALESCE(v_consent->>'disclosure_text', ''), COALESCE(v_consent->>'disclosure_version', '1'));
  END LOOP;

  INSERT INTO appointment_status_history (business_id, appointment_id, from_status, to_status, actor_user_id, actor_type)
  VALUES (v_hold.business_id, v_appointment_id, NULL, v_status, p_actor_user_id,
          CASE WHEN p_actor_user_id IS NULL THEN 'customer_token' ELSE 'user' END);

  INSERT INTO private.domain_events (business_id, event_type, entity_type, entity_id, payload, idempotency_key)
  VALUES (v_hold.business_id, 'booking.created', 'appointment', v_appointment_id,
          jsonb_build_object('session_id', v_session.id, 'status', v_status),
          'booking:' || p_request_key::text);

  INSERT INTO private.audit_logs (business_id, actor_user_id, actor_type, action, entity_type, entity_id, request_id)
  VALUES (v_hold.business_id, p_actor_user_id,
          CASE WHEN p_actor_user_id IS NULL THEN 'customer_token' ELSE 'user' END,
          'appointment.created', 'appointment', v_appointment_id, p_request_key);

  v_result := jsonb_build_object(
    'appointment_id', v_appointment_id,
    'status', v_status,
    'management_token', v_manage_token,
    'summary', jsonb_build_object(
      'starts_at', v_session.starts_at, 'ends_at', v_session.ends_at,
      'timezone', v_session.timezone, 'service_name', v_service.name,
      'total_minor', (v_hold.price_snapshot->>'price_minor')::bigint,
      'currency', v_hold.price_snapshot->>'currency'
    )
  );

  INSERT INTO private.idempotency_records (business_id, scope, subject_hash, request_key, request_hash, status, response_status, response_body, expires_at)
  VALUES (v_hold.business_id, 'booking_confirm', p_subject_hash, p_request_key, v_hash, 'completed', 200,
          v_result - 'management_token', now() + interval '24 hours');

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_booking(text, text, uuid, uuid, jsonb, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_booking(text, text, uuid, uuid, jsonb, text, jsonb, uuid) TO service_role;

-- ============ get_managed_appointment ============
CREATE OR REPLACE FUNCTION public.get_managed_appointment(p_subject_hash text, p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions
AS $$
DECLARE
  v_token_row private.capability_tokens%ROWTYPE;
  v_result jsonb;
BEGIN
  PERFORM private.check_rate_limit('manage_token', p_subject_hash, 20, 600);

  SELECT * INTO v_token_row FROM private.capability_tokens
  WHERE kind = 'appointment_manage' AND token_hash = digest(p_token, 'sha256');
  IF NOT FOUND OR v_token_row.revoked_at IS NOT NULL OR v_token_row.expires_at <= now() THEN
    RAISE EXCEPTION 'management token is missing, expired, or revoked' USING ERRCODE = 'P0403';
  END IF;

  UPDATE private.capability_tokens SET last_used_at = now() WHERE id = v_token_row.id;

  SELECT jsonb_build_object(
    'appointment_id', ap.id,
    'status', ap.status,
    'row_version', ap.row_version,
    'starts_at', bs.starts_at,
    'ends_at', bs.ends_at,
    'timezone', bs.timezone,
    'services', (SELECT jsonb_agg(jsonb_build_object('name', aps.service_name, 'duration_minutes', aps.duration_minutes, 'line_total_minor', aps.line_total_minor) ORDER BY aps.sequence)
                 FROM appointment_services aps WHERE aps.appointment_id = ap.id AND aps.business_id = ap.business_id),
    'total_minor', ap.total_minor,
    'currency', ap.currency,
    'payment_status', ap.payment_status,
    'cancellation_policy', COALESCE(st.cancellation_policy, ''),
    'allowed_actions', jsonb_build_object(
      'can_reschedule', ap.status IN ('pending','confirmed') AND bs.starts_at > now() + make_interval(mins => st.reschedule_notice_minutes),
      'can_cancel', ap.status IN ('pending','confirmed') AND bs.starts_at > now() + make_interval(mins => st.cancellation_notice_minutes)
    )
  ) INTO v_result
  FROM appointments ap
  JOIN booking_sessions bs ON bs.id = ap.session_id AND bs.business_id = ap.business_id
  JOIN business_settings st ON st.business_id = ap.business_id
  WHERE ap.id = v_token_row.appointment_id AND ap.business_id = v_token_row.business_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'appointment not found' USING ERRCODE = 'P0404';
  END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_managed_appointment(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_managed_appointment(text, text) TO service_role;

-- ============ reschedule_appointment ============
CREATE OR REPLACE FUNCTION public.reschedule_appointment(
  p_subject_hash text,
  p_appointment_id uuid,
  p_new_starts_at timestamptz,
  p_management_token text,
  p_actor_user_id uuid,
  p_expected_row_version bigint,
  p_request_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions
AS $$
DECLARE
  v_ap appointments%ROWTYPE;
  v_session booking_sessions%ROWTYPE;
  v_settings business_settings%ROWTYPE;
  v_authorized boolean := false;
  v_duration interval;
  v_new_ends timestamptz;
BEGIN
  PERFORM private.check_rate_limit('manage_token', p_subject_hash, 20, 600);

  SELECT * INTO v_ap FROM appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'appointment not found' USING ERRCODE = 'P0404'; END IF;

  IF p_management_token IS NOT NULL THEN
    v_authorized := EXISTS (
      SELECT 1 FROM private.capability_tokens ct
      WHERE ct.kind = 'appointment_manage' AND ct.appointment_id = v_ap.id AND ct.business_id = v_ap.business_id
        AND ct.token_hash = digest(p_management_token, 'sha256')
        AND ct.revoked_at IS NULL AND ct.expires_at > now()
    );
  END IF;
  IF NOT v_authorized AND p_actor_user_id IS NOT NULL THEN
    v_authorized := private.has_business_access(v_ap.business_id);
  END IF;
  IF NOT v_authorized THEN
    RAISE EXCEPTION 'not authorized to reschedule this appointment' USING ERRCODE = 'P0403';
  END IF;

  IF v_ap.row_version <> p_expected_row_version THEN
    RAISE EXCEPTION 'appointment was modified; refresh and retry' USING ERRCODE = 'P0409';
  END IF;
  IF v_ap.status NOT IN ('pending','confirmed') THEN
    RAISE EXCEPTION 'only pending or confirmed appointments can be rescheduled' USING ERRCODE = 'P0409';
  END IF;

  SELECT * INTO v_session FROM booking_sessions WHERE id = v_ap.session_id AND business_id = v_ap.business_id FOR UPDATE;
  SELECT * INTO v_settings FROM business_settings WHERE business_id = v_ap.business_id;

  IF v_session.starts_at < now() + make_interval(mins => v_settings.reschedule_notice_minutes) THEN
    RAISE EXCEPTION 'inside the rescheduling notice period' USING ERRCODE = 'P0409';
  END IF;

  v_duration := v_session.ends_at - v_session.starts_at;
  v_new_ends := p_new_starts_at + v_duration;

  IF v_session.session_type = 'individual' THEN
    IF NOT private.is_slot_available(v_ap.business_id, v_session.staff_id, v_session.location_id,
        p_new_starts_at - make_interval(mins => v_session.buffer_before_minutes),
        v_new_ends + make_interval(mins => v_session.buffer_after_minutes)) THEN
      RAISE EXCEPTION 'the new time is not available; the original booking is unchanged' USING ERRCODE = 'P0409';
    END IF;
    UPDATE resource_reservations SET active = false
    WHERE business_id = v_ap.business_id AND session_id = v_session.id AND active;
    UPDATE booking_sessions SET starts_at = p_new_starts_at, ends_at = v_new_ends
    WHERE id = v_session.id AND business_id = v_ap.business_id;
    INSERT INTO resource_reservations (business_id, staff_id, session_id, starts_at, ends_at)
    VALUES (v_ap.business_id, v_session.staff_id, v_session.id,
            p_new_starts_at - make_interval(mins => v_session.buffer_before_minutes),
            v_new_ends + make_interval(mins => v_session.buffer_after_minutes));
  ELSE
    RAISE EXCEPTION 'group attendee rescheduling requires a target session; use the backend flow' USING ERRCODE = 'P0409';
  END IF;

  INSERT INTO appointment_status_history (business_id, appointment_id, from_status, to_status, actor_user_id, actor_type, reason)
  VALUES (v_ap.business_id, v_ap.id, v_ap.status, v_ap.status, p_actor_user_id,
          CASE WHEN p_actor_user_id IS NULL THEN 'customer_token' ELSE 'user' END, 'rescheduled');

  INSERT INTO private.domain_events (business_id, event_type, entity_type, entity_id, payload, idempotency_key)
  VALUES (v_ap.business_id, 'booking.rescheduled', 'appointment', v_ap.id,
          jsonb_build_object('new_starts_at', p_new_starts_at), 'reschedule:' || p_request_key::text);

  INSERT INTO private.audit_logs (business_id, actor_user_id, actor_type, action, entity_type, entity_id, request_id, changes)
  VALUES (v_ap.business_id, p_actor_user_id,
          CASE WHEN p_actor_user_id IS NULL THEN 'customer_token' ELSE 'user' END,
          'appointment.rescheduled', 'appointment', v_ap.id, p_request_key,
          jsonb_build_object('old_starts_at', v_session.starts_at, 'new_starts_at', p_new_starts_at));

  RETURN jsonb_build_object('appointment_id', v_ap.id, 'starts_at', p_new_starts_at, 'ends_at', v_new_ends, 'status', v_ap.status);
END;
$$;
REVOKE ALL ON FUNCTION public.reschedule_appointment(text, uuid, timestamptz, text, uuid, bigint, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment(text, uuid, timestamptz, text, uuid, bigint, uuid) TO service_role;

-- ============ cancel_appointment ============
CREATE OR REPLACE FUNCTION public.cancel_appointment(
  p_subject_hash text,
  p_appointment_id uuid,
  p_reason text,
  p_management_token text,
  p_actor_user_id uuid,
  p_expected_row_version bigint,
  p_request_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions
AS $$
DECLARE
  v_ap appointments%ROWTYPE;
  v_session booking_sessions%ROWTYPE;
  v_settings business_settings%ROWTYPE;
  v_authorized boolean := false;
BEGIN
  PERFORM private.check_rate_limit('manage_token', p_subject_hash, 20, 600);

  SELECT * INTO v_ap FROM appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'appointment not found' USING ERRCODE = 'P0404'; END IF;

  IF p_management_token IS NOT NULL THEN
    v_authorized := EXISTS (
      SELECT 1 FROM private.capability_tokens ct
      WHERE ct.kind = 'appointment_manage' AND ct.appointment_id = v_ap.id AND ct.business_id = v_ap.business_id
        AND ct.token_hash = digest(p_management_token, 'sha256')
        AND ct.revoked_at IS NULL AND ct.expires_at > now()
    );
  END IF;
  IF NOT v_authorized AND p_actor_user_id IS NOT NULL THEN
    v_authorized := private.has_business_access(v_ap.business_id);
  END IF;
  IF NOT v_authorized THEN
    RAISE EXCEPTION 'not authorized to cancel this appointment' USING ERRCODE = 'P0403';
  END IF;

  IF v_ap.row_version <> p_expected_row_version THEN
    RAISE EXCEPTION 'appointment was modified; refresh and retry' USING ERRCODE = 'P0409';
  END IF;
  IF v_ap.status NOT IN ('pending','confirmed') THEN
    RAISE EXCEPTION 'only pending or confirmed appointments can be cancelled' USING ERRCODE = 'P0409';
  END IF;

  SELECT * INTO v_session FROM booking_sessions WHERE id = v_ap.session_id AND business_id = v_ap.business_id FOR UPDATE;
  SELECT * INTO v_settings FROM business_settings WHERE business_id = v_ap.business_id;

  IF v_session.starts_at < now() + make_interval(mins => v_settings.cancellation_notice_minutes) THEN
    RAISE EXCEPTION 'inside the cancellation notice period' USING ERRCODE = 'P0409';
  END IF;

  UPDATE appointments SET status = 'cancelled', cancelled_at = now(), cancelled_by_user_id = p_actor_user_id,
         cancellation_reason = COALESCE(p_reason, '')
  WHERE id = v_ap.id AND business_id = v_ap.business_id;

  IF v_session.session_type = 'individual' THEN
    UPDATE booking_sessions SET state = 'cancelled' WHERE id = v_session.id AND business_id = v_ap.business_id;
    UPDATE resource_reservations SET active = false
    WHERE business_id = v_ap.business_id AND session_id = v_session.id AND active;
  END IF;
  -- Group sessions stay reserved; only the attendee's seats are released.

  INSERT INTO appointment_status_history (business_id, appointment_id, from_status, to_status, actor_user_id, actor_type, reason)
  VALUES (v_ap.business_id, v_ap.id, 'confirmed', 'cancelled', p_actor_user_id,
          CASE WHEN p_actor_user_id IS NULL THEN 'customer_token' ELSE 'user' END, COALESCE(p_reason, ''));

  INSERT INTO private.domain_events (business_id, event_type, entity_type, entity_id, idempotency_key)
  VALUES (v_ap.business_id, 'booking.cancelled', 'appointment', v_ap.id, 'cancel:' || p_request_key::text);

  INSERT INTO private.audit_logs (business_id, actor_user_id, actor_type, action, entity_type, entity_id, request_id)
  VALUES (v_ap.business_id, p_actor_user_id,
          CASE WHEN p_actor_user_id IS NULL THEN 'customer_token' ELSE 'user' END,
          'appointment.cancelled', 'appointment', v_ap.id, p_request_key);

  RETURN jsonb_build_object('appointment_id', v_ap.id, 'status', 'cancelled');
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_appointment(text, uuid, text, text, uuid, bigint, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment(text, uuid, text, text, uuid, bigint, uuid) TO service_role;