-- ============ create_blocked_time ============
CREATE OR REPLACE FUNCTION public.create_blocked_time(
  p_actor_user_id uuid,
  p_business_id uuid,
  p_location_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions
AS $$
DECLARE
  v_block_id uuid;
  v_staff RECORD;
BEGIN
  IF p_actor_user_id IS NULL OR private.business_member_role(p_business_id) IS DISTINCT FROM 'owner'
     AND NOT (private.business_member_role(p_business_id) = 'manager')
     AND NOT private.is_org_admin_for_business(p_business_id) THEN
    RAISE EXCEPTION 'only owners and managers can create blocked time' USING ERRCODE = 'P0403';
  END IF;
  IF p_location_id IS NOT NULL AND NOT private.has_location_access(p_business_id, p_location_id) THEN
    RAISE EXCEPTION 'no access to this location' USING ERRCODE = 'P0403';
  END IF;
  IF p_starts_at >= p_ends_at THEN
    RAISE EXCEPTION 'starts_at must be before ends_at';
  END IF;

  -- Reject blocks that conflict with existing active appointments
  IF EXISTS (
    SELECT 1 FROM appointments ap
    JOIN booking_sessions bs ON bs.id = ap.session_id AND bs.business_id = ap.business_id
    WHERE ap.business_id = p_business_id
      AND ap.status IN ('pending','confirmed','checked_in')
      AND (p_staff_id IS NULL OR bs.staff_id = p_staff_id)
      AND (p_location_id IS NULL OR bs.location_id = p_location_id)
      AND tstzrange(bs.starts_at, bs.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'blocked time conflicts with an existing appointment' USING ERRCODE = 'P0409';
  END IF;

  INSERT INTO blocked_times (business_id, location_id, staff_id, starts_at, ends_at, reason, created_by_user_id)
  VALUES (p_business_id, p_location_id, p_staff_id, p_starts_at, p_ends_at, COALESCE(p_reason, ''), p_actor_user_id)
  RETURNING id INTO v_block_id;

  -- Reservation rows for every affected staff member
  FOR v_staff IN
    SELECT sp.id FROM staff_profiles sp
    WHERE sp.business_id = p_business_id AND sp.active
      AND (p_staff_id IS NULL OR sp.id = p_staff_id)
      AND (p_location_id IS NULL OR EXISTS (
        SELECT 1 FROM staff_locations sl
        WHERE sl.business_id = p_business_id AND sl.staff_id = sp.id AND sl.location_id = p_location_id
      ))
  LOOP
    INSERT INTO resource_reservations (business_id, staff_id, blocked_time_id, starts_at, ends_at)
    VALUES (p_business_id, v_staff.id, v_block_id, p_starts_at, p_ends_at)
    ON CONFLICT ON CONSTRAINT resource_reservations_block_uidx DO NOTHING;
  END LOOP;

  INSERT INTO private.audit_logs (business_id, actor_user_id, actor_type, action, entity_type, entity_id, request_id)
  VALUES (p_business_id, p_actor_user_id, 'user', 'blocked_time.created', 'blocked_time', v_block_id, gen_random_uuid());

  RETURN jsonb_build_object('blocked_time_id', v_block_id);
END;
$$;
REVOKE ALL ON FUNCTION public.create_blocked_time(uuid, uuid, uuid, uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_blocked_time(uuid, uuid, uuid, uuid, timestamptz, timestamptz, text) TO service_role;

-- ============ release_blocked_time ============
CREATE OR REPLACE FUNCTION public.release_blocked_time(
  p_actor_user_id uuid,
  p_blocked_time_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions
AS $$
DECLARE
  v_block blocked_times%ROWTYPE;
BEGIN
  SELECT * INTO v_block FROM blocked_times WHERE id = p_blocked_time_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'blocked time not found' USING ERRCODE = 'P0404'; END IF;
  IF p_actor_user_id IS NULL OR NOT (
    private.business_member_role(v_block.business_id) IN ('owner','manager')
    OR private.is_org_admin_for_business(v_block.business_id)
  ) THEN
    RAISE EXCEPTION 'only owners and managers can release blocked time' USING ERRCODE = 'P0403';
  END IF;

  UPDATE blocked_times SET released_at = now() WHERE id = v_block.id AND business_id = v_block.business_id;
  UPDATE resource_reservations SET active = false
  WHERE business_id = v_block.business_id AND blocked_time_id = v_block.id AND active;

  INSERT INTO private.audit_logs (business_id, actor_user_id, actor_type, action, entity_type, entity_id, request_id)
  VALUES (v_block.business_id, p_actor_user_id, 'user', 'blocked_time.released', 'blocked_time', v_block.id, gen_random_uuid());

  RETURN jsonb_build_object('blocked_time_id', v_block.id, 'released', true);
END;
$$;
REVOKE ALL ON FUNCTION public.release_blocked_time(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_blocked_time(uuid, uuid) TO service_role;

-- ============ submit_public_form ============
CREATE OR REPLACE FUNCTION public.submit_public_form(
  p_subject_hash text,
  p_form_slug text,
  p_form_version_id uuid,
  p_answers jsonb,
  p_request_key uuid,
  p_honeypot text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions
AS $$
DECLARE
  v_form forms%ROWTYPE;
  v_version form_versions%ROWTYPE;
  v_field RECORD;
  v_customer_id uuid;
  v_submission_id uuid;
  v_email text;
  v_name text;
  v_phone text;
  v_existing private.idempotency_records%ROWTYPE;
  v_hash text;
  v_result jsonb;
BEGIN
  PERFORM private.check_rate_limit('form_submit', p_subject_hash, 5, 600);

  -- Honeypot: silently accept but quarantine
  IF p_honeypot IS NOT NULL AND p_honeypot <> '' THEN
    RETURN jsonb_build_object('received', true);
  END IF;

  v_hash := encode(digest(concat_ws('|', p_form_slug, p_form_version_id, p_answers), 'sha256'), 'hex');
  SELECT * INTO v_existing FROM private.idempotency_records
  WHERE scope = 'form_submit' AND subject_hash = p_subject_hash AND request_key = p_request_key;
  IF FOUND THEN
    IF v_existing.request_hash <> v_hash THEN
      RAISE EXCEPTION 'same request key used with a different payload' USING ERRCODE = 'P0409';
    END IF;
    RETURN v_existing.response_body;
  END IF;

  SELECT * INTO v_form FROM forms WHERE slug = p_form_slug AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'form not found or not published' USING ERRCODE = 'P0404'; END IF;
  IF v_form.active_version_id IS DISTINCT FROM p_form_version_id THEN
    RAISE EXCEPTION 'submission must target the active published version' USING ERRCODE = 'P0409';
  END IF;
  SELECT * INTO v_version FROM form_versions
  WHERE id = p_form_version_id AND business_id = v_form.business_id AND form_id = v_form.id AND published_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'form version is not published' USING ERRCODE = 'P0409';
  END IF;

  -- Validate required visible fields and answer types
  FOR v_field IN
    SELECT * FROM form_fields ff
    WHERE ff.business_id = v_form.business_id AND ff.form_version_id = v_version.id
  LOOP
    -- Conditional visibility: skip fields whose rule evaluates false
    IF v_field.visibility_rule IS NOT NULL THEN
      DECLARE
        v_target text := v_field.visibility_rule->>'field_key';
        v_op text := v_field.visibility_rule->>'operator';
        v_expected jsonb := v_field.visibility_rule->'value';
        v_actual jsonb := p_answers->v_target;
        v_visible boolean := true;
      BEGIN
        IF v_op = 'equals' THEN v_visible := v_actual IS NOT NULL AND v_actual = v_expected;
        ELSIF v_op = 'not_equals' THEN v_visible := v_actual IS NULL OR v_actual IS DISTINCT FROM v_expected;
        ELSIF v_op = 'contains' THEN v_visible := v_actual IS NOT NULL AND (v_actual::text LIKE '%' || (v_expected #>> '{}') || '%');
        ELSIF v_op = 'is_checked' THEN v_visible := v_actual IS NOT NULL AND v_actual = 'true'::jsonb;
        END IF;
        IF NOT v_visible THEN CONTINUE; END IF;
      END;
    END IF;

    IF v_field.required AND (p_answers->v_field.field_key IS NULL OR p_answers->>v_field.field_key = '') THEN
      RAISE EXCEPTION 'required field missing: %', v_field.field_key USING ERRCODE = 'P0422';
    END IF;
  END LOOP;

  -- Customer association via explicit customer_mapping only
  SELECT max(CASE WHEN ff.customer_mapping = 'email' THEN nullif(lower(btrim(p_answers->>ff.field_key)), '') END),
         max(CASE WHEN ff.customer_mapping = 'full_name' THEN nullif(btrim(p_answers->>ff.field_key), '') END),
         max(CASE WHEN ff.customer_mapping = 'phone_e164' THEN nullif(btrim(p_answers->>ff.field_key), '') END)
  INTO v_email, v_name, v_phone
  FROM form_fields ff
  WHERE ff.business_id = v_form.business_id AND ff.form_version_id = v_version.id;

  IF v_form.create_customer THEN
    IF v_email IS NOT NULL THEN
      SELECT c.id INTO v_customer_id FROM customers c
      WHERE c.business_id = v_form.business_id AND c.normalized_email = v_email AND c.status = 'active';
    END IF;
    IF v_customer_id IS NULL THEN
      INSERT INTO customers (business_id, full_name, email, phone_e164, source)
      VALUES (v_form.business_id, COALESCE(v_name, 'Form respondent'), v_email, v_phone, 'form')
      RETURNING id INTO v_customer_id;
    END IF;
    -- Never overwrite an existing customer's identity details from an unverified submission.
    IF v_form.lead_tag_id IS NOT NULL THEN
      INSERT INTO customer_tag_assignments (business_id, customer_id, tag_id)
      VALUES (v_form.business_id, v_customer_id, v_form.lead_tag_id)
      ON CONFLICT (business_id, customer_id, tag_id) DO NOTHING;
    END IF;
  END IF;

  INSERT INTO form_submissions (business_id, form_id, form_version_id, customer_id, submitter_subject_hash, idempotency_key)
  VALUES (v_form.business_id, v_form.id, v_version.id, v_customer_id, p_subject_hash, p_request_key)
  RETURNING id INTO v_submission_id;

  FOR v_field IN
    SELECT * FROM form_fields ff
    WHERE ff.business_id = v_form.business_id AND ff.form_version_id = v_version.id
  LOOP
    IF p_answers ? v_field.field_key THEN
      INSERT INTO form_submission_answers (business_id, submission_id, form_field_id, value)
      VALUES (v_form.business_id, v_submission_id, v_field.id, p_answers->v_field.field_key);
    END IF;
  END LOOP;

  INSERT INTO private.domain_events (business_id, event_type, entity_type, entity_id, idempotency_key)
  VALUES (v_form.business_id, 'form.submitted', 'form_submission', v_submission_id, 'form:' || p_request_key::text);

  v_result := jsonb_build_object('received', true, 'submission_id', v_submission_id);

  INSERT INTO private.idempotency_records (business_id, scope, subject_hash, request_key, request_hash, status, response_status, response_body, expires_at)
  VALUES (v_form.business_id, 'form_submit', p_subject_hash, p_request_key, v_hash, 'completed', 200, v_result, now() + interval '24 hours');

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_public_form(text, text, uuid, jsonb, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_form(text, text, uuid, jsonb, uuid, text) TO service_role;

-- ============ merge_customers ============
CREATE OR REPLACE FUNCTION public.merge_customers(
  p_actor_user_id uuid,
  p_source_customer_id uuid,
  p_destination_customer_id uuid,
  p_request_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions
AS $$
DECLARE
  v_source customers%ROWTYPE;
  v_dest customers%ROWTYPE;
BEGIN
  SELECT * INTO v_source FROM customers WHERE id = p_source_customer_id;
  SELECT * INTO v_dest FROM customers WHERE id = p_destination_customer_id;
  IF NOT FOUND OR v_source.id IS NULL OR v_dest.id IS NULL THEN
    RAISE EXCEPTION 'customer not found' USING ERRCODE = 'P0404';
  END IF;
  IF v_source.business_id <> v_dest.business_id THEN
    RAISE EXCEPTION 'customers must belong to the same business' USING ERRCODE = 'P0409';
  END IF;
  IF p_actor_user_id IS NULL OR NOT private.business_permission(v_source.business_id, 'can_manage_customers') THEN
    RAISE EXCEPTION 'customer management permission required' USING ERRCODE = 'P0403';
  END IF;
  IF v_source.id = v_dest.id THEN
    RAISE EXCEPTION 'cannot merge a customer into itself';
  END IF;

  UPDATE appointments SET customer_id = v_dest.id WHERE business_id = v_dest.business_id AND customer_id = v_source.id;
  UPDATE form_submissions SET customer_id = v_dest.id WHERE business_id = v_dest.business_id AND customer_id = v_source.id;
  UPDATE conversations SET customer_id = v_dest.id WHERE business_id = v_dest.business_id AND customer_id = v_source.id;
  UPDATE invoices SET customer_id = v_dest.id WHERE business_id = v_dest.business_id AND customer_id = v_source.id;
  UPDATE payments SET customer_id = v_dest.id WHERE business_id = v_dest.business_id AND customer_id = v_source.id;
  UPDATE customer_notes SET customer_id = v_dest.id WHERE business_id = v_dest.business_id AND customer_id = v_source.id;
  UPDATE customer_consents SET customer_id = v_dest.id WHERE business_id = v_dest.business_id AND customer_id = v_source.id;
  UPDATE tasks SET customer_id = v_dest.id WHERE business_id = v_dest.business_id AND customer_id = v_source.id;
  UPDATE coupon_redemptions SET customer_id = v_dest.id WHERE business_id = v_dest.business_id AND customer_id = v_source.id;
  UPDATE custom_field_values SET customer_id = v_dest.id WHERE business_id = v_dest.business_id AND customer_id = v_source.id;

  INSERT INTO customer_tag_assignments (business_id, customer_id, tag_id)
  SELECT business_id, v_dest.id, tag_id FROM customer_tag_assignments
  WHERE business_id = v_dest.business_id AND customer_id = v_source.id
  ON CONFLICT (business_id, customer_id, tag_id) DO NOTHING;
  DELETE FROM customer_tag_assignments WHERE business_id = v_dest.business_id AND customer_id = v_source.id;

  INSERT INTO customer_group_members (business_id, customer_id, group_id)
  SELECT business_id, v_dest.id, group_id FROM customer_group_members
  WHERE business_id = v_dest.business_id AND customer_id = v_source.id
  ON CONFLICT (business_id, customer_id, group_id) DO NOTHING;
  DELETE FROM customer_group_members WHERE business_id = v_dest.business_id AND customer_id = v_source.id;

  INSERT INTO customer_users (business_id, customer_id, user_id, verified_at)
  SELECT business_id, v_dest.id, user_id, verified_at FROM customer_users
  WHERE business_id = v_dest.business_id AND customer_id = v_source.id
  ON CONFLICT (business_id, customer_id, user_id) DO NOTHING;
  DELETE FROM customer_users WHERE business_id = v_dest.business_id AND customer_id = v_source.id;

  UPDATE customers SET status = 'merged', merged_into_customer_id = v_dest.id
  WHERE id = v_source.id AND business_id = v_dest.business_id;

  INSERT INTO private.audit_logs (business_id, actor_user_id, actor_type, action, entity_type, entity_id, request_id, changes)
  VALUES (v_dest.business_id, p_actor_user_id, 'user', 'customer.merged', 'customer', v_dest.id, p_request_key,
          jsonb_build_object('source_customer_id', v_source.id));

  RETURN jsonb_build_object('merged', true, 'destination_customer_id', v_dest.id);
END;
$$;
REVOKE ALL ON FUNCTION public.merge_customers(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_customers(uuid, uuid, uuid, uuid) TO service_role;

-- ============ create_invoice ============
CREATE OR REPLACE FUNCTION public.create_invoice(
  p_actor_user_id uuid,
  p_business_id uuid,
  p_customer_id uuid,
  p_appointment_id uuid,
  p_items jsonb,
  p_due_date date,
  p_notes text,
  p_request_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions
AS $$
DECLARE
  v_invoice_id uuid;
  v_number text;
  v_subtotal bigint := 0;
  v_tax bigint := 0;
  v_item jsonb;
  v_line_total bigint;
  v_line_tax bigint;
  v_currency text;
  v_seq integer := 0;
BEGIN
  IF p_actor_user_id IS NULL OR NOT private.business_permission(p_business_id, 'can_manage_billing') THEN
    RAISE EXCEPTION 'billing permission required' USING ERRCODE = 'P0403';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = p_customer_id AND c.business_id = p_business_id) THEN
    RAISE EXCEPTION 'customer not found in this business' USING ERRCODE = 'P0404';
  END IF;

  SELECT currency INTO v_currency FROM businesses WHERE id = p_business_id;

  -- Atomic per-business invoice number allocation
  PERFORM 1 FROM businesses WHERE id = p_business_id FOR UPDATE;
  SELECT 'INV-' || lpad((count(*) + 1)::text, 6, '0') INTO v_number
  FROM invoices WHERE business_id = p_business_id;

  INSERT INTO invoices (business_id, customer_id, appointment_id, invoice_number, currency, status, due_date, notes, created_by_user_id)
  VALUES (p_business_id, p_customer_id, p_appointment_id, v_number, v_currency, 'draft', p_due_date, COALESCE(p_notes, ''), p_actor_user_id)
  RETURNING id INTO v_invoice_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_seq := v_seq + 1;
    v_line_total := round((v_item->>'quantity')::numeric * (v_item->>'unit_price_minor')::bigint) - COALESCE((v_item->>'discount_minor')::bigint, 0);
    v_line_tax := round(v_line_total * COALESCE((v_item->>'tax_rate_bps')::integer, 0) / 10000.0);
    INSERT INTO invoice_items (business_id, invoice_id, service_id, description, quantity, unit_price_minor, discount_minor, tax_rate_bps, line_total_minor, sort_order)
    VALUES (p_business_id, v_invoice_id,
            NULLIF(v_item->>'service_id', '')::uuid,
            v_item->>'description',
            (v_item->>'quantity')::numeric,
            (v_item->>'unit_price_minor')::bigint,
            COALESCE((v_item->>'discount_minor')::bigint, 0),
            COALESCE((v_item->>'tax_rate_bps')::integer, 0),
            v_line_total, v_seq);
    v_subtotal := v_subtotal + v_line_total;
    v_tax := v_tax + v_line_tax;
  END LOOP;

  UPDATE invoices SET subtotal_minor = v_subtotal, tax_minor = v_tax, total_minor = v_subtotal + v_tax
  WHERE id = v_invoice_id AND business_id = p_business_id;

  INSERT INTO private.audit_logs (business_id, actor_user_id, actor_type, action, entity_type, entity_id, request_id)
  VALUES (p_business_id, p_actor_user_id, 'user', 'invoice.created', 'invoice', v_invoice_id, p_request_key);

  RETURN jsonb_build_object('invoice_id', v_invoice_id, 'invoice_number', v_number, 'total_minor', v_subtotal + v_tax, 'currency', v_currency);
END;
$$;
REVOKE ALL ON FUNCTION public.create_invoice(uuid, uuid, uuid, uuid, jsonb, date, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice(uuid, uuid, uuid, uuid, jsonb, date, text, uuid) TO service_role;

-- ============ record_manual_payment ============
CREATE OR REPLACE FUNCTION public.record_manual_payment(
  p_actor_user_id uuid,
  p_invoice_id uuid,
  p_amount_minor bigint,
  p_method text,
  p_request_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions
AS $$
DECLARE
  v_invoice invoices%ROWTYPE;
  v_payment_id uuid;
  v_new_paid bigint;
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice not found' USING ERRCODE = 'P0404'; END IF;
  IF p_actor_user_id IS NULL OR NOT private.business_permission(v_invoice.business_id, 'can_manage_billing') THEN
    RAISE EXCEPTION 'billing permission required' USING ERRCODE = 'P0403';
  END IF;
  IF v_invoice.status NOT IN ('open','draft') THEN
    RAISE EXCEPTION 'invoice is not payable' USING ERRCODE = 'P0409';
  END IF;
  IF p_amount_minor <= 0 OR p_amount_minor > v_invoice.total_minor - v_invoice.paid_minor THEN
    RAISE EXCEPTION 'amount exceeds the invoice balance' USING ERRCODE = 'P0409';
  END IF;

  INSERT INTO payments (business_id, customer_id, appointment_id, provider, amount_minor, currency, method, status, paid_at, recorded_by_user_id, idempotency_key)
  VALUES (v_invoice.business_id, v_invoice.customer_id, v_invoice.appointment_id, 'manual', p_amount_minor, v_invoice.currency, p_method, 'succeeded', now(), p_actor_user_id, p_request_key)
  RETURNING id INTO v_payment_id;

  INSERT INTO payment_allocations (business_id, payment_id, invoice_id, amount_minor)
  VALUES (v_invoice.business_id, v_payment_id, v_invoice.id, p_amount_minor);

  v_new_paid := v_invoice.paid_minor + p_amount_minor;
  UPDATE invoices
  SET paid_minor = v_new_paid,
      status = CASE WHEN v_new_paid >= total_minor THEN 'paid' ELSE 'open' END,
      issued_at = COALESCE(issued_at, now())
  WHERE id = v_invoice.id AND business_id = v_invoice.business_id;

  INSERT INTO private.domain_events (business_id, event_type, entity_type, entity_id, idempotency_key)
  VALUES (v_invoice.business_id, 'payment.recorded', 'payment', v_payment_id, 'payment:' || p_request_key::text);

  INSERT INTO private.audit_logs (business_id, actor_user_id, actor_type, action, entity_type, entity_id, request_id)
  VALUES (v_invoice.business_id, p_actor_user_id, 'user', 'payment.recorded', 'payment', v_payment_id, p_request_key);

  RETURN jsonb_build_object('payment_id', v_payment_id, 'invoice_id', v_invoice.id, 'paid_minor', v_new_paid);
END;
$$;
REVOKE ALL ON FUNCTION public.record_manual_payment(uuid, uuid, bigint, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_manual_payment(uuid, uuid, bigint, text, uuid) TO service_role;

-- ============ accept_member_invitation ============
CREATE OR REPLACE FUNCTION public.accept_member_invitation(
  p_subject_hash text,
  p_token text,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions
AS $$
DECLARE
  v_token_row private.capability_tokens%ROWTYPE;
  v_invite member_invitations%ROWTYPE;
  v_email text;
  v_member_id uuid;
  v_loc uuid;
BEGIN
  PERFORM private.check_rate_limit('invitation_accept', p_subject_hash, 10, 600);
  IF p_actor_user_id IS NULL THEN RAISE EXCEPTION 'authenticated actor required' USING ERRCODE = 'P0403'; END IF;

  SELECT * INTO v_token_row FROM private.capability_tokens
  WHERE kind = 'member_invitation' AND token_hash = digest(p_token, 'sha256');
  IF NOT FOUND OR v_token_row.revoked_at IS NOT NULL OR v_token_row.expires_at <= now() THEN
    RAISE EXCEPTION 'invitation token is missing, expired, or revoked' USING ERRCODE = 'P0403';
  END IF;

  SELECT * INTO v_invite FROM member_invitations
  WHERE id = v_token_row.invitation_id AND business_id = v_token_row.business_id
  FOR UPDATE;
  IF NOT FOUND OR v_invite.accepted_at IS NOT NULL OR v_invite.revoked_at IS NOT NULL OR v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'invitation is no longer valid' USING ERRCODE = 'P0409';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_actor_user_id;
  IF lower(v_email) <> v_invite.email THEN
    RAISE EXCEPTION 'this invitation was sent to a different email address' USING ERRCODE = 'P0403';
  END IF;

  INSERT INTO business_members (business_id, user_id, role, all_locations,
      can_manage_customers, can_manage_services, can_manage_staff, can_manage_forms,
      can_manage_messages, can_manage_automations, can_view_analytics, can_manage_billing)
  VALUES (v_invite.business_id, p_actor_user_id, v_invite.role,
          COALESCE(cardinality(v_invite.location_ids), 0) = 0,
          COALESCE((v_invite.permissions->>'can_manage_customers')::boolean, false),
          COALESCE((v_invite.permissions->>'can_manage_services')::boolean, false),
          COALESCE((v_invite.permissions->>'can_manage_staff')::boolean, false),
          COALESCE((v_invite.permissions->>'can_manage_forms')::boolean, false),
          COALESCE((v_invite.permissions->>'can_manage_messages')::boolean, false),
          COALESCE((v_invite.permissions->>'can_manage_automations')::boolean, false),
          COALESCE((v_invite.permissions->>'can_view_analytics')::boolean, false),
          COALESCE((v_invite.permissions->>'can_manage_billing')::boolean, false))
  ON CONFLICT (business_id, user_id) DO NOTHING
  RETURNING id INTO v_member_id;

  IF v_member_id IS NULL THEN
    SELECT id INTO v_member_id FROM business_members
    WHERE business_id = v_invite.business_id AND user_id = p_actor_user_id;
  END IF;

  FOREACH v_loc IN ARRAY v_invite.location_ids LOOP
    INSERT INTO member_locations (business_id, business_member_id, location_id)
    VALUES (v_invite.business_id, v_member_id, v_loc)
    ON CONFLICT (business_id, business_member_id, location_id) DO NOTHING;
  END LOOP;

  UPDATE member_invitations SET accepted_at = now() WHERE id = v_invite.id AND business_id = v_invite.business_id;
  UPDATE private.capability_tokens SET revoked_at = now(), last_used_at = now() WHERE id = v_token_row.id;

  INSERT INTO private.audit_logs (business_id, actor_user_id, actor_type, action, entity_type, entity_id, request_id)
  VALUES (v_invite.business_id, p_actor_user_id, 'user', 'member.invitation_accepted', 'business_member', v_member_id, gen_random_uuid());

  RETURN jsonb_build_object('business_id', v_invite.business_id, 'business_member_id', v_member_id, 'role', v_invite.role);
END;
$$;
REVOKE ALL ON FUNCTION public.accept_member_invitation(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_member_invitation(text, text, uuid) TO service_role;

-- ============ get_business_analytics ============
CREATE OR REPLACE FUNCTION public.get_business_analytics(
  p_actor_user_id uuid,
  p_business_id uuid,
  p_location_id uuid,
  p_from_date date,
  p_through_date date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions
AS $$
DECLARE
  v_tz text;
  v_from timestamptz;
  v_through timestamptz;
  v_result jsonb;
BEGIN
  IF p_actor_user_id IS NULL OR NOT private.business_permission(p_business_id, 'can_view_analytics') THEN
    RAISE EXCEPTION 'analytics permission required' USING ERRCODE = 'P0403';
  END IF;
  IF p_location_id IS NOT NULL AND NOT private.has_location_access(p_business_id, p_location_id) THEN
    RAISE EXCEPTION 'no access to this location' USING ERRCODE = 'P0403';
  END IF;

  SELECT COALESCE(l.timezone, b.timezone) INTO v_tz
  FROM businesses b
  LEFT JOIN locations l ON l.id = COALESCE(p_location_id, b.default_location_id) AND l.business_id = b.id
  WHERE b.id = p_business_id;

  v_from := (p_from_date::timestamp AT TIME ZONE v_tz);
  v_through := ((p_through_date + 1)::timestamp AT TIME ZONE v_tz);

  WITH scoped_appointments AS (
    SELECT ap.*, bs.starts_at AS session_starts_at, bs.staff_id AS session_staff_id, bs.location_id AS session_location_id
    FROM appointments ap
    JOIN booking_sessions bs ON bs.id = ap.session_id AND bs.business_id = ap.business_id
    WHERE ap.business_id = p_business_id
      AND NOT ap.is_sandbox
      AND bs.starts_at >= v_from AND bs.starts_at < v_through
      AND (p_location_id IS NULL OR bs.location_id = p_location_id)
  ),
  scoped_payments AS (
    SELECT p.* FROM payments p
    WHERE p.business_id = p_business_id AND NOT p.is_sandbox
      AND p.paid_at >= v_from AND p.paid_at < v_through
  )
  SELECT jsonb_build_object(
    'booking_count', (SELECT count(*) FROM scoped_appointments),
    'completed_count', (SELECT count(*) FROM scoped_appointments WHERE status = 'completed'),
    'cancelled_count', (SELECT count(*) FROM scoped_appointments WHERE status = 'cancelled'),
    'no_show_count', (SELECT count(*) FROM scoped_appointments WHERE status = 'no_show'),
    'new_customers', (SELECT count(DISTINCT customer_id) FROM scoped_appointments a
                      WHERE NOT EXISTS (SELECT 1 FROM appointments prev
                        WHERE prev.business_id = p_business_id AND prev.customer_id = a.customer_id
                          AND prev.created_at < a.created_at AND NOT prev.is_sandbox)),
    'repeat_customers', (SELECT count(DISTINCT customer_id) FROM scoped_appointments a
                      WHERE EXISTS (SELECT 1 FROM appointments prev
                        WHERE prev.business_id = p_business_id AND prev.customer_id = a.customer_id
                          AND prev.created_at < a.created_at AND NOT prev.is_sandbox)),
    'gross_receipts_minor', (SELECT COALESCE(sum(amount_minor), 0) FROM scoped_payments WHERE status = 'succeeded'),
    'refunds_minor', (SELECT COALESCE(sum(r.amount_minor), 0) FROM refunds r
                      JOIN scoped_payments sp2 ON sp2.id = r.payment_id WHERE r.status = 'succeeded'),
    'net_revenue_minor', (SELECT COALESCE(sum(CASE WHEN status = 'succeeded' THEN amount_minor - refunded_minor ELSE 0 END), 0) FROM scoped_payments),
    'booking_value_by_service', (SELECT COALESCE(jsonb_agg(jsonb_build_object('service_name', service_name, 'total_minor', total)), '[]'::jsonb)
        FROM (SELECT aps.service_name, sum(aps.line_total_minor) AS total
              FROM appointment_services aps
              JOIN scoped_appointments sa ON sa.id = aps.appointment_id
              GROUP BY aps.service_name) t),
    'booking_value_by_staff', (SELECT COALESCE(jsonb_agg(jsonb_build_object('staff_id', session_staff_id, 'total_minor', total)), '[]'::jsonb)
        FROM (SELECT sa2.session_staff_id, sum(sa2.total_minor) AS total FROM scoped_appointments sa2 GROUP BY sa2.session_staff_id) t2),
    'booking_sources', (SELECT COALESCE(jsonb_agg(jsonb_build_object('source', source, 'count', cnt)), '[]'::jsonb)
        FROM (SELECT source, count(*) AS cnt FROM scoped_appointments GROUP BY source) t3),
    'busiest_weekdays', (SELECT COALESCE(jsonb_agg(jsonb_build_object('iso_weekday', wd, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
        FROM (SELECT extract(isodow from session_starts_at AT TIME ZONE v_tz)::smallint AS wd, count(*) AS cnt
              FROM scoped_appointments GROUP BY 1) t4),
    'busiest_hours', (SELECT COALESCE(jsonb_agg(jsonb_build_object('hour', hr, 'count', cnt) ORDER BY hr), '[]'::jsonb)
        FROM (SELECT extract(hour from session_starts_at AT TIME ZONE v_tz)::smallint AS hr, count(*) AS cnt
              FROM scoped_appointments GROUP BY 1) t5),
    'sms_segments', (SELECT COALESCE(sum(quantity), 0) FROM usage_events
                      WHERE business_id = p_business_id AND metric = 'sms_segments' AND NOT is_sandbox
                        AND occurred_at >= v_from AND occurred_at < v_through),
    'voice_seconds', (SELECT COALESCE(sum(quantity), 0) FROM usage_events
                      WHERE business_id = p_business_id AND metric = 'voice_seconds' AND NOT is_sandbox
                        AND occurred_at >= v_from AND occurred_at < v_through),
    'ai_booking_outcomes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('outcome', outcome, 'count', cnt)), '[]'::jsonb)
        FROM (SELECT outcome, count(*) AS cnt FROM calls
              WHERE business_id = p_business_id AND NOT is_sandbox AND outcome IS NOT NULL
                AND started_at >= v_from AND started_at < v_through GROUP BY outcome) t6),
    'visitor_conversion', NULL
  ) INTO v_result;

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_business_analytics(uuid, uuid, uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_analytics(uuid, uuid, uuid, date, date) TO service_role;