-- Move btree_gist out of public
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION btree_gist SET SCHEMA extensions;

-- ============ private authorization helpers ============
CREATE OR REPLACE FUNCTION private.is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM private.platform_admins pa
    WHERE pa.user_id = auth.uid() AND pa.active
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.is_org_admin(_organization_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = _organization_id AND om.user_id = auth.uid() AND om.active
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.is_business_member(_business_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = _business_id AND bm.user_id = auth.uid() AND bm.active
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.business_member_role(_business_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  r text;
BEGIN
  SELECT bm.role INTO r FROM public.business_members bm
  WHERE bm.business_id = _business_id AND bm.user_id = auth.uid() AND bm.active;
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION private.is_org_admin_for_business(_business_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.businesses b
    JOIN public.organization_members om ON om.organization_id = b.organization_id
    WHERE b.id = _business_id AND om.user_id = auth.uid() AND om.active
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.has_business_access(_business_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN private.is_business_member(_business_id) OR private.is_org_admin_for_business(_business_id);
END;
$$;

CREATE OR REPLACE FUNCTION private.business_permission(_business_id uuid, _permission text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  m public.business_members%ROWTYPE;
BEGIN
  IF private.is_org_admin_for_business(_business_id) THEN
    RETURN true;
  END IF;
  SELECT * INTO m FROM public.business_members bm
  WHERE bm.business_id = _business_id AND bm.user_id = auth.uid() AND bm.active;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF m.role = 'owner' THEN
    RETURN true;
  END IF;
  IF m.role <> 'manager' THEN
    RETURN false;
  END IF;
  RETURN CASE _permission
    WHEN 'can_manage_customers' THEN m.can_manage_customers
    WHEN 'can_manage_services' THEN m.can_manage_services
    WHEN 'can_manage_staff' THEN m.can_manage_staff
    WHEN 'can_manage_forms' THEN m.can_manage_forms
    WHEN 'can_manage_messages' THEN m.can_manage_messages
    WHEN 'can_manage_automations' THEN m.can_manage_automations
    WHEN 'can_view_analytics' THEN m.can_view_analytics
    WHEN 'can_manage_billing' THEN m.can_manage_billing
    ELSE false
  END;
END;
$$;

CREATE OR REPLACE FUNCTION private.has_location_access(_business_id uuid, _location_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  m public.business_members%ROWTYPE;
BEGIN
  IF private.is_org_admin_for_business(_business_id) THEN
    RETURN true;
  END IF;
  SELECT * INTO m FROM public.business_members bm
  WHERE bm.business_id = _business_id AND bm.user_id = auth.uid() AND bm.active;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF m.role IN ('owner','manager') AND m.all_locations THEN
    RETURN true;
  END IF;
  IF m.role = 'owner' THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.member_locations ml
    WHERE ml.business_id = _business_id AND ml.business_member_id = m.id AND ml.location_id = _location_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.is_verified_customer_user(_business_id uuid, _customer_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.customer_users cu
    WHERE cu.business_id = _business_id AND cu.customer_id = _customer_id AND cu.user_id = auth.uid()
  );
END;
$$;

-- Helpers are used inside RLS policies, so authenticated needs EXECUTE; they only ever
-- evaluate the caller's own auth.uid() and return booleans.
REVOKE ALL ON FUNCTION private.is_platform_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_platform_admin() TO service_role;
REVOKE ALL ON FUNCTION private.is_org_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_org_admin(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.is_business_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_business_member(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.business_member_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.business_member_role(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.is_org_admin_for_business(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_org_admin_for_business(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.has_business_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_business_access(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.business_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.business_permission(uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.has_location_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_location_access(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.is_verified_customer_user(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_verified_customer_user(uuid, uuid) TO authenticated, service_role;

-- ============ RLS policies ============
-- Identity / tenant
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY organizations_select ON public.organizations FOR SELECT TO authenticated USING (private.is_org_admin(id));
CREATE POLICY organization_members_select ON public.organization_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR private.is_org_admin(organization_id));
CREATE POLICY businesses_select ON public.businesses FOR SELECT TO authenticated USING (private.has_business_access(id));
CREATE POLICY business_settings_select ON public.business_settings FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY business_members_select ON public.business_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR private.has_business_access(business_id));
CREATE POLICY locations_select ON public.locations FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY member_locations_select ON public.member_locations FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY member_invitations_select ON public.member_invitations FOR SELECT TO authenticated USING (private.business_member_role(business_id) IN ('owner','manager') OR private.is_org_admin_for_business(business_id));

-- Files, hours, staff, services
CREATE POLICY storage_assets_select ON public.storage_assets FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY business_hours_select ON public.business_hours FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY staff_profiles_select ON public.staff_profiles FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY staff_locations_select ON public.staff_locations FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY staff_availability_select ON public.staff_availability FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY staff_time_off_select ON public.staff_time_off FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY service_categories_select ON public.service_categories FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY services_select ON public.services FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY service_locations_select ON public.service_locations FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY staff_services_select ON public.staff_services FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY service_addons_select ON public.service_addons FOR SELECT TO authenticated USING (private.has_business_access(business_id));

-- CRM: staff intentionally excluded from full customer records
CREATE POLICY customers_select ON public.customers FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_customers') OR private.is_verified_customer_user(business_id, id));
CREATE POLICY customer_users_select ON public.customer_users FOR SELECT TO authenticated USING (user_id = auth.uid() OR private.business_permission(business_id, 'can_manage_customers'));
CREATE POLICY customer_notes_select ON public.customer_notes FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_customers'));
CREATE POLICY customer_tags_select ON public.customer_tags FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_customers'));
CREATE POLICY customer_tag_assignments_select ON public.customer_tag_assignments FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_customers'));
CREATE POLICY customer_groups_select ON public.customer_groups FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_customers'));
CREATE POLICY customer_group_members_select ON public.customer_group_members FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_customers'));
CREATE POLICY custom_fields_select ON public.custom_fields FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY custom_field_values_select ON public.custom_field_values FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_customers'));

-- Booking
CREATE POLICY booking_pages_select ON public.booking_pages FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY recurrence_rules_select ON public.recurrence_rules FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY booking_sessions_select ON public.booking_sessions FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY appointments_select ON public.appointments FOR SELECT TO authenticated USING (private.has_business_access(business_id) OR private.is_verified_customer_user(business_id, customer_id));
CREATE POLICY appointment_services_select ON public.appointment_services FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY appointment_addons_select ON public.appointment_addons FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY appointment_holds_select ON public.appointment_holds FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY blocked_times_select ON public.blocked_times FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY resource_reservations_select ON public.resource_reservations FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY appointment_status_history_select ON public.appointment_status_history FOR SELECT TO authenticated USING (private.has_business_access(business_id));

-- Forms and consent
CREATE POLICY forms_select ON public.forms FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY form_versions_select ON public.form_versions FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY form_fields_select ON public.form_fields FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY form_service_links_select ON public.form_service_links FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY form_submissions_select ON public.form_submissions FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_forms'));
CREATE POLICY form_submission_answers_select ON public.form_submission_answers FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_forms'));
CREATE POLICY customer_consents_select ON public.customer_consents FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_customers'));

-- Integrations, calendars, messaging, AI
CREATE POLICY integrations_select ON public.integrations FOR SELECT TO authenticated USING (private.business_member_role(business_id) IN ('owner','manager') OR private.is_org_admin_for_business(business_id));
CREATE POLICY calendar_connections_select ON public.calendar_connections FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY calendar_calendars_select ON public.calendar_calendars FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY calendar_events_select ON public.calendar_events FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY calendar_sync_runs_select ON public.calendar_sync_runs FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY phone_numbers_select ON public.phone_numbers FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY conversations_select ON public.conversations FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_messages'));
CREATE POLICY messages_select ON public.messages FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_messages'));
CREATE POLICY message_attachments_select ON public.message_attachments FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_messages'));
CREATE POLICY message_templates_select ON public.message_templates FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY calls_select ON public.calls FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_messages'));
CREATE POLICY ai_assistant_settings_select ON public.ai_assistant_settings FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY ai_allowed_services_select ON public.ai_allowed_services FOR SELECT TO authenticated USING (private.has_business_access(business_id));
CREATE POLICY ai_knowledge_items_select ON public.ai_knowledge_items FOR SELECT TO authenticated USING (private.has_business_access(business_id));

-- Financial: owners and billing-authorized managers only
CREATE POLICY stripe_connect_accounts_select ON public.stripe_connect_accounts FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_billing'));
CREATE POLICY invoices_select ON public.invoices FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_billing'));
CREATE POLICY invoice_items_select ON public.invoice_items FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_billing'));
CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_billing'));
CREATE POLICY payment_allocations_select ON public.payment_allocations FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_billing'));
CREATE POLICY refunds_select ON public.refunds FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_billing'));
CREATE POLICY coupons_select ON public.coupons FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_billing'));
CREATE POLICY coupon_redemptions_select ON public.coupon_redemptions FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_billing'));

-- Automations and tasks
CREATE POLICY automation_workflows_select ON public.automation_workflows FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_automations'));
CREATE POLICY automation_steps_select ON public.automation_steps FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_automations'));
CREATE POLICY automation_runs_select ON public.automation_runs FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_automations'));
CREATE POLICY automation_step_runs_select ON public.automation_step_runs FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_automations'));
CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated USING (private.has_business_access(business_id));

-- SaaS plans/subscriptions
CREATE POLICY subscription_plans_select ON public.subscription_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY plan_features_select ON public.plan_features FOR SELECT TO authenticated USING (true);
CREATE POLICY subscriptions_select ON public.subscriptions FOR SELECT TO authenticated USING (private.is_org_admin(organization_id));
CREATE POLICY subscription_billing_documents_select ON public.subscription_billing_documents FOR SELECT TO authenticated USING (private.is_org_admin(organization_id));
CREATE POLICY entitlement_overrides_select ON public.entitlement_overrides FOR SELECT TO authenticated USING (private.is_org_admin(organization_id));
CREATE POLICY usage_events_select ON public.usage_events FOR SELECT TO authenticated USING (private.is_org_admin_for_business(business_id));
CREATE POLICY usage_limits_select ON public.usage_limits FOR SELECT TO authenticated USING (private.is_org_admin(organization_id));

-- Notifications: recipient only, membership must still be valid; recipients may mark read
CREATE POLICY notifications_select ON public.notifications FOR SELECT TO authenticated USING (recipient_user_id = auth.uid() AND private.has_business_access(business_id));
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
CREATE POLICY notifications_update_read ON public.notifications FOR UPDATE TO authenticated USING (recipient_user_id = auth.uid()) WITH CHECK (recipient_user_id = auth.uid());

-- Privacy requests
CREATE POLICY privacy_requests_select ON public.privacy_requests FOR SELECT TO authenticated USING (private.business_permission(business_id, 'can_manage_customers'));