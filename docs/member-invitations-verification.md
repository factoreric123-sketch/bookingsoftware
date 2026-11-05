# Member invitation verification

## Creation migration

Date: 2026-11-07. Connected project: `tkjyfyjsbswbhbixvbjj`. Lovable Cloud was not enabled.

## Migration

`20261107220736_c6958f42-ece3-4a0c-8170-07ca2117968f.sql`

Adds only `public.create_member_invitation(p_actor_user_id uuid, p_business_id uuid, p_email text, p_role text, p_location_ids uuid[], p_permissions jsonb) RETURNS jsonb`. It is SECURITY INVOKER with an empty fixed search path. EXECUTE is revoked from PUBLIC, anon and authenticated and granted only to service_role. Historical migrations, frontend and Edge files were not edited. Existing tables, RLS, table grants and `accept_member_invitation` were not changed.

## Behavior

- Requires an active business membership: owner, or manager with `can_manage_staff=true`. No request-context `auth.uid()` authorization or organization-admin bypass is used.
- Managers can invite staff only, cannot grant flags they lack, and cannot grant locations outside their membership scope. Null/empty location arrays mean all locations under existing acceptance semantics, so scoped managers must supply a nonempty list. Owners and all-location managers may use an empty list. Duplicate location IDs are deduplicated; null elements and multidimensional arrays are rejected.
- Email is trimmed and lowercased, requires a reasonable ASCII address format, local part at most 64 characters and total length at most 254. Internationalized addresses are not supported by this validator.
- Role is exactly manager or staff. Permissions must be a JSON object containing only exact boolean values for `can_manage_customers`, `can_manage_services`, `can_manage_staff`, `can_manage_forms`, `can_manage_messages`, `can_manage_automations`, `can_view_analytics`, and `can_manage_billing`. Omitted flags default false. Staff true flags are rejected; successful staff invitations store all eight flags as false.
- A business-row lock serializes creation and the duplicate check. An existing unaccepted, unrevoked, unexpired invitation for the normalized business/email is rejected with P0409; it is not silently replaced.
- Generates a URL-safe token from 32 cryptographically random bytes through the existing database helper. Only its SHA-256 digest is stored in `private.capability_tokens`. The response contains `invitation_id`, `token`, and `expires_at`; no raw token is persisted or replayed. Both invitation and token expire exactly seven days after transaction time. No email is sent.

## Exact transactional assertions

All 30 assertions executed against the connected database in a nested rollback-only subtransaction within the managed migration. Creation calls were made with `SET ROLE service_role`, not just as the migration administrator. Tokens and recipient email were kept in SQL variables and never printed.

| # | Check | Observed result |
|---|---|---|
| 1 | Owner creates manager invite; uppercase/whitespace email; selected permission; expiry | Success; normalized email, verified inviter, true forms flag, seven-day expiry read back |
| 2 | Token storage and response | 43-character token; stored 32-byte SHA-256 digest equals digest of response token, differs from raw token bytes; token expiry equals response expiry |
| 3 | Duplicate live invite | P0409 |
| 4 | Manager invites manager | P0403 |
| 5 | Owner invitation role | P0400 |
| 6 | Manager grants billing they lack | P0403 |
| 7 | Foreign-business location | P0403 |
| 8 | Scoped manager requests empty/all-location array | P0403 |
| 9 | Owner A creates in business B | P0403 |
| 10 | Null actor | P0403 |
| 11 | Invalid email | P0400 |
| 12 | Unknown permission key | P0400 |
| 13 | String permission value | P0400 |
| 14 | Numeric permission value | P0400 |
| 15 | JSON null permission value | P0400 |
| 16 | Permissions array instead of object | P0400 |
| 17 | Owner supplies true staff permission | P0400 |
| 18 | Null location element | P0400 |
| 19 | Scoped manager creates staff invite with duplicate allowed location IDs and SQL-null permissions | Success; one normalized location, all eight flags false |
| 20 | Manager requests own-business location absent from member_locations | P0403 |
| 21 | Active staff actor, even with can_manage_staff=true | P0403 |
| 22 | Inactive manager actor | P0403 |
| 23 | Active manager without can_manage_staff | P0403 |
| 24 | Redemption by actor with different email | P0403, checked as migration role |
| 25 | Existing accept RPC called as service_role with matching actor | **Existing failure reproduced: 42501, permission denied reading auth.users** |
| 26 | Same invitation redeemed by matching actor as migration role | Success; staff membership and specified location read back; invitation accepted_at and token revoked_at/last_used_at set |
| 27 | Replay of consumed token | P0403, checked as migration role |
| 28 | Direct anon creation RPC call, even supplying owner UUID | 42501 |
| 29 | Direct authenticated creation RPC call, even supplying owner UUID | 42501 |
| 30 | Acceptance definition and EXECUTE ACL unchanged | Exact function-definition equality; anon/authenticated false, service_role true |

**30/30 assertion expectations passed. This does not mean service-role redemption succeeded:** assertion 25 explicitly reproduces an existing failure, and assertion 26 uses the more privileged migration role to verify unchanged acceptance logic with the newly generated token.

The first migration attempt failed before application because the test email local part exceeded 64 characters: `case foreign location returned unexpected SQLSTATE P0400`. Only the fixture prefix was shortened for the retry; the email validator was not relaxed. The corrected migration succeeded.

All inserted invitations, tokens, accepted memberships, member-location changes, rate-limit records and acceptance audit entries were rolled back by the caught subtransaction exception. Post-migration query found **zero** invitations with the regression prefix. Existing isolated authorization-test users/businesses were referenced; no new users or tenants were left behind.

## Security and live catalog

- Catalog confirms creation and acceptance are SECURITY INVOKER, with EXECUTE false for anon/authenticated and true for service_role. There is one creation signature.
- Security advisor run after migration: **11 pre-existing findings, no new findings introduced**. Ten intentional private-table no-policy INFOs and one leaked-password-protection-disabled WARN remain unchanged.
- Build log showed `build OK`; results above come from actual transactional SQL calls and catalog reads, not the build.

## Limits at the time of creation

- **Service-role redemption was blocked by the pre-existing accept RPC's auth.users SELECT (42501).** service_role had no SELECT privilege on that table. Acceptance was deliberately not modified or granted additional privileges, per scope. The subsequent acceptance migration documented below repaired this failure.
- Actor IDs in these SQL tests are the known isolated auth-user UUIDs. No new bearer-token/Edge HTTP flow was exercised or added; trusted callers must continue supplying server-verified actors.
- Duplicate rejection is serialized by a business-row lock, but no simultaneous two-connection race test was run. Expired/revoked duplicate replacement and every email-format boundary were not separately exercised.
- This is database-only: no Edge action, invitation interface or email delivery was added.

## Acceptance repair migration

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
