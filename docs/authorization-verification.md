# Explicit-actor authorization verification

Date: 2026-11-07. Connected Supabase project: `tkjyfyjsbswbhbixvbjj`. Lovable Cloud was not enabled.

## Applied migrations

- Authorization repair: `20261107212257_19e4652d-42e0-467e-9eef-c5cfd002ef80.sql`.
- Separate blocked-time conflict-clause repair: `20261107212452_a568b678-6210-4e51-a347-7a252bb12001.sql`. Replaced a nonexistent named constraint with inference of the existing partial unique index.
- Rollback-only permission regression: `20261107212602_2ed64124-e92d-4471-b566-1cdcec289b2e.sql`. Fixture membership changes rolled back after assertions.
- Isolated fixtures: `20261107212213_46244d06-c390-4720-85a9-9a89fc0c05e0.sql` and `20261107212340_e5bea526-5866-4375-8b58-1915fd3db680.sql`.

## Every function added or changed

Added private helpers:

1. `actor_is_org_admin_for_business`
2. `actor_business_role`
3. `actor_has_business_access`
4. `actor_business_permission`
5. `actor_has_location_access` (needed to preserve location scope)

Changed public RPCs:

1. `create_blocked_time`
2. `release_blocked_time`
3. `merge_customers`
4. `create_invoice`
5. `record_manual_payment`
6. `get_business_analytics`
7. `confirm_booking` (known-customer authorization)
8. `reschedule_appointment` (actor fallback only)
9. `cancel_appointment` (actor fallback only)

All helpers and protected RPCs retain service-role-only execution. Safe fixed search paths are set on helpers. The migration asserts that no other explicit-actor public RPC retains the old request-context authorization pattern. RLS helpers still use auth.uid() appropriately; RLS was not disabled or widened. backend-api continues to discard supplied actor IDs and derive identity from verified bearer tokens.

## Exact verification results

Baseline: owner A analytics failed with `P0403`, “analytics permission required.” The same request succeeds after repair.

- Connected request suite: **26/26 passed**. Owner A analytics and location analytics, block/release, invoice and manual payment succeeded (HTTP 200). Owner A operations against B, including release/payment of B records, failed with `P0403` (HTTP 400). Owner B block/release and invoice succeeded for B. Manager enabled analytics succeeded; disabled billing failed with `P0403`. Anonymous page, availability, hold, confirmation, management-token read and form submission succeeded. Anonymous confirmation ignored a forged actor. Direct analytics and blocked-time execution returned `42501`: HTTP 401 for anon and 403 for authenticated.
- Known-customer suite: **5/5 passed**. Anonymous hold succeeded; guest known-customer confirmation and manager confirmation without CRM permission failed with `P0403`; owner known-customer confirmation and owner actor-fallback cancellation succeeded. Appointment created_by_user_id matched the verified owner.
- Rollback-only database assertions passed: manager flag enabled/disabled behavior, staff management rejection even with true flags, inactive membership rejection, null actor denial, unknown permission denial, organization administrator role/scope/active checks. Staff invoice/block and inactive analytics/block RPCs returned `P0403`.
- Vitest: **13/13 passed**, comprising seven connected authorization regressions plus the six existing tests. Connected tests remain opt-in with environment-supplied isolated-user tokens.
- Browser: anonymous form submission through the form UUID displayed **“Response received”**. No signed-in session was used.
- Latest preview build log: **build OK**.

## Failing or unverified scenarios

- Authenticated and anonymous-token rescheduling reach the repaired authorization branch but fail with `resource_reservations_session_uidx` duplicate-key conflict (HTTP 409). Existing logic deactivates a reservation and inserts another, while the unique index includes inactive rows. Transaction logic/indexes were not changed as part of this authorization contract. Cancellation by a valid anonymous management token passed.
- The attempted “wrong tenant reschedule” used user B, who is also a manager in A; that is not a valid cross-tenant test. Do not count it as tenant-isolation evidence for rescheduling.
- Public form UUID loading and submission pass; loading the same fixture by slug returns HTTP 404 despite published state. Separate identifier-resolution issue.
- Initial test provisioning returned `42501`, “permission denied for table users”; explicit isolated fixtures were used instead. Provisioning is not verified by this task.
- Customer merge authorization was updated, but a complete merge transaction was not exercised.
- Signed-in dashboard browser flows were not verified; owner operations were tested through the real deployed endpoint with real verified test-user access tokens.
- Security advisor: ten intentional private-table “RLS Enabled No Policy” INFOs and one “Leaked Password Protection Disabled” WARN remain. No new permissive policies were added.
- Performance advisor could not be completed: the diagnostic command refuses user-managed Supabase backends. Slow-query inspection ran, but is not a substitute for the performance advisor.
- Isolated test users, tenants and transaction records remain under conspicuous authorization-verification names. No production user records were modified by these fixtures; cleanup has not been performed.

The authorization mismatch is repaired and tested for the listed cases, but the full workflow verification is **not complete** because of the failures and unavailable advisor above.