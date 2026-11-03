# Avello implementation status

This file distinguishes working product behavior from provider-dependent or schema-dependent work. The preview workspace is intentionally labeled in the UI and stores data in browser storage until the production Supabase schema is created through Lovable.

## Working now

- Responsive marketing website with real navigation to signup, onboarding, preview dashboard, and public booking.
- Supabase email/password signup and login through the connected project.
- Six-step business onboarding flow.
- Tenant-shaped domain model for businesses, services, customers, appointments, hours, and integrations.
- Persistent preview workspace with editable business profile.
- Services: create, list, price, duration, and active/hidden state.
- Customers: create, list, tags, appointment count, and calculated lifetime value.
- Appointments: create, list, filter-ready table, and status updates.
- Scheduling engine that derives availability from business hours and service duration.
- Conflict prevention before appointment creation.
- Public mobile-first booking page with service, date, time, customer details, and confirmation.
- Private per-appointment management links with view, reschedule, cancel, conflict prevention, and immediate availability release.
- Dashboard metrics, real workspace-derived values, schedule, setup checklist, and activity chart.
- Team directory with roles, service assignment, weekly capacity, and member creation.
- Form builder with configurable fields, required flags, share links, response status, and persistent drafts.
- Public form URLs with required-field validation, persisted submissions, submission counts, and automatic customer association by email.
- Automation configuration with triggers, actions, activation state, run counts, and explicit execution-safety boundaries.
- Invoice creation, due dates, statuses, collection totals, and honest Stripe-offline state.
- Analytics calculated from actual preview bookings, customers, services, sources, and paid invoices.
- Integrations status screen that never presents unconfigured providers as working.
- Responsive desktop/mobile layouts.

## Production schema blocked on Lovable database tooling

The repository's `AGENTS.md` explicitly says database migrations must be created through Lovable rather than edited by hand. The connected Supabase project currently reports no public tables. The production adapter therefore remains pending until Lovable creates and regenerates types for:

- profiles, organizations, businesses, business_members
- locations, services, service_addons
- staff_profiles, staff_availability, staff_time_off, business_hours
- appointments, appointment_services, appointment_holds
- customers, customer_notes, customer_tags, custom_fields
- booking_pages, forms, form_fields, form_submissions
- conversations, messages, phone_numbers, calls, ai_assistant_settings
- calendar_connections, calendar_events, integrations
- payments, invoices, refunds
- automation_workflows, automation_runs
- subscription_plans, subscriptions, usage_events
- audit_logs, webhook_events, notifications

Required database work includes UUID keys, tenant foreign keys, unique constraints, indexes, deletion policies, audit fields, RLS, role checks, idempotency keys, and secure booking-management tokens.

## Provider-dependent work not falsely implemented

- Google Calendar OAuth and token refresh: requires Google OAuth credentials and callback configuration.
- Outlook Calendar: requires a Microsoft Entra application.
- Stripe subscriptions and Stripe Connect: requires Stripe account decisions, webhook secrets, plan IDs, and Connect configuration.
- Twilio SMS and phone numbers: requires Twilio credentials, messaging registration, webhook URLs, and consent policy choices.
- AI phone receptionist: requires a telephony/voice provider, credentials, transfer behavior, recording consent, and retention choices.
- Transactional email: requires a Resend-compatible provider and verified sender domain.
- Google Book Online: requires the official partner approval process; it is marked pending approval in product UI.

## Next implementation order

1. Create the Phase 1 schema and RLS through Lovable, regenerate Supabase types, and replace the preview adapter.
2. Add authenticated membership guards and server-side role enforcement.
3. Add staff profiles, availability, time off, and multi-location scheduling.
4. Add secure customer manage/reschedule/cancel tokens.
5. Add messaging provider adapters, transactional events, and reminder jobs.
6. Add Stripe/Connect, calendar providers, webhook idempotency, and usage accounting.
7. Promote forms, automations, invoices, and analytics from the preview adapter to production tables and background jobs.
8. Add super-admin, multi-location, and multi-brand capabilities.
9. Add AI SMS and voice only after the scheduling engine is production-backed.
