# Avello implementation status

Updated November 7, 2026. This document separates live production behavior, sandbox-only behavior, provider-dependent work, and remaining application wiring. Earlier functional lists describe wiring, not verification of every workflow; see the authorization verification report for current failures.

## Functional with the connected Supabase project

- Supabase email/password signup, login, session restoration, and protected dashboard access.
- Email confirmation callbacks, password-reset requests, and password-update completion screens.
- Six-step authenticated onboarding provisions an organization, Starter trial, business, owner memberships, first location, owner staff profile, hours, availability, first service, staff/location assignments, integrations, and a published booking page.
- Service-role database operations are reachable only through the deployed backend-api Edge Function. Actor IDs are derived from verified access tokens.
- Dashboard workspace snapshots are membership-authorized and loaded from Supabase. Operational records are no longer hydrated from localStorage.
- Business, service, customer, workflow, and AI-assistant configuration mutations persist through an authorization-checked server endpoint.
- Manual dashboard bookings use the same hold and confirmation engine as public bookings, with business-timezone conversion performed on the server.
- Dashboard appointment status transitions persist with actor-attributed status history, and cancellation releases the reserved staff interval.
- Blocked-time creation and release use the protected database operations.
- Public booking loads a published projection, requests authoritative availability, creates a ten-minute hold, confirms idempotently, and returns the one-time appointment management token.
- Appointment management links load a restricted projection and enforce policy, row version, conflict-safe rescheduling, and soft cancellation.
- Public forms load the active immutable published version and submit through server validation, rate limiting, honeypot protection, explicit customer mappings, and idempotency.
- The production schema contains 82 public tables and 10 private server-only tables with RLS enabled.
- Database concurrency protection includes staff reservation exclusion constraints, group-capacity row locking, expiring holds, and hashed capability tokens.
- Four unpublished subscription plans and their feature matrices are seeded without invented provider prices.
- TypeScript, the six existing unit tests, and the production build pass.

## Partially connected

- The Edge workspace snapshot now strips customer, form, billing, integration and call data by membership permission. Staff and location-restricted managers currently receive a 403 from the full workspace view until a scoped dashboard projection is built. Custom workspace writes now require the matching manager permission flag rather than manager role alone. Authenticated browser regression for this change remains to be run with isolated test tokens.
- Dashboard services, customers, customer notes/tags, workflows, settings, and AI configuration persist. Workflow steps still require a dedicated UI adapter.
- Forms submit publicly, and the dashboard creates immutable versions for both new forms and edits. CRM identity mappings are explicitly selected per field.
- Invoice creation and manual payment recording use protected database operations. Stripe collection remains provider-dependent.
- The analytics panel consumes the production analytics RPC for its 30-day operational metrics.
- Team data loads from Supabase. New services are linked to their location and active staff so they are bookable. Invitations, role editing, and time-off interfaces need final production adapters.
- Calendar data loads from Supabase and week navigation is dynamic. Additional location filtering remains.
- Database acceptance coverage is not yet at the required 50 concurrent/RLS scenarios.

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

### Explicit-actor authorization repaired November 7; workflow failures remain

Five private explicit-actor helpers and nine affected RPC authorization branches now use the server-verified actor, retaining service-role-only execution. Two isolated tenants verified owner transactions, cross-tenant rejection, manager flags, staff/inactive rejection and anonymous capability flows. Thirteen Vitest tests pass. Rescheduling still fails on an existing reservation unique-index conflict; initial provisioning fails with `42501` while reading `auth.users`. Form slug loading was repaired in the Edge gateway and verified against the published fixture. Performance advisor execution was unavailable for this user-managed backend. Exact migrations, functions and outcomes are in `docs/authorization-verification.md`; this is not a claim of complete end-to-end workflow verification.

1. Finish production adapters for team invitations/roles and automation steps.
2. Replace every remaining local-only dashboard mutation and sandbox-derived operational value.
3. Add the service-role integration harness and required RLS, idempotency, concurrency, DST, finance, consent, metering, and job tests.
4. Resolve advisor findings: unindexed foreign keys and RLS initialization-plan warnings.
5. Run end-to-end browser verification with a real owner account and a second isolated tenant.
