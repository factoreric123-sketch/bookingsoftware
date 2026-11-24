# Individual replacement slots — database phase 1

Applied to external Supabase on 2026-11-24 from checkout `90e96a1`, a descendant of `1c7b50d`.

Migration: `20261124053052_4a20fd42-4591-41bb-a385-729448d2db42.sql`.

## Exact new SQL contracts

```sql
public.get_appointment_replacement_slots(
  p_appointment_id uuid,
  p_date date,
  p_management_token text,
  p_actor_user_id uuid,
  p_expected_row_version bigint
) RETURNS jsonb
-- STABLE, SECURITY INVOKER, search_path = '', service_role EXECUTE only

private.replacement_slot_is_available(
  p_business_id uuid, p_staff_id uuid, p_location_id uuid,
  p_start timestamptz, p_end timestamptz, p_excluded_session_id uuid
) RETURNS boolean
-- STABLE, SECURITY DEFINER, search_path = '', service_role EXECUTE only
```

All five public parameters are required SQL arguments; pass NULL for unused token/actor.
The authenticated Edge boundary must supply the verified actor, not accept a browser actor ID.
For a capability request, pass a management token and a NULL actor. The database checks the
appointment/business-specific SHA-256 digest, expiration, and revocation. No raw tokens are stored or returned.

Response shape (type schema; angle-bracket values are not literal response values):

```json
{
  "appointment_id": "<uuid>",
  "row_version": "<JSON integer>",
  "date": "<YYYY-MM-DD>",
  "timezone": "<location IANA timezone>",
  "min_date": "<YYYY-MM-DD>",
  "max_date": "<YYYY-MM-DD>",
  "slots": [
    {
      "starts_at": "<ISO timestamptz>",
      "ends_at": "<ISO timestamptz>",
      "timezone": "<location IANA timezone>"
    }
  ],
  "group_rescheduling_supported": false
}
```

`row_version` is a JSON number, not a string. `slots` is an empty array when an otherwise
authorized date has no eligibility or lies outside the inclusive bounds. Entries are distinct
and sorted by start time. No customer identity, private answers, or token is projected.

Errors: `P0403` unauthorized; `P0404` missing appointment/settings; `P0409` stale/null version,
non-pending/non-confirmed appointment, group session, inactive location, or original appointment
inside its reschedule-notice window; `P0422` NULL date; `42501` direct anon/authenticated execution.

## Rules and preserved contracts

- Actor access uses the **same** `private.actor_has_business_access` rule as the current
  reschedule RPC; this intentionally preserves active-member/org-admin access rather than
  inventing a new owner/CRM restriction for only the read path.
- Only the saved individual session's staff and location are considered. Staff must remain
  active/bookable and assigned to that location and service.
- Duration is exactly `session.ends_at - session.starts_at`; before/after buffers come from
  the saved session, never the service's current duration or buffers.
- Weekly business/staff hours intersect; candidates use the configured slot interval, with
  the entire saved duration inside the intersection. As in existing availability, buffers
  affect collision checks rather than requiring buffers themselves inside opening hours.
- Minimum notice governs replacement start; maximum advance uses location-local dates.
  Reschedule notice is checked against the original session's start.
- Daily caps count active appointments plus unexpired active holds at the same location and
  local date, excluding the appointment being moved, not other reservations/attendees.
- The private collision helper copies existing block/time-off/external-calendar rules and
  excludes only reservations belonging to the saved individual session; it performs no updates.
- All existing public functions, their signatures, grants, RLS, audit/events, and final
  reschedule collision/rollback behavior are unchanged. A slot read is not a reservation.
- The legacy reschedule RPC does **not** currently enforce all of these hours/advance/eligibility
  rules for a direct arbitrary target. Codex should submit a displayed slot and expected version;
  this migration does not claim to repair that legacy gap. Shared authoritative exception rules
  across reads/holds/reschedules are still phase 3 work.
- Group attendee moves remain `P0409`; cancel/new booking remains the existing limitation.
- Dashboard appointments can use this read without a published booking page. No booking-page
  publishing or dashboard creation behavior has changed in this phase.

## Connected verification

One rollback-only transaction used randomly generated users, organization, business, location,
staff, service, customer, sessions, appointment and token; successful calls and denials ran under
actual `service_role`, with direct execution tests under `anon` and `authenticated`.
The first test attempt rolled back after a fixture validation error: a checked-in appointment
needed `checked_in_at`. The corrected full transaction passed all **14 result groups**:

| # | Exact result |
|---|---|
| 1 | Confirmed owner read: 10 slots, own reservation excluded with daily cap = 1. |
| 2 | Saved 90-minute duration retained despite current service = 30 minutes; hours intersect to 09:00–15:00. |
| 3 | America/New_York timezone returned; minimum local date = today, maximum = today + 30 days. |
| 4 | Valid management token with NULL actor returns identical projection. |
| 5 | ID alone, unrelated actor, wrong token each rejected `P0403`. |
| 6 | Old version and NULL expected version each rejected `P0409`. |
| 7 | Past and beyond-advance dates return empty slots. |
| 8 | Appointment, session and reservation JSON snapshots unchanged after reads. |
| 9 | Expired and revoked tokens each rejected `P0403`. |
| 10 | Other 12:00–13:00 reservation remains blocking; saved 15-minute before/20-minute after buffers exclude 10:30 and 13:00; 13:30 allowed. |
| 11 | Inactive staff and disabled staff/service assignment return empty slots. |
| 12 | Original notice window, group session, checked-in status rejected `P0409`; pending appointment succeeds. |
| 13 | Conflict introduced after reading 13:30 causes final reschedule `P0409` with original time/reservation/version preserved; releasing block permits move and increments version; old-version read then rejected. |
| 14 | Actual anon/authenticated execution each rejected `42501`; existing reschedule definition hash unchanged. |

Retained opt-in repeatable core regression: `scripts/verify-replacement-slots.sql` (separate from
migration SQL, always ends with ROLLBACK). No fixtures are seeded by migration.

Live catalog: public RPC STABLE/SECURITY INVOKER; private collision helper STABLE/SECURITY DEFINER;
both fixed empty search_path; anon/authenticated EXECUTE false, service_role true.
Security advisor: 11 unchanged findings (10 private RLS-without-policy, 1 disabled leaked-password
protection); 122 existing unindexed-FK performance findings. No new tables/FKs/policies.

## Replay and limits

The new migration depends only on preceding schema/functions and contains no fixture UUIDs,
test blocks, or data writes. The helper source transformation has fail-closed guards. An actual
fresh-database replay was **not** performed; prior migration history includes fixture-dependent
blocks outside this request's scope. No browser/Edge flow, parallel race, DST-transition,
overnight-hours, or full second-tenant owner test was executed. All test fixtures rolled back.

## Remaining ordered batch

Only item 1 is implemented in this turn. Items 2–4 are not implemented or verified:

2. Owner draft preview/edit/publish/unpublish with isolated live snapshot, stable slug,
   staff-selection and service visibility enforcement in page/availability/holds; define
   dashboard-created booking behavior independently of public visibility.
3. Tenant-scoped location/date closures or special hours, staff eligibility, before/after
   appointment preview, preserved reservations, timezone/midnight handling and shared
   authoritative rules including existing reschedule path.
4. Owner service intake configuration, published form-version snapshots, required-before
   confirmation validation and optional-after authorized submissions, appointment links,
   private answers and compatibility for services without intake.

No partial schema for those phases was applied. Frontend/Edge wiring remains with Codex.