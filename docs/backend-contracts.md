# Avello backend contracts

All operations are Postgres functions in `public`, `SECURITY INVOKER`, with `EXECUTE` revoked from `PUBLIC`, `anon`, and `authenticated` and granted only to `service_role`. Call them from TanStack server functions after verifying the caller's session with `requireSupabaseAuth`; pass the verified user id as `p_actor_user_id`. Never let a browser supply actor identity.

Current deployment uses the existing `backend-api` boundary, which overwrites supplied actor IDs with verified access-token identity. Protected SQL authorization now uses private explicit-actor helpers rather than request-context auth.uid(). See `authorization-verification.md` for exact runtime results and known rescheduling failures.

Error codes: `P0403` forbidden, `P0404` not found, `P0409` conflict/state changed, `P0422` validation failed, `P0429` rate limited, `P0402` payment not configured.

## Operations

### provision_business(p_actor_user_id, p_organization_id, p_organization_name, p_business_name, p_business_slug, p_industry, p_timezone, p_currency, p_location_name, p_request_key) → jsonb
Creates org (or verifies org administration), owner memberships, 14-day Starter trial, business, location, settings, owner staff profile with Mon–Fri 09:00–17:00 hours/availability, draft booking page, and 7 unconfigured integration rows (google_booking starts `pending_approval`). Idempotent on `p_request_key`; same key + different payload → `P0409`. Returns organization/business/location/staff/booking_page/subscription ids.

### get_public_booking_page(p_slug) → jsonb
Published pages of active businesses only. Returns branding, business display info, public location info, bookable services with add-ons, staff display names/bios, policies, and required-customer-field config. Never returns customer data, integration config, or secrets.

### get_availability(p_booking_page_id, p_service_id, p_from_date, p_through_date, p_staff_id, p_addon_quantities, p_seat_count) → jsonb array
Max 31-day span. Intersects business hours, staff availability, time off, blocked time, reservations (buffers included), and external busy events; honors notice period, advance window, and daily cap. Returns `{session_id, staff_id, starts_at, ends_at, timezone, remaining_capacity}` slots in the location timezone.

### create_booking_hold(p_subject_hash, p_booking_page_id, p_service_id, p_staff_id, p_session_id, p_starts_at, p_addon_quantities, p_seat_count, p_request_key) → jsonb
Rate limit 10/min per subject. Expires stale holds, rechecks availability, picks eligible staff when null, creates/reuses the session, writes the reservation (exclusion constraint is the race guard), locks group sessions before counting seats. Returns `hold_id`, raw `hold_token` (once), `expires_at`, and the server-calculated price. The stored idempotency response omits the raw token.

### confirm_booking(p_subject_hash, p_hold_token, p_actor_user_id, p_customer_id, p_contact, p_customer_notes, p_consent_decisions, p_request_key) → jsonb
Rate limit 10/10min. Validates the hold token hash, locks the hold, rechecks capacity, matches/creates the customer within the business only (never overwrites an existing customer's identity from a guest submission), writes appointment + service/add-on snapshots, consent records, status history, domain event, and audit entry. `p_customer_id` requires an authorized dashboard actor. Deposit/full services without a connected Stripe integration fail with `P0402`. Returns appointment id, status, public summary, and the raw management token once.

### get_managed_appointment(p_subject_hash, p_token) → jsonb
Rate limit 20/10min. Returns only that appointment's summary, policy, and allowed actions (can_reschedule/can_cancel derived from notice windows).

### reschedule_appointment(p_subject_hash, p_appointment_id, p_new_starts_at, p_management_token, p_actor_user_id, p_expected_row_version, p_request_key) → jsonb
Authorized by valid management token or business membership. Enforces reschedule notice and optimistic concurrency (`row_version`). Moves the individual session and rewrites reservations atomically; on conflict the original booking is preserved. Group-attendee moves return `P0409` (use cancel + new hold).

### cancel_appointment(p_subject_hash, p_appointment_id, p_reason, p_management_token, p_actor_user_id, p_expected_row_version, p_request_key) → jsonb
Enforces cancellation notice; marks cancelled, releases individual reservations or group seats; never deletes the record; never auto-charges fees or refunds.

### create_blocked_time(p_actor_user_id, p_business_id, p_location_id, p_staff_id, p_starts_at, p_ends_at, p_reason) / release_blocked_time(p_actor_user_id, p_blocked_time_id)
Owner/manager + location access. Rejects blocks conflicting with existing appointments; writes per-staff reservation rows transactionally; release sets `released_at` and deactivates reservations.

### submit_public_form(p_subject_hash, p_form_slug, p_form_version_id, p_answers, p_request_key, p_honeypot) → jsonb
Rate limit 5/10min. Honeypot submissions are silently accepted. Validates the active published version, required/visible fields, conditional rules, and answer types; associates customers via explicit `customer_mapping` only; idempotent on `p_request_key`; returns only a receipt.

### merge_customers(p_actor_user_id, p_source_customer_id, p_destination_customer_id, p_request_key)
Requires CRM permission; same business only. Moves appointments, forms, conversations, invoices, payments, tags, groups, notes, consents, tasks, and verified user mappings without duplicating unique relationships; marks the source `merged`; audited.

### create_invoice(p_actor_user_id, p_business_id, p_customer_id, p_appointment_id, p_items, p_due_date, p_notes, p_request_key) / record_manual_payment(p_actor_user_id, p_invoice_id, p_amount_minor, p_method, p_request_key)
Billing permission required. Invoice numbers allocated under a business row lock; totals computed server-side. Manual payments record actor and `paid_at`, allocate transactionally, and update invoice balance/status.

### accept_member_invitation(p_subject_hash, p_token, p_actor_user_id)
Rate limit 10/10min. Requires the signed-in user's email to match the invitation; creates membership + location grants once; consumes the token; audited.

### expire_holds() → integer
Runs every minute (schedule via background job / cron) and opportunistically inside `create_booking_hold`. Expires holds by database time, revokes their capability tokens, and releases empty individual holding sessions and reservations. `FOR UPDATE SKIP LOCKED` per batch.

### get_business_analytics(p_actor_user_id, p_business_id, p_location_id, p_from_date, p_through_date) → jsonb
Requires analytics permission and location scope. Returns booking/completed/cancelled/no-show counts, new vs repeat customers, gross receipts, refunds, net revenue, value by service and staff, sources, busiest weekdays/hours, SMS segments, voice seconds, AI outcomes. Sandbox records excluded; date boundaries use the business/location timezone; `visitor_conversion` is null until real visitor events exist.

## Rate limits (server-side, hashed subjects)

| Scope | Limit |
|---|---|
| booking page / availability | 60/min |
| hold creation | 10/min |
| booking confirmation | 10/10min |
| management-token operations | 20/10min |
| public form submission | 5/10min |
| invitation acceptance | 10/10min |

Subjects are one-way hashes derived from trusted edge/network information by the calling server function — never client-supplied.
