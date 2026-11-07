CREATE OR REPLACE FUNCTION public.provision_business(p_actor_user_id uuid, p_organization_id uuid, p_organization_name text, p_business_name text, p_business_slug text, p_industry text, p_timezone text, p_currency text, p_location_name text, p_request_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
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
        AND om.role IN ('owner','admin')
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

  SELECT nullif(btrim(pr.full_name), '') INTO v_display_name
  FROM profiles pr WHERE pr.id = p_actor_user_id;

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
$function$;

CREATE OR REPLACE FUNCTION public.reschedule_appointment(p_subject_hash text, p_appointment_id uuid, p_new_starts_at timestamp with time zone, p_management_token text, p_actor_user_id uuid, p_expected_row_version bigint, p_request_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
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
    v_authorized := private.actor_has_business_access(v_ap.business_id, p_actor_user_id);
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
    -- Exclude this appointment's own reservation from the overlap check; any failure rolls back.
    UPDATE resource_reservations SET active = false
    WHERE business_id = v_ap.business_id AND session_id = v_session.id AND staff_id = v_session.staff_id;
    IF NOT private.is_slot_available(v_ap.business_id, v_session.staff_id, v_session.location_id,
        p_new_starts_at - make_interval(mins => v_session.buffer_before_minutes),
        v_new_ends + make_interval(mins => v_session.buffer_after_minutes)) THEN
      RAISE EXCEPTION 'the new time is not available; the original booking is unchanged' USING ERRCODE = 'P0409';
    END IF;
    UPDATE booking_sessions SET starts_at = p_new_starts_at, ends_at = v_new_ends
    WHERE id = v_session.id AND business_id = v_ap.business_id;
    BEGIN
      UPDATE resource_reservations
      SET starts_at = p_new_starts_at - make_interval(mins => v_session.buffer_before_minutes),
          ends_at = v_new_ends + make_interval(mins => v_session.buffer_after_minutes),
          active = true
      WHERE business_id = v_ap.business_id AND session_id = v_session.id AND staff_id = v_session.staff_id;
    EXCEPTION WHEN exclusion_violation THEN
      RAISE EXCEPTION 'the new time is not available; the original booking is unchanged' USING ERRCODE = 'P0409';
    END;
    IF NOT FOUND THEN
      INSERT INTO resource_reservations (business_id, staff_id, session_id, starts_at, ends_at)
      VALUES (v_ap.business_id, v_session.staff_id, v_session.id,
              p_new_starts_at - make_interval(mins => v_session.buffer_before_minutes),
              v_new_ends + make_interval(mins => v_session.buffer_after_minutes));
    END IF;
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
$function$;

REVOKE ALL ON FUNCTION public.provision_business(uuid,uuid,text,text,text,text,text,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_business(uuid,uuid,text,text,text,text,text,text,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.reschedule_appointment(text,uuid,timestamptz,text,uuid,bigint,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment(text,uuid,timestamptz,text,uuid,bigint,uuid) TO service_role;