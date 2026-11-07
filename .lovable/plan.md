# Fix rescheduling and new-business setup

## What changes
1. **Rescheduling**: moving an individual appointment updates its existing time reservation instead of creating a duplicate, so it no longer fails with a conflict.
2. **New business setup**: the owner's name comes from their profile (fallback "Owner") instead of a protected users table that caused "permission denied". Adding a business to an existing organization requires an organization owner/admin role.

## Verification (connected database, isolated test tenants)
- Reschedule an individual appointment successfully, by signed-in staff and by customer management link.
- Reschedule into an occupied slot is rejected and the appointment stays at its original time.
- A management link from one tenant/appointment cannot affect another; a forged or other-tenant actor is denied.
- Fresh owner onboarding works for a brand-new user, in two separate tenants; repeating the same request returns the same result; a non-admin org member cannot add a business to that org.
- Confirm function signatures unchanged and only the server role can run them.
- Run existing automated tests; update `docs/authorization-verification.md`, `IMPLEMENTATION_STATUS.md`, `roadmap.md` with migration name and exact pass/fail results.

## Technical details
- One new managed migration: `CREATE OR REPLACE` both functions with identical signatures; re-issue `REVOKE ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role`.
- `reschedule_appointment`: replace deactivate+insert with `UPDATE resource_reservations SET starts_at, ends_at` on `(business_id, session_id, staff_id)`; exclusion constraint violation raises and rolls back the whole transaction. Keep row-version, policy, idempotency, events.
- `provision_business`: `SELECT full_name FROM public.profiles WHERE id = p_actor_user_id`, `coalesce(...,'Owner')`; when `p_organization_id` given, require active org membership with role in (owner, admin).
- No old migrations edited; RLS untouched; Lovable Cloud not enabled.
