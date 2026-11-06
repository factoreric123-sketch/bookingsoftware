# Frontend ↔ database mapping

How the existing preview-workspace model (src/lib/app-store.tsx) maps to the production schema. The frontend keeps working on the preview adapter until each surface is switched to the backend contracts in `docs/backend-contracts.md`.

| Preview model | Production mapping |
|---|---|
| Business.name | businesses.name |
| Business.slug | businesses.slug; the public booking route resolves booking_pages.slug |
| Business.address | default location address components (locations via businesses.default_location_id) |
| Business.hours | business_hours for the default location |
| Business.setupComplete | businesses.setup_completed_at IS NOT NULL |
| Service.duration | services.duration_minutes |
| Service.price | services.price_minor ÷ currency minor-unit factor |
| Staff.serviceIds | staff_services |
| Staff.weeklyHours | staff_profiles.weekly_capacity_minutes ÷ 60 |
| Staff.role | business_members.role when the staff profile has a linked user_id |
| Customer.name | customers.full_name |
| Customer.notes | customer_notes |
| Customer.tags | customer_tags + customer_tag_assignments |
| Appointment.date/time | booking_sessions.starts_at formatted in booking_sessions.timezone |
| Appointment.duration | session end − start, excluding reservation buffers |
| Appointment.staffId | booking_sessions.staff_id |
| Appointment.manageToken | server-issued capability token; never a selectable appointment column |
| "no-show" UI value | no_show |
| "booking-page" source | booking_page |
| BlockedTime.date/start/end | blocked_times absolute timestamps converted via the location timezone |
| Form.fields | form_versions + form_fields (active published version) |
| Form.submissions | count of accepted form_submissions |
| FormSubmission.answers | form_submission_answers joined to immutable form_fields |
| Workflow.runs | automation_runs count |
| Workflow.lastRun | latest automation_runs timestamp |
| Invoice.amount | invoices.total_minor converted for display |
| Invoice "sent" | status = open with issued_at set |
| Invoice "overdue" | derived: open invoice past due_date with unpaid balance |
| AiReceptionist | ai_assistant_settings |
| CallLog | calls with is_sandbox = true for simulations |
| Integration "not-configured" | integrations.status = not_configured |
| Integration "pending-approval" | integrations.status = pending_approval |

## Adapter changes required when connecting the frontend

1. Replace localStorage reads/writes with TanStack server functions that call the RPC contracts; the browser never writes base tables directly.
2. Booking flow becomes three calls: get_availability → create_booking_hold → confirm_booking; the UI must handle `P0409` (slot gone) by refreshing slots.
3. Manage/reschedule/cancel links carry the raw capability token from the confirmation response/notification — not the appointment id.
4. Money display divides `*_minor` by the currency factor; never send prices from the browser.
5. Staff-facing customer contact details come from narrow server responses, not direct `customers` queries (staff have no direct SELECT on customers).
6. Invoice "overdue" is derived in the UI from open status + due_date, not stored.
7. Sandbox calls/bookings stay flagged `is_sandbox` and are excluded from analytics.
