# Member invitation acceptance verification

Date: 2026-11-07. Connected project: `tkjyfyjsbswbhbixvbjj`.

## Applied repair

Lovable-managed migration: **`20261107221116_4e629aee-00a2-4546-9700-62c51a84f816.sql`**.

The migration first reproduced `42501` when the existing acceptance RPC ran as `service_role` and attempted to read `auth.users`. Its baseline fixtures were rolled back. The first migration attempt contained a regression-test syntax error; the corrected retry applied successfully and executed all assertions below.

The repair adds `private.invitation_actor_has_verified_email(uuid,text)`: a boolean-only, SQL `SECURITY DEFINER` helper with fixed empty `search_path`, a fully qualified `auth.users` reference, and execution restricted to `service_role` (plus its owner). It matches the explicit actor's user ID and lowercase email and requires non-null `email_confirmed_at`; it returns no directory rows or email values. Missing users, null emails, and unconfirmed emails fail closed.

`public.accept_member_invitation(text,text,uuid)` remains `SECURITY INVOKER`, service-role-only, with the same signature and explicit actor. Only its direct email lookup/comparison was replaced by the private check; token digest checks, expiry, invitation row locking, membership creation/reuse, permissions, location assignment, audit, redemption state, error message, and response remain unchanged. No request `auth.uid()` authorization, broad `auth.users` grant, RLS change, old migration edit, frontend edit, or Edge edit was introduced.

## Exact connected transactional results

**22/22 assertions passed**, inside the successful migration. Acceptance and denial calls ran after `SET LOCAL ROLE service_role`, with an assertion that `current_user = 'service_role'`; direct-call checks used actual `anon` and `authenticated` database roles. Fixtures were created as the migration owner, then every fixture and side effect was rolled back using a caught sentinel exception. These are database-role tests, not build-based claims.

| # | Assertion | Result |
|---|---|---|
| 1 | Matching confirmed email, valid token | Success; correct business, membership ID and manager role returned |
| 2 | Membership permissions | Active manager; requested customer/analytics flags enabled, staff/billing flags false, all-locations false |
| 3 | Location scopes | Exactly the invited business/location assigned |
| 4 | Audit | `member.invitation_accepted` with correct business, explicit actor, member ID and user actor type |
| 5 | One-time redemption state/digest | Invitation accepted; token revoked and last-used set; stored hash still matches SHA-256 digest |
| 6 | Replay of successfully redeemed token | Denied `P0403` |
| 7 | Different confirmed actor email | Denied `P0403` |
| 8 | Matching but unconfirmed actor email | Denied `P0403` |
| 9 | Expired token | Denied `P0403` |
| 10 | Revoked token | Denied `P0403` |
| 11 | Expired invitation | Denied `P0409` |
| 12 | Revoked invitation | Denied `P0409` |
| 13 | Already accepted invitation with otherwise live token | Denied `P0409` |
| 14 | Nonexistent explicit actor | Denied `P0403` |
| 15 | Null explicit actor | Denied `P0403` |
| 16 | Altered token/digest mismatch | Denied `P0403` |
| 17 | Tenant A actor attempts tenant B invitation for a different email | Denied `P0403` |
| 18 | Tenant B matching actor accepts its invitation | Success in B, correct B location, no A/B cross-memberships |
| 19 | Denied calls' side effects | No newly accepted denial-case invitations or unverified actor membership |
| 20 | Direct `anon` acceptance call | Denied `42501` |
| 21 | Direct `authenticated` acceptance call | Denied `42501` |
| 22 | Least-privilege grants | Service role still lacks `auth.users` SELECT; helper denied to anon/authenticated; helper and RPC executable by service role |

An additional rollback assertion passed: no fixture users, organization, invitations or audit records remained. A fresh catalog query independently confirmed **zero fixture users and zero fixture organizations**, `service_role` auth-directory SELECT=false, RPC anon EXECUTE=false, authenticated EXECUTE=false, service_role EXECUTE=true, and the deployed helper/acceptance definitions.

## Security advisor and limits

Security advisor before and after: **11 unchanged pre-existing findings; zero new findings**. Ten are informational RLS-enabled/no-policy findings on intentionally deny-all private tables; one warning is disabled leaked-password protection. These settings were not changed in this narrowly scoped repair.

No Edge/HTTP or frontend flow was exercised or edited. No concurrent race test was run; the existing invitation row lock and one-time state checks were preserved. The database trusts the server-supplied explicit actor ID as before; this helper does not verify HTTP bearer tokens. A valid invitation grants membership only in its own business; an actor need not already belong to that business. No unrequested business-membership prerequisite was introduced.