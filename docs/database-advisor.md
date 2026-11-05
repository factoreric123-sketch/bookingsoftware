# Connected database advisor snapshot

The Supabase advisor ran successfully against project `tkjyfyjsbswbhbixvbjj` after the invitation migrations. This is a read-only snapshot; no schema or Auth settings were changed.

| Advisor | Finding | Count | Level |
|---|---|---:|---|
| Security | RLS enabled without policies on intentionally private server-only tables | 10 | INFO |
| Security | Leaked-password protection disabled | 1 | WARN |
| Performance | Foreign keys without covering indexes | 122 | INFO |
| Performance | Auth functions evaluated per row in RLS policies | 6 | WARN |
| Performance | Unused indexes | 21 | INFO |
| Health | Findings | 0 | — |

The six RLS warnings are on `profiles_select`, `organization_members_select`, `business_members_select`, `customer_users_select`, `notifications_select`, and `notifications_update_read`. The advisor recommends wrapping each row-independent `auth.<function>()` call in `(select auth.<function>())` so PostgreSQL can evaluate it once per statement. Review each policy definition and its access tests before changing it.

The 122 missing-index findings need workload-based prioritization. Add covering indexes for high-traffic booking, membership, and customer relationships first; do not blindly add all 122. The 21 unused-index findings should not trigger removal without usage history.

Schema and policy changes belong in a new Lovable-managed migration under this repository's `AGENTS.md`. This report does not claim the warnings are resolved. Leaked-password protection is a Supabase Auth setting and requires a separate project configuration change.
