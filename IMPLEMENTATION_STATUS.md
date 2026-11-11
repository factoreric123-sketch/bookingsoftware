# Avello implementation status

Updated November 11, 2026. This document separates live production behavior, sandbox-only behavior, provider-dependent work, and remaining application wiring. Feature wiring does not imply full browser verification. The latest browser and connected-database results are in `docs/phase1-verification.md`.

## Functional with the connected Supabase project

- Supabase email/password signup, login, session restoration, and protected dashboard access.
- Email confirmation callbacks, password-reset requests, and password-update completion screens.
- Six-step authenticated onboarding provisions an organization, Starter trial, business, owner memberships, first location, owner staff profile, hours, availability, first service, staff/location assignments, integrations, and a published booking page.
- Service-role database operations are reachable only through the deployed backend-api Edge Function. Actor IDs are derived from verified access tokens.
- Dashboard workspace snapshots are membership-authorized and loaded from Supabase. Operational records are no longer hydrated from localStorage.
- Business, service, customer, workflow-draft, and AI-assistant configuration mutations persist through an authorization-checked server endpoint. Service creation, editing, and visibility changes are available in the dashboard; duration and price can be edited precisely. Customer, business, and AI save controls wait for the server response.
- Manual dashboard bookings use the same hold and confirmation engine as public bookings, with business-timezone conversion performed on the server.
- Dashboard appointment status transitions persist with actor-attributed status history, and cancellation releases the reserved staff interval. Dashboard rescheduling now uses the protected RPC with business-timezone conversion and row-version conflict checks; see `docs/dashboard-reschedule-verification.md` for its verification limit.
- Blocked-time creation and release use the protected database operations; the calendar reports release failures.
- Public booking loads a published projection, requests authoritative availability, creates a ten-minute hold, confirms idempotently, and returns the one-time appointment management token.
- Booking holds now require an exact offered slot, including current staff assignments and hours; the connected database rejects out-of-hours, off-grid, inactive-staff, and mismatched group-session requests. A hosted booking confirmed and cancelled after this repair.
- Owner booking rules persist slot interval, notice and advance windows, cancellation and rescheduling cutoffs, optional daily cap, and manual approval. The daily cap is enforced during hold creation under a business-settings row lock and in individual/group availability. A one-per-day hosted boundary, rollback-only direct-hold checks, and a two-connection concurrency check passed.
- Services and staff profiles persist before/after buffers. Hosted availability blocked an adjacent slot for a staff after buffer. Staff weekly hours can be edited and public slots follow the changed hours.
- Two-seat group bookings accepted two separate customers and hid a full slot. Last-attendee cancellation and natural hold expiry now release hold-created group sessions and staff reservations. Public booking is restricted to one seat per request until multi-seat pricing and checkout are implemented.
- Appointment management links load a restricted projection and enforce policy, row version, conflict-safe rescheduling, and soft cancellation.
- Public forms load the active immutable published version and submit through server validation, rate limiting, honeypot protection, explicit customer mappings, and idempotency.
- The production schema contains 82 public tables and 10 private server-only tables with RLS enabled.
- Database concurrency protection includes staff reservation exclusion constraints, group-capacity row locking, expiring holds, and hashed capability tokens.
- Four unpublished subscription plans and their feature matrices are seeded without invented provider prices.
- TypeScript, 17 ordinary tests, and the production build pass. Eight connected authorization tests are opt-in and skipped in the ordinary run.
- The landing page distinguishes the working booking workspace from sandbox AI and unconfigured provider integrations. It no longer displays copied testimonials, invented results, or unapproved plan prices.
- Owner Overview booked revenue uses the appointment's captured total. A hosted $20 booking remained $20 in Overview after its service price changed to $30; the test appointment was cancelled and the service price restored.
- Customer CSV import previews validation and duplicates, then writes approved rows with per-row results. A hosted three-row import added the valid customer with source, tags, and note while skipping the duplicate and rejecting the invalid email.

## Partially connected

- The Edge workspace snapshot strips customer, form, billing, integration and call data by membership permission. Staff and location-restricted managers use a separate scoped schedule. The manager schedule lists only sessions in assigned locations and omits customer identities; the staff schedule lists only bookings assigned to the matched profile. Custom workspace writes require the matching manager permission flag. Authenticated browser regression remains to be run with isolated test tokens.
- Dashboard services, customers, customer notes/tags, settings, and AI configuration persist. Customer profiles can merge into another customer through the protected RPC, with a confirmed destination and workspace refresh; see `docs/customer-merge-verification.md` for the rollback-only check. Workflow drafts store a create-task step and a database trigger value; activation remains disabled until a job runner exists.
- Forms submit publicly, and the dashboard creates immutable versions for both new forms and edits. CRM identity mappings are explicitly selected per field.
- Invoice creation and manual payment recording use protected database operations. Stripe collection remains provider-dependent.
- The analytics panel consumes the production analytics RPC for its 30-day operational metrics.
- Team data loads from Supabase. Scheduling profiles can be created and edited (name, email, activity, weekly capacity, service assignments, buffers, and weekly availability); hosted owner editing and public-slot effects passed. Owners can create staff or manager invitations with explicit permission flags through service-role-only RPCs and a one-time link; managers with staff permission can invite staff. Full dashboard navigation follows the verified membership flags. Invited staff have a scoped schedule showing only their profile's appointments and invited locations; a unique verified-email profile match is used when a profile has no user link. Invitation redemption and scoped staff views passed isolated browser checks. Existing-member role editing, broader time-off controls, and location-assignment editing remain.
- Calendar data loads from Supabase and week navigation is dynamic. Dashboard date defaults and chart dates use the business timezone. Additional location filtering remains.
- Database acceptance coverage is not yet at the required 50 concurrent/RLS scenarios. Repeatable public-booking and rollback-only SQL harnesses cover key two-tenant, conflict, replay, and authorization paths.

## Sandbox only

- AI receptionist test conversations and call logs are persisted simulations. They never claim a real telephone call occurred and never create or reserve a production appointment.
- Sandbox call records are marked sandbox and excluded from production analytics.

## Waiting only for external credentials or approval

- Google Calendar and Google Auth require Google OAuth client credentials and callback configuration.
- Outlook Calendar requires a Microsoft Entra application.
- Stripe payments, subscriptions, and Connect require Stripe credentials, webhook secrets, price IDs, and platform account decisions.
- Twilio SMS and telephone numbers require Twilio credentials, messaging registration, and webhook configuration.
- Live AI voice requires an approved telephony/voice provider plus transfer, recording-consent, and retention decisions.
- Transactional email requires a provider account and verified sender domain.
- Google Book Online requires official partner approval.

## Remaining internal work

### Authorization and booking repairs

Five private explicit-actor helpers and nine affected RPC authorization branches now use the server-verified actor, retaining service-role-only execution. Later migrations repaired the reservation conflict in rescheduling and the protected users-table read during provisioning; connected transactional checks passed. Published form fields reject insertion, update, and deletion once published. Invitation creation and redemption passed database-role checks. The Edge invitation flow has a production build and type check, but no authenticated browser run with two isolated accounts yet. The connected security, performance, and health advisors now run; their current counts and limits are in `docs/database-advisor.md`. See `docs/authorization-verification.md`, `docs/published-form-fields-verification.md`, and `docs/member-invitations-verification.md` for exact database results.

1. Finish role editing and the automation event/job runner; keep workflow drafts inactive until then.
2. Replace every remaining local-only dashboard mutation and sandbox-derived operational value.
3. Add the service-role integration harness and required RLS, idempotency, concurrency, DST, finance, consent, metering, and job tests.
4. Resolve advisor findings: unindexed foreign keys and RLS initialization-plan warnings.
5. Run end-to-end browser verification with a real owner account and a second isolated tenant.
