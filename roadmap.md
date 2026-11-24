# Authorization repair

- [x] Reproduce service-role actor mismatch using isolated test users and businesses.
- [x] Apply explicit-actor helpers and repair all affected RPC authorization checks through a new managed migration.
- [x] Exercise owner, cross-tenant, manager, staff, inactive, anonymous-token, forged-actor, and direct-call scenarios; document failed rescheduling separately.
- [x] Run security advisor, slow-query inspection and tests; document exact results and remaining failures.
- [ ] Performance advisor: blocked because the diagnostics command rejects this user-managed Supabase backend.

# Database booking enhancements

- [x] Implement and verify authenticated/token-authorized individual replacement slots.
- [x] Implement and verify isolated booking-page drafts and owner publishing controls (database contracts verified; Codex Edge/frontend wiring remains).
- [ ] Implement and verify location/date operating-hours exceptions (current scoped batch: owner/versioned contracts, all booking paths, rollback-only timezone checks).
- [ ] Implement and verify service intake snapshots and appointment-linked submissions.