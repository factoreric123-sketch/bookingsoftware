# Avello database schema

Applied to the connected Supabase project through Lovable's migration tool in dependency order.

## Conventions

- UUID primary keys; `public` for application tables, `private` for server-only tables (not exposed through the Data API).
- Every M table carries `created_at`, `updated_at`, `row_version`; a shared trigger (`private.set_updated_at`) bumps `updated_at`/`row_version` and makes `id`, `business_id`, `organization_id`, `created_at` immutable.
- Business-scoped tables have `UNIQUE (business_id, id)` and all intra-tenant references use composite foreign keys `(business_id, ref_id)`.
- Money is `bigint` minor units; currency is an uppercase ISO code; percentage/basis-point fields are 0–10000.
- IANA timezones are validated against `pg_timezone_names` by trigger.
- Domain references use `ON DELETE RESTRICT`; history is soft-archived, never cascade-deleted.

## Table groups

| Group | Tables |
|---|---|
| Identity & tenants | profiles, organizations, organization_members, businesses, business_settings, business_members, locations, member_locations, member_invitations |
| Platform admin | private.platform_admins (empty until explicitly granted) |
| Files & scheduling | storage_assets, business_hours, staff_profiles, staff_locations, staff_availability, staff_time_off |
| Services | service_categories, services, service_locations, staff_services, service_addons |
| CRM | customers, customer_users, customer_notes, customer_tags, customer_tag_assignments, customer_groups, customer_group_members, custom_fields, custom_field_values |
| Booking | booking_pages, recurrence_rules, booking_sessions, appointments, appointment_services, appointment_addons, appointment_holds, blocked_times, resource_reservations, appointment_status_history, private.capability_tokens |
| Forms & consent | forms, form_versions, form_fields, form_service_links, form_submissions, form_submission_answers, customer_consents (append-only) |
| Messaging & AI | integrations, private.integration_secret_refs, calendar_connections, calendar_calendars, calendar_events, calendar_sync_runs, phone_numbers, conversations, messages, message_attachments, message_templates, calls, ai_assistant_settings, ai_allowed_services, ai_knowledge_items |
| Business finance | stripe_connect_accounts, invoices, invoice_items, payments, payment_allocations, refunds, coupons, coupon_redemptions |
| Automations | automation_workflows, automation_steps, tasks, automation_runs, automation_step_runs, private.domain_events |
| SaaS billing | subscription_plans (4 seeded, unpublished, no prices), plan_features (72 seeded rows), subscriptions, subscription_billing_documents, entitlement_overrides, usage_events, usage_limits |
| Operations | notifications, privacy_requests, private.webhook_events, private.idempotency_records, private.background_jobs, private.rate_limit_buckets, private.audit_logs (append-only), private.system_errors |

## Key invariants

- `resource_reservations` has a GiST exclusion constraint on `(business_id, staff_id, occupied_range)` for active rows — the final double-booking guard. Clients have no write access to it.
- Hold lifetime is exactly 10 minutes (trigger-enforced); capability tokens are stored only as 32-byte SHA-256 hashes.
- Appointment/invoice totals must reconcile (`total = subtotal - discount + tax [+ tip]`); allocations and refunds are capacity-checked by triggers under row locks.
- The last active owner of an organization or business cannot be removed (trigger).
- Published form versions and their fields are immutable; consent and audit tables are append-only.
- Merge cycles between customers are rejected; merged customers must stay within one business.
- Storage buckets `business-branding` and `business-files` exist (both private, 10 MiB limit; the workspace blocks public buckets). `storage_assets.object_path` must start with `<business_id>/`, and `storage.objects` policies scope access to the member's own business folder.

## Deviations from the spec

- `business-branding` is private, not public: the workspace policy blocks public buckets. Branding assets are served via short-lived signed URLs. To make it public, enable public buckets in workspace Settings → Privacy & Security, then flip the bucket.
- Group-attendee rescheduling to a *different* session raises a structured conflict and must be handled by a dedicated backend flow (cancel + new hold); individual session moves are fully implemented.
