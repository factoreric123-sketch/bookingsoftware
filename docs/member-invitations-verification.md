# Team invitation creation verification

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

## Limits

- **Service-role redemption is blocked by the pre-existing accept RPC's auth.users SELECT (42501).** service_role currently has no SELECT privilege on that table. Acceptance was deliberately not modified or granted additional privileges, per scope. Production invitation redemption is therefore not verified successful and needs a separately scoped repair.
- Actor IDs in these SQL tests are the known isolated auth-user UUIDs. No new bearer-token/Edge HTTP flow was exercised or added; trusted callers must continue supplying server-verified actors.
- Duplicate rejection is serialized by a business-row lock, but no simultaneous two-connection race test was run. Expired/revoked duplicate replacement and every email-format boundary were not separately exercised.
- This is database-only: no Edge action, invitation interface or email delivery was added.