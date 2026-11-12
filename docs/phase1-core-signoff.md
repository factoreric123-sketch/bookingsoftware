# Phase 1 core implementation review

Date: November 12, 2026. Scope is the nine capabilities under “Phase 1: Core application” in the original product specification. This is an implementation review for an isolated pilot, not approval for public launch or a claim that the full SaaS roadmap is complete.

| Core capability | Implementation and connected evidence |
| --- | --- |
| Authentication | Email/password sign-in, session restoration, reset, and confirmation callbacks are wired. A fresh owner signup/onboarding test passed earlier with an available test inbox. Further email-delivery verification is deferred at Eric's request. |
| Multi-tenant database | Business-scoped tables and RLS are in place. Two isolated businesses passed separate public projections and cross-business availability denial. Owner, manager, staff, anonymous, and direct-RPC restrictions have connected checks. |
| Business onboarding | The six-step authenticated flow provisions organization, business, location, hours, owner staff profile, service, and published booking page. Fresh owner setup passed earlier; route refresh after provisioning was repaired. |
| Business dashboard | A hosted isolated owner session loaded Overview, Team, and Customers after the latest publish. Operational data comes from Supabase rather than local storage. Snapshot metrics disclose their bounded scope. |
| Services | Owner service creation, editing, visibility, duration, price, capacity, buffers, and staff assignment persist. Hosted owner editing and public-slot effects were previously checked. |
| Staff availability | Weekly hours, service assignments, and staff-specific blocked time persist. Hosted owner schedule changes changed public slots and were restored after testing. Default-location scheduling is covered; full multi-location management belongs to Phase 4. |
| Appointment scheduling | Public and dashboard bookings share protected hold/confirmation operations. Conflict prevention, replay, management-link reschedule/cancel, daily cap, buffers, and group capacity have connected checks. The public harness passed again November 12; its test appointment was cancelled. |
| Public booking pages | A published hosted page offered a real service and 16 Friday time choices at a 390px viewport. Selection state, accessible date names, and no document-level horizontal overflow were observed. |
| Customer records | CRM create/edit/merge, notes/tags, timeline filters, CSV import, loaded enriched export, and paginated all-contact export are wired. A hosted owner downloaded 13 contacts with 14 columns after the latest publish; the temporary file was removed. |

## Remaining verification and launch gates

- The original broader acceptance inventory, including the 50-scenario database suite, is not complete. The public booking and rollback-only invariant harnesses passed again on November 12, and 17 ordinary tests plus TypeScript and production build passed with the member-access changes.
- The hosted Account access section rendered for the isolated owner, and the database owner-only RPC passed 26 rollback-only checks. That business had no non-owner login membership, so an actual browser role edit and post-change view were not exercised.
- The all-contact export was exercised with 13 rows; a >500-row and cross-business export check remain.
- A broader dashboard accessibility audit and fresh email verification remain. Eric explicitly deferred email verification.
- Supabase's current security advisor still reports leaked-password protection disabled. The dashboard requires an account sign-in to change this Auth setting; the connected Supabase tools do not expose it. The 10 private-schema no-policy notices are intentional deny-all. Performance advisor findings remain separately documented.
- Public launch still requires approved legal text, support contact, domain/brand decisions, and any provider credentials or spend decisions listed in `PROJECT_PLAN.md`.
