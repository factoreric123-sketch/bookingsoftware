# Database verification

Date: 2026-11-06. All work applied through Lovable's Supabase migration tooling to the connected project.

Follow-up verification on 2026-11-07: see `authorization-verification.md` for the explicit-actor repair, 13 passing tests, real connected transactions, remaining failures, and advisor limitations. The original results below are historical.

Published-field immutability follow-up on 2026-11-07: migration `20261107220124_ef6831d1-670b-40f7-9112-fd13e29a16fb.sql` extends the existing field trigger to INSERT and safely separates NEW/OLD handling. The original gap was reproduced before repair; all 14 connected transactional regression assertions passed and all fixtures rolled back. Security advisor reported only the same 11 pre-existing findings. See `published-form-fields-verification.md` for exact results and Edge `save_form` source-order compatibility evidence.

Team invitation creation follow-up on 2026-11-07: migration `20261107220736_c6958f42-ece3-4a0c-8170-07ca2117968f.sql` adds the service-role-only SECURITY INVOKER creation RPC. Thirty rollback-only assertion expectations passed, including reproduction of the existing acceptance failure under service_role (`42501`, auth.users SELECT denied). Matching-actor redemption succeeded only as the migration role; production service-role redemption remains blocked and acceptance was not modified. See `member-invitations-verification.md` for exact outcomes and limits.

## Applied migrations (in order)

Invitation acceptance follow-up on 2026-11-07: migration `20261107221116_4e629aee-00a2-4546-9700-62c51a84f816.sql` fixes service-role acceptance using a private confirmed-email boolean helper without broad auth-directory access. The original `42501` failure was reproduced; all 22 database-role regression assertions passed with rolled-back fixtures. Advisor findings remain the same 11 pre-existing items. See `member-invitations-verification.md` for exact results and limits.

1. Foundation: private schema, shared update/immutability trigger, timezone validation, profiles (+ auth signup trigger and backfill), private.platform_admins, organizations, organization_members, businesses, business_settings, business_members, locations, member_locations, member_invitations, last-owner protection.
2. Files/hours/staff/services: storage_assets, circular business FKs, business_hours (overlap guard), staff_profiles, staff_locations, staff_availability, staff_time_off, service_categories, services, service_locations, staff_services, service_addons, storage.objects RLS.
3. CRM: customers (normalized email, merge-cycle guard), customer_users, customer_notes, customer_tags(+assignments), customer_groups(+members), custom_fields, custom_field_values.
4. Booking core: booking_pages, recurrence_rules, booking_sessions, appointments, appointment_services, appointment_addons, appointment_holds (10-minute lifetime trigger), blocked_times, resource_reservations (GiST exclusion constraint), appointment_status_history, private.capability_tokens.
5. Forms & consent: forms, form_versions (immutable once published), form_fields, form_service_links, form_submissions, form_submission_answers, customer_consents (append-only).
6. Integrations/calendars/messaging/AI: integrations (public_config credential-key rejection), private.integration_secret_refs, calendar_connections/calendars/events/sync_runs, phone_numbers, conversations, messages, message_attachments, message_templates, calls (consent-gated recordings), ai_assistant_settings, ai_allowed_services, ai_knowledge_items.
7. Finance: stripe_connect_accounts, invoices, invoice_items, payments, payment_allocations (capacity/currency triggers), refunds (capacity trigger), coupons, coupon_redemptions.
8. Automations: private.domain_events, automation_workflows, automation_steps, tasks, automation_runs, automation_step_runs.
9. SaaS: subscription_plans (4 seeded, unpublished, no prices), plan_features (72 seeded), subscriptions (one-current partial unique), subscription_billing_documents, entitlement_overrides (overlap guard), usage_events, usage_limits.
10. Operations: notifications, private.webhook_events, private.idempotency_records, private.background_jobs, private.rate_limit_buckets, private.audit_logs (append-only), privacy_requests, private.system_errors.
11. Authorization: private helper functions (membership, role, permission, location access, verified customer, platform admin), RLS policies on all 82 public tables, btree_gist moved to extensions schema.
12. Backend RPCs I: check_rate_limit, token generation, slot-conflict helper, provision_business, get_public_booking_page, get_availability.
13. Backend RPCs II: expire_holds, create_booking_hold, confirm_booking, get_managed_appointment, reschedule_appointment, cancel_appointment.
14. Backend RPCs III: create_blocked_time, release_blocked_time, submit_public_form, merge_customers, create_invoice, record_manual_payment, accept_member_invitation, get_business_analytics.

## Catalog inspection results

- 82 public tables, 10 private tables — all present.
- 83 RLS policies (79 table SELECT policies + notification mark-read update + 3 storage.objects policies).
- `resource_reservations_no_overlap` exclusion constraint present.
- All 17 public RPC entry points present, EXECUTE granted only to service_role.
- Seed data: exactly 4 unpublished plans with NULL prices, 72 plan feature rows (Starter allowances per spec, everything else disabled). No demo businesses, customers, bookings, payments, or provider rows.

## Test results

- Existing app tests: 6/6 pass (`bunx vitest run`).
- RPC grant hardening verified live: calling `expire_holds` without the service role fails with `permission denied for function expire_holds` — anonymous/authenticated/direct execution is denied as specified.
- The 10 remaining linter findings ("RLS enabled, no policy") are the 10 private-schema tables: intentional deny-all, and the private schema is not exposed through the Data API.

## Not yet executed (require follow-up)

- Full 50-scenario acceptance suite (concurrency races, DST transitions, token abuse, webhook idempotency) needs a test harness with service-role database access; the schema-level guards they target (exclusion constraint, triggers, unique constraints, append-only protections) are in place.
- TypeScript typecheck and production build of the app after type regeneration.
- Frontend integration against the new RPCs (see docs/frontend-database-mapping.md).
