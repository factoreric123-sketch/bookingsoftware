# Booking page drafts and publication — database phase 2

Implemented on external Supabase on 2026-11-24, starting from a descendant of `01c7e01`.
The concurrent GitHub commit `31b8d3a` was brought into the checkout without rewriting history;
its Edge changes were not edited by this batch.

## Applied migrations

1. `20261124054039_f80a1706-4452-438a-8520-68ae3aecefd2.sql` — private draft/live selections,
   owner RPCs, public visibility, shared booking cores and actor-checked dashboard paths.
2. `20261124054312_fe6982e1-349e-4f65-9cf9-cdfc1b8e3cc3.sql` — focused correction after the
   initial rollback test found the existing audit table requires `request_id`; supplies generated
   audit request UUIDs and indexes the six new FK relationships flagged by the advisor.

This is one feature batch but **two forward migrations**, not one file. Historical migrations
were not edited. Neither migration contains fixtures, production IDs, fixture-dependent test
blocks, or production-data backfills. Existing pages, slugs, published titles and flags remain
unchanged until an owner explicitly uses the new publication operation.

## Public SQL contracts

```sql
public.get_booking_page_draft(
  p_business_id uuid, p_actor_user_id uuid
) RETURNS jsonb;

public.save_booking_page_draft(
  p_business_id uuid, p_actor_user_id uuid,
  p_expected_row_version bigint,
  p_title text, p_description text,
  p_staff_selection_enabled boolean, p_service_ids uuid[]
) RETURNS jsonb;

public.set_booking_page_publication(
  p_business_id uuid, p_actor_user_id uuid,
  p_expected_row_version bigint, p_published boolean
) RETURNS jsonb;
```

All are SECURITY INVOKER with fixed empty search_path and service_role-only EXECUTE.
`get_booking_page_draft` is STABLE and read-only. Each requires an active **business owner**
through `private.actor_business_role`; org-admin status alone, managers, staff, inactive
owners and an absent/foreign actor do not authorize these operations. The Edge boundary
must derive the actor from the verified session, never copy a browser-supplied actor.

All three return the same shape; this illustrative JSON uses placeholder UUID strings:

```json
{
  "booking_page_id": "<page UUID>",
  "location_id": "<location UUID>",
  "slug": "existing-live-slug",
  "title": "Draft title",
  "description": "Draft description",
  "staff_selection_enabled": false,
  "service_ids": ["<selected service UUID>"],
  "live_service_ids": ["<live service UUID>", "<another live service UUID>"],
  "row_version": 2,
  "published": true
}
```

`service_ids` is the saved draft list (or live eligible list before any draft exists).
`live_service_ids` is the last explicit published selection, even when currently unpublished;
for legacy pages without a selection snapshot it is all currently active location-assigned
services. Arrays are UUID strings, sorted, distinct, and may be empty. `published` describes
live page status, not whether draft edits match live. `row_version` is a JSON integer from
**booking_pages**, not the private draft row. No draft/public capability token is returned.

- Preview returns configuration, not a rendered preview page, availability, or private answers.
- Save locks the existing page, checks its current version and advances it through the existing
  trigger. It does not change the live title/description/toggle/status/service selection.
- Publish locks/checks the page, revalidates the draft, copies title/description/toggle and the
  service list atomically, retains the slug, and advances version. Publishing an already
  published page republishes the current draft. Without a draft it snapshots current live values.
- Unpublish sets status to draft and clears published_at, but retains the draft and last live
  selection. Republish uses the saved draft, not an accidental new copy of older live settings.
- Empty selections intentionally publish **zero** public services, not “all services.”
- Title must be nonblank and at most 200 characters; description is required but may be empty,
  at most 10,000 characters. Boolean/list NULLs and NULL list members are invalid. Duplicate IDs
  normalize to one. Selected services must be active, unarchived, and actively assigned to the
  page location, both when saving and publishing.
- Each successful save/publication/unpublication writes an audit row with actor, entity,
  action, generated request_id, and relevant changes. There is no new request-key argument.

Errors: `P0403` actor not authorized; `P0409` stale/NULL version, other than exactly one page
for the business, changed draft/live location, or inactive business/location when publishing;
`P0422` invalid fields/service selection; `42501` direct anon/authenticated execution.
This business-scoped contract intentionally rejects zero/multiple pages rather than silently
choosing or creating a page. Existing businesses currently have at most one page.

## Public booking and dashboard separation

Existing signatures and response shapes remain unchanged:

```sql
public.get_public_booking_page(text) RETURNS jsonb;
public.get_availability(uuid,uuid,date,date,uuid,jsonb,integer) RETURNS jsonb;
public.create_booking_hold(text,uuid,uuid,uuid,uuid,timestamptz,jsonb,integer,uuid) RETURNS jsonb;
```

Their grants, SECURITY INVOKER setting and fixed public/extensions search_path were checked
unchanged inside the migration. The projection filters the live selection; public availability
rejects hidden services with `P0404`; public new hold creation rejects them with `P0409`.
All public paths still require a published page. Legacy pages retain all eligible services.
Services must be assigned to the location even on dashboard paths.

Published `staff_selection_enabled=false` removes the picker through the existing projection
and ignores a staff preference in public availability. The availability response still includes
actual assigned staff IDs; the existing hold client can pass that slot staff ID and session ID.
This toggle is **not** a privacy rule or a ban on submitting an eligible slot's staff ID. With
the toggle true, availability honors the existing staff filter. Dashboard staff preference is
independent of the public toggle. No staff identities are hidden by this feature.

The public hold retains its idempotent replay before visibility checks and all prior hold expiry,
daily cap/settings lock, exact-slot checks, pricing, buffers, capacity, reservation conflicts and
created_from_hold logic. It takes a shared page lock for a new hold, serializing that admission
against owner publication. Already issued holds are not revoked; existing confirmation behavior
is unchanged. No existing appointment or reservation is cancelled or rewritten by page edits.

The original dashboard Edge handler calls the **same actorless public hold RPC** and requires
a published page. It cannot be distinguished securely from public booking in SQL. Two new
server-only contracts provide the authorized bypass without weakening the public RPC:

```sql
public.get_dashboard_booking_availability(
  p_booking_page_id uuid, p_service_id uuid,
  p_from_date date, p_through_date date, p_staff_id uuid,
  p_addon_quantities jsonb, p_seat_count integer, p_actor_user_id uuid
) RETURNS jsonb; -- same slot-array shape as get_availability

public.create_dashboard_booking_hold(
  p_subject_hash text, p_booking_page_id uuid, p_service_id uuid,
  p_staff_id uuid, p_session_id uuid, p_starts_at timestamptz,
  p_addon_quantities jsonb, p_seat_count integer,
  p_request_key uuid, p_actor_user_id uuid
) RETURNS jsonb; -- same hold response as create_booking_hold
```

Both require `private.actor_business_permission(...,'can_manage_customers')` **and**
`private.actor_has_location_access` for the explicit actor. Thus owners, CRM-enabled managers
within location scope, and org admins recognized by the existing helpers can book; ordinary
staff, inactive/absent actors and foreign business actors cannot. Only public visibility and
published-page requirements are bypassed; location/service/staff eligibility and all other
booking rules remain. After the hold, call unchanged `confirm_booking` with the verified actor
and authorized customer as usual.

**Codex wiring required:** route owner actions through the three new RPCs; change dashboard
booking to the new dashboard hold RPC and remove its hard-coded published-page prerequisite;
use the dashboard availability RPC for hidden-service choices. The old Edge handler remains
unchanged and therefore still blocks hidden services/unpublished pages. Do not send a fake
actor, special subject prefix or browser bypass flag to the public RPC. New action names are
not yet in the Edge allowlist. No HTTP/browser integration is claimed in this database batch.

## Private storage and helper signatures

Four private RLS-enabled tables have explicit service_role grants/policies, no anon/authenticated
grants, update/version triggers, and composite tenant/location FKs:
`booking_page_drafts`, `booking_page_draft_services`, `booking_page_publication_states`,
`booking_page_live_services`. Selection junctions reference actual tenant service-location
assignments. No new public schema tables or broadened RLS policies were introduced.

```sql
private.booking_page_owner_target(uuid,uuid) RETURNS public.booking_pages;
private.booking_page_service_is_public(uuid,uuid) RETURNS boolean;
private.validate_booking_page_services(uuid,uuid,uuid[]) RETURNS void;
private.booking_page_draft_response(uuid) RETURNS jsonb;
private.booking_availability_core(uuid,uuid,date,date,uuid,jsonb,integer,boolean) RETURNS jsonb;
private.booking_hold_core(text,uuid,uuid,uuid,uuid,timestamptz,jsonb,integer,uuid,boolean) RETURNS jsonb;
```

All helpers are service_role-only SECURITY INVOKER. The first four are STABLE with empty
search_path; booking cores retain the previous public/extensions search_path and original
logic with the documented visibility/location/staff changes. Only verified dashboard wrappers
choose non-public mode. No new auth.uid()-based service authorization or role bypass was added.

## Actual connected results

Retained opt-in test: `scripts/verify-booking-page-drafts.sql`. All fixtures use fresh UUIDs,
including five users, two businesses, two pages, service/location assignments and booking data.
The first attempt rolled back on missing audit request_id; after the focused correction,
**16/16 result groups passed** under actual database roles:

| # | Result |
|---|---|
| 1 | Legacy published projection retains two services; draft read creates no stored draft. |
| 2 | Owner save advances page version 1→2, deduplicates IDs; complete public projection unchanged. |
| 3 | Stale save and NULL publication version rejected `P0409`. |
| 4 | Manager, staff, inactive owner, other tenant owner, NULL actor rejected `P0403` for all owner RPCs. |
| 5 | Foreign/unassigned services and NULL toggle/list rejected `P0422`. |
| 6 | Publish advances 2→3 and applies saved title, description, toggle and one visible service; slug unchanged. |
| 7 | Disabled public staff preference ignored; hidden availability `P0404`, hidden hold `P0409`. |
| 8 | Visible public hold and guest confirmation succeed with unchanged clients' SQL arguments; denied hold leaves no hold row. |
| 9 | Second draft does not leak; unpublish denies projection, availability and new hold `P0404`. |
| 10 | Owner dashboard availability/hold for hidden service on unpublished page succeed; CRM manager availability succeeds. |
| 11 | Foreign owner, staff, NULL dashboard actor rejected `P0403`; dashboard unassigned service `P0404`. |
| 12 | Republish uses the retained draft; enabled public staff filter honored. |
| 13 | Explicit empty list projects no services and suppresses availability. |
| 14 | Assignment disabled after save causes publish `P0422`, page version unchanged. |
| 15 | Direct foreign-service junction rejected `23503`; exactly eight successful edit/publication audit rows. |
| 16 | All five new public RPCs have only service_role EXECUTE; actual anon/authenticated draft calls rejected `42501`. |

Post-rollback query: fixture users = 0, fixture businesses = 0; private draft/publication header
rows = 0. Live catalog verifies all 14 involved public/private functions deny anon/authenticated
and allow service_role, and none uses SECURITY DEFINER. Advisor: 11 unchanged security findings
(10 pre-existing private RLS-without-policy, 1 leaked-password protection disabled); 122 existing
unindexed-FK findings, with all six newly introduced FK findings resolved by the correction.

## Limits

- No full fresh-database replay, actual concurrent requests, browser/HTTP checks, group-specific
  scenario, or in-flight hold confirmation after unpublish was exercised. Existing group/cap/
  idempotency branches are retained, not claimed as freshly scenario-tested here.
- New migration replay depends only on preceding schema/functions, never fixture data; the
  historical fixture-dependent migrations remain outside this scope.
- Existing trusted service_role direct page writes/old Edge mutations are not intercepted;
  Codex must use the new contracts for isolated drafts. Authenticated table write permissions
  were not expanded. The caller still must arrange Edge rate limits/session verification.
- Changing a page location after a draft/selection exists requires review and is rejected by
  publication rather than silently moving selections. Multi-page editing is not supported by
  these business-only signatures.
- Operating-hours exceptions and service intake (phases 3–4) remain untouched.