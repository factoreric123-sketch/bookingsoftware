# Phase 1 connected verification

This pass used the connected Supabase project and the existing isolated authorization-test businesses A and B. It did not use real customer accounts. The normal signup endpoint returned `429 over_email_send_rate_limit`, so fresh-signup and fresh-onboarding browser checks remain unverified. Two existing test account password hashes were backed up, temporarily changed to allow sign-in, restored afterward, and compared byte-for-byte with the backups. Temporary credential and token files were cleared. A test booking was cancelled after the checks.

## Passed

- Seven authenticated authorization integration tests passed: owner analytics, cross-business rejection, manager analytics permission, manager billing denial, anonymous public booking projection, and direct RPC execution denial for anonymous and authenticated callers.
- The public booking projection loaded business A's published service and staff. Availability with an empty add-on **array** returned 191 slots over the requested date range. With an object it failed with PostgreSQL `22023` (`cannot extract elements from an object`). The public booking and dashboard callers now send arrays.
- Public hold, confirmation, and management-token issuance succeeded. Repeating confirmation with the same request key returned the same appointment. A second hold on its occupied staff slot was denied with `P0409`.
- The owner workspace snapshot contained the confirmed booking. Before repair, the snapshot failed with `42703` because `forms.archived_at` does not exist. The deployed Edge query now filters `forms.status != archived`, and the snapshot loaded successfully.
- The customer management link loaded the booking and moved it from 09:00 to 09:30 UTC. Cancellation changed the appointment and session to cancelled and marked its reservation inactive.
- Local browser testing showed the public service and available times, owner A and owner B dashboards, the cancelled booking in owner A's Bookings table, and the multi-business switcher. Account B could switch from its owner workspace to business A as a manager; that view exposed only Booking Page and Analytics, matching its permission flags. The selected business persisted across a page reload. The browser account was signed out.
- TypeScript, production build, and the six existing unit tests passed before final documentation. The seven connected authorization tests passed when isolated test tokens were supplied.

## Defects found and repaired

1. Booking callers passed `{}` for `p_addon_quantities`, although the database functions call `jsonb_array_elements`. Public availability, public hold, and dashboard hold now pass `[]`.
2. Workspace snapshots queried nonexistent `forms.archived_at`; they now exclude forms with `status = archived`.
3. A user with two full-workspace memberships could see only the oldest membership. An authenticated Edge action now lists authorized full-workspace businesses, and the dashboard can switch among them.

## Still open before the full phase is signed off

- Rescheduling moved the session time but left `appointments.row_version` at 1. Cancellation then advanced it to 2. Because the reschedule RPC checks the appointment version, a stale second reschedule could pass the same version check. The RPC needs a Lovable-managed migration that updates the appointment row in the same transaction after a successful move.
- Fresh signup and browser onboarding could not be exercised while Supabase's email-send rate limit was active. Existing onboarding database checks are documented separately in `authorization-verification.md`.
- Invitation redemption with fresh staff and manager accounts, staff browser schedule visibility, DST boundary cases, and the broader 50-scenario acceptance suite remain unverified.
- The booking interface was tested in the local browser against the live backend. A published Lovable-hosted browser smoke test has not been run in this pass.

Edge `backend-api` version 56 contains the snapshot repair, dashboard empty-add-on fix, and membership listing. Its `verify_jwt=false` setting is retained for public actions; the function verifies bearer tokens for authenticated actions.
