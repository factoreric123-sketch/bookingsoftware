# Avello delivery checklist

This checklist tracks the original product spec against the current implementation. A checked item means it is implemented, not that every browser scenario has passed. `IMPLEMENTATION_STATUS.md` and the verification documents contain the evidence and limits. Work in the first section does not require Eric's input. Do not spend Lovable credits for ordinary code work. Schema migrations are Lovable-managed under `AGENTS.md`; batch and request those changes only when implementation needs them.

## Built already

- [x] Multi-tenant Supabase schema, RLS, service-only booking operations, reservation conflict protection, ten-minute holds, and hashed management tokens.
- [x] Email/password auth, password reset, onboarding, published public booking, guest booking, customer management links, and public forms.
- [x] Database-backed owner dashboard for bookings, customers, services, staff profiles, forms, invoices, analytics, and blocked time.
- [x] Staff schedule isolation, manager permission checks, and one-time staff/manager invitation links at the database and Edge layers.
- [x] Sandbox AI call testing, clearly separated from live calls and production analytics.

## I can do independently, in priority order

### 1. Prove the core works end to end

- [ ] Create isolated test owner, manager, staff, and customer accounts; test signup, onboarding, invitation redemption, and role-specific browser views. Fresh owner signup and onboarding passed with an available test inbox. The first dashboard navigation exposed a stale workspace; the onboarding route now reloads after provisioning. Existing owner/manager views, staff view, and Edge invitation redemption passed. Further email verification testing is deferred at Eric's request. See `docs/phase1-verification.md`.
- [x] Exercise public booking, dashboard booking, management links, rescheduling, cancellation, conflict handling, and daylight-saving boundaries in two separate businesses. Both isolated businesses passed public booking, management, dashboard booking, rescheduling, and cancellation; stale-version and occupied-slot conflicts were rejected. B also passed live spring/fall availability, booking, and cancellation checks. See `docs/phase1-verification.md`.
- [ ] Add the service-role integration harness and the remaining required RLS, idempotency, concurrency, finance, consent, metering, and job scenarios. Repeatable public Edge and rollback-only SQL harnesses now cover those critical invariants, including service-role and anonymous direct-RPC checks. The original broader 50-scenario acceptance inventory and provider-backed cases still need reconciliation.
- [x] Verify invoice balances and manual payment totals in a hosted owner session. The isolated $100 invoice accepted $40 cash and $60 bank transfer; the UI and database agreed on the partial and final balances, and the paid state persisted after reload. See `docs/phase1-verification.md`.
- [ ] Verify mobile layout, loading and error states, accessibility of the main booking and dashboard journeys. Hosted public booking, B owner overview/Bookings, and Team passed 390px width checks; invalid booking loading/error state passed after publication. Main mobile navigation and dialog controls have accessible labels. Booking choices announce selected state and the published page exposes full date names; local keyboard focus and Enter selection passed. A natural-expiry browser recovery check passed on the hosted B page. A broader dashboard accessibility audit remains.

### 2. Finish reliable scheduling and team operations

- [ ] Fix business-timezone date handling and remaining dashboard statistics so displayed dates and metrics match stored records. Overview chart, calendar week, and booking/AI form default dates use the business timezone. Booked revenue now sums appointment totals captured at booking rather than current service prices; a live priced-booking comparison and the remaining metric review are open.
- [ ] Add staff availability, time-off, service-assignment editing, and location-assignment editing with authorization and conflict checks. Service-assignment editing persists and passed an isolated hosted owner test. Newly created staff inherit the selected location's weekly hours and appeared with bookable public slots. The hosted weekly editor and public booking now honor edited staff hours; the isolated test schedule was restored after verification. Staff-specific blocked time exists in Calendar. Location-assignment editing, broader time-off controls, and cross-business/stale-version editor checks remain.
- [ ] Add owner-controlled member permission and role editing with audit history; preserve access isolation.
- [ ] Complete day/month/staff/location calendar views and appointment detail editing. Add drag-and-drop only after server-checked rescheduling is verified.
- [ ] Finish booking policy controls: owner Settings persists slot interval, notice window, advance window, cancellation cutoff, reschedule cutoff, optional daily cap, and manual approval. Pending approval, customer cancellation, service/staff buffers, two-seat group capacity, last-attendee cancellation, and natural hold expiry passed hosted checks. A one-per-day cap hid Thursday after one booking, cancellation restored its slots, and the setting was reset to unlimited. Hold creation now locks and enforces the cap, and group availability respects it; connected rollback-only boundaries passed. The hold RPC now requires an exact offered slot; rollback-only probes rejected out-of-hours, off-grid, inactive-staff, and mismatched group-session requests while accepting valid slots. A fresh hosted booking confirmed and cancelled after the migration. Concurrent two-connection cap behavior remains untested.
- [ ] Expand multi-location operations, location filters, and business switching before multi-brand administration.

### 3. Finish customer and form workflows

- [ ] Add customer CSV import with validation, deduplication preview, and per-row error reporting; verify export content.
- [ ] Complete customer timeline, activity filters, form/payment/booking tabs, and privacy export/deletion workflow.
- [ ] Extend form editing with the supported field types, embeds, intake-form association, submission search/filter/export, and safe file handling.
- [ ] Review every dashboard control for a real persisted action or an explicit unavailable state.

### 4. Finish internal infrastructure and administration

- [ ] Build and verify the domain-event/job runner, retries, idempotent deliveries, execution logs, and operational alerts before workflow activation.
- [ ] Implement non-provider automation actions first, such as task creation and internal notifications; gate email/SMS actions on configured providers and consent.
- [ ] Add a platform super-admin API and dashboard with server-side authorization, audit logging, tenant management, plan editing, usage limits, and aggregate metrics.
- [ ] Implement subscription entitlements and usage metering independent of Stripe collection; keep plans unpublished until pricing is approved.
- [ ] Resolve the documented database advisor findings, prioritizing RLS performance and high-traffic foreign-key indexes. Use the Lovable-managed schema path when a migration is required.
- [ ] Expand the marketing site into the spec's features, industries, pricing, integrations, FAQ, contact, and legal-placeholder pages. The published landing page now has truthful features, industry examples, provider status, FAQ, and pricing status; contact and legal-placeholder pages remain. Do not invent testimonials or prices.
- [ ] Run the full release checklist: type check, build, tests, security review, two-tenant browser smoke test, and deployment/sync verification.

## I can prepare, then need Eric to connect or decide

- [ ] **Google Calendar / Google sign-in:** prepare OAuth callbacks, token handling, sync logic, and settings; Eric supplies a Google Cloud project, OAuth client credentials, consent-screen setup, and approved redirect domains.
- [ ] **Outlook Calendar:** prepare the provider adapter; Eric supplies a Microsoft Entra app registration and credentials.
- [ ] **Stripe:** prepare SaaS billing and separate business-payment/Connect flows, webhooks, and sandbox tests; Eric supplies a Stripe account, keys/webhook setup, plan prices, tax/Connect decisions, and approval before live charges.
- [ ] **Twilio:** prepare inbox, SMS/call webhooks, opt-out logic, templates, and sandbox tests; Eric supplies a Twilio account, phone numbers, credentials, messaging registration, and sender/consent decisions.
- [ ] **Transactional email:** prepare confirmation/reminder templates and retry handling; Eric connects an email provider and verifies a sender domain.
- [ ] **Live AI voice:** prepare the real booking-tool interface and safety checks; Eric selects/connects a voice and telephony provider and decides on transfers, recording consent, and retention. Keep simulations labeled until live calls are verified.
- [ ] **Google Book Online:** provide the shareable link and integration status now; official booking integration requires partner approval.
- [ ] **Public launch:** Eric approves brand identity, domain, legal terms/privacy text, plan prices and limits, trial policy, refund/cancellation rules, and any live provider spend.

## Execution rule

Work through independent items in order, commit and push working changes normally to `main`, and update this checklist with evidence. Ask Eric only at a real credential, provider approval, spend, legal, or product-decision boundary. Never force-push the Lovable-connected branch or manually edit `supabase/migrations`.
