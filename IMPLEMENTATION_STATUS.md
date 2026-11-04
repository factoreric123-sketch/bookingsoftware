# Avello implementation status

Updated November 4, 2026. This document separates live production behavior, sandbox-only behavior, provider-dependent work, and remaining application wiring.

## Functional with the connected Supabase project

- Supabase email/password signup, login, session restoration, and protected dashboard access.
- Six-step authenticated onboarding provisions an organization, Starter trial, business, owner memberships, first location, owner staff profile, hours, availability, first service, staff/location assignments, integrations, and a published booking page.
- Service-role database operations are reachable only through the deployed backend-api Edge Function. Actor IDs are derived from verified access tokens.
- Dashboard workspace snapshots are membership-authorized and loaded from Supabase. Operational records are no longer hydrated from localStorage.
- Business, service, customer, workflow, and AI-assistant configuration mutations persist through an authorization-checked server endpoint.
- Manual dashboard bookings use the same hold and confirmation engine as public bookings.
- Blocked-time creation and release use the protected database operations.
- Public booking loads a published projection, requests authoritative availability, creates a ten-minute hold, confirms idempotently, and returns the one-time appointment management token.
- Appointment management links load a restricted projection and enforce policy, row version, conflict-safe rescheduling, and soft cancellation.
- Public forms load the active immutable published version and submit through server validation, rate limiting, honeypot protection, explicit customer mappings, and idempotency.
- The production schema contains 82 public tables and 10 private server-only tables with RLS enabled.
- Database concurrency protection includes staff reservation exclusion constraints, group-capacity row locking, expiring holds, and hashed capability tokens.
- Four unpublished subscription plans and their feature matrices are seeded without invented provider prices.
- TypeScript, the six existing unit tests, and the production build pass.

## Partially connected

- Dashboard services, customers, workflows, settings, and AI configuration persist. Some detailed child records such as customer notes/tags and workflow steps still require dedicated UI adapters.
- Forms submit publicly, while the dashboard form builder still needs full draft/version publishing mutations.
- Invoices and manual payments have protected database operations, while remaining dashboard controls still need complete adapter wiring.
- Analytics has a production RPC; all dashboard analytics panels still need to consume it consistently.
- Team data loads from Supabase. Invitations, role editing, service assignment, and time-off interfaces need final production adapters.
- Calendar data loads from Supabase and week navigation is dynamic. Additional location filtering and timezone-specific datetime entry remain.
- Database acceptance coverage is not yet at the required 50 concurrent/RLS scenarios.

## Sandbox only

- AI receptionist test conversations and call logs are simulations. They never claim a real telephone call occurred.
- Sandbox call records must remain marked sandbox and excluded from production analytics.

## Waiting only for external credentials or approval

- Google Calendar and Google Auth require Google OAuth client credentials and callback configuration.
- Outlook Calendar requires a Microsoft Entra application.
- Stripe payments, subscriptions, and Connect require Stripe credentials, webhook secrets, price IDs, and platform account decisions.
- Twilio SMS and telephone numbers require Twilio credentials, messaging registration, and webhook configuration.
- Live AI voice requires an approved telephony/voice provider plus transfer, recording-consent, and retention decisions.
- Transactional email requires a provider account and verified sender domain.
- Google Book Online requires official partner approval.

## Remaining internal work

1. Finish production adapters for team invitations/roles, form authoring/version publishing, invoices/manual payments, customer notes/tags, and automation steps.
2. Replace every remaining local-only dashboard mutation and sandbox-derived operational value.
3. Connect all analytics panels to get_business_analytics.
4. Add password recovery and email-confirmation callback screens.
5. Add the service-role integration harness and required RLS, idempotency, concurrency, DST, finance, consent, metering, and job tests.
6. Resolve advisor findings: unindexed foreign keys and RLS initialization-plan warnings.
7. Run end-to-end browser verification with a real owner account and a second isolated tenant.
