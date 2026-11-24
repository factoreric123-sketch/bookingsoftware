# Authorization repair

- [x] Reproduce service-role actor mismatch using isolated test users and businesses.
- [x] Apply explicit-actor helpers and repair all affected RPC authorization checks through a new managed migration.
- [x] Exercise owner, cross-tenant, manager, staff, inactive, anonymous-token, forged-actor, and direct-call scenarios; document failed rescheduling separately.
- [x] Run security advisor, slow-query inspection and tests; document exact results and remaining failures.
- [ ] Performance advisor: blocked because the diagnostics command rejects this user-managed Supabase backend.

# Database booking enhancements

- [x] Implement and verify authenticated/token-authorized individual replacement slots.
- [x] Implement and verify isolated booking-page drafts and owner publishing controls.
- [x] Implement and verify location/date operating-hours exceptions.
- [x] Implement and verify public service intake snapshots and appointment-linked submissions.

Special hours and service intake were applied through the Supabase connector as
`20261124062039_location_date_special_hours` and
`20261124062640_appointment_linked_service_intake`. The SQL sources and rollback
checks are in `scripts/`. Special hours intersect existing staff availability
and preserve appointments and holds already created. Intake forms support fields
without file uploads. Required intake applies to online checkout.
