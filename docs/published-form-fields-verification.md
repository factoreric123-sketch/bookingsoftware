# Published form field immutability verification

Date: 2026-11-07. Connected Supabase project: `tkjyfyjsbswbhbixvbjj`. Lovable Cloud was not enabled.

## Applied migration

`20261107220124_ef6831d1-670b-40f7-9112-fd13e29a16fb.sql`

The new Lovable-managed migration replaces only `private.protect_published_form_fields()` and the existing `form_fields_protect_published` trigger. Historical migrations were not edited. The trigger now fires BEFORE INSERT OR UPDATE OR DELETE.

- INSERT reads and returns NEW only; DELETE reads and returns OLD only.
- UPDATE checks both OLD and NEW business/version pairs, preventing movement out of or into a published version.
- The lookup still matches both `business_id` and `form_version_id`.
- Published-field violations retain SQLSTATE `P0001` and the exact message `fields of a published form version are immutable`.
- The function signature, fixed empty search path, ownership/ACL, table grants, RLS policies, foreign keys, field-shape validation and published-version UPDATE protection are unchanged. No public RPC or Edge function was modified.

## Baseline reproduction

Before replacing the trigger, the migration created an isolated test form and already-published version inside a rollback-only subtransaction. A field INSERT succeeded and its row count was asserted to be exactly one: **the original gap was reproduced**. Raising and catching a dedicated rollback exception removed all baseline fixtures before the repair.

## Exact connected transaction results

All assertions executed inside the applied migration against the connected database, not against a mock or a build. Unexpected success, an incorrect error message, or an incorrect row count raises an exception and fails the migration.

**14/14 assertions passed:**

| # | Scenario | Exact result |
|---|---|---|
| 1 | INSERT a new field into a published version | Rejected: `P0001`, `fields of a published form version are immutable` |
| 2 | UPDATE the label of an existing published field | Rejected with the same code and message |
| 3 | DELETE an existing published field | Rejected with the same code and message |
| 4 | INSERT a draft-version field | Succeeded; inserted field read back with label `Editable` |
| 5 | UPDATE a draft-version field | Succeeded; label read back as `Edited` |
| 6 | Move a published field to a draft version | Rejected with the same published-field code and message |
| 7 | Move a draft field into a published version | Rejected with the same published-field code and message |
| 8 | DELETE a draft-version field | Succeeded; exactly one row deleted, field absent afterward |
| 9 | Populate a new draft before publishing | Succeeded; all three fields (`name`, `email`, `notes`) present while `published_at` remained NULL |
| 10 | Publish that fully populated draft | Succeeded; `published_at` became non-null and all three fields remained |
| 11 | Add a field after that draft was published | Rejected with the same published-field code and message |
| 12 | UPDATE the original published form version | Rejected: `P0001`, `published form versions are immutable` |
| 13 | INSERT using business B and business A's draft version | Rejected with `foreign_key_violation` (`23503`); composite business/version matching remains enforced |
| 14 | Inspect original published fields after rejected mutations | Exactly one original field remained, label `Original`, still in its original published version |

The regression fixtures were rolled back using a caught exception in a nested PL/pgSQL subtransaction. An additional assertion verified the test form and all three test versions were absent. A separate post-migration read confirmed **zero** forms matching either test slug prefix remained. Existing fixture tenants were only referenced; no production form rows were edited.

## Edge `save_form` compatibility

Source review of `supabase/functions/backend-api/index.ts` verified both field-saving branches:

- Existing form with supplied fields: line 468 creates the new version with `published_at: null`; lines 471–474 construct and await the field INSERT, returning on error; lines 476–478 publish only afterward; line 480 changes the active version.
- New form: line 499 creates the version with `published_at: null`; lines 502–505 construct and await the field INSERT, returning on error; lines 507–509 publish only afterward; line 511 changes the active version.
- Existing-form status-only path, lines 484–491, can publish an existing draft but performs no field INSERT. It is not a publish-before-field-save path.

The three-field draft-to-published transaction above confirms this ordering remains accepted by the database. **This was a source-order review plus connected database compatibility test, not a new authenticated HTTP invocation of the deployed Edge function.** No Edge deployment or frontend modification was necessary or performed.

## Post-migration catalog and security checks

- Live catalog confirms `form_fields_protect_published` fires BEFORE INSERT OR DELETE OR UPDATE and executes the repaired function.
- `form_versions_protect_published` still fires BEFORE UPDATE with its original function.
- Both `form_fields` and `form_versions` still have RLS enabled; table ACLs are unchanged from the pre-migration read. This migration contains no GRANT, REVOKE or policy statements.
- Security advisor was run after application: **11 pre-existing findings, no new findings introduced**. Ten INFOs report intentional no-policy private tables; one WARN reports leaked-password protection disabled. These unrelated settings were not modified.
- Preview build log reported `build OK`, but the repair result is based on the transactional assertions and live catalog checks above, not on that build.

No requested database assertion failed. The deployed Edge HTTP flow was not re-exercised; compatibility evidence is explicitly limited to source ordering and the connected database transaction.