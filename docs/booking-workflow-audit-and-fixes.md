# Booking workflow audit and fixes

This pass covered owner approvals, intake, appointment changes, calendar visibility, dashboard booking, customer notes, forms, and team access.

| Finding | Change |
| --- | --- |
| Unpublishing an attached required form left bookable times that could never be reserved. | Supabase blocks the change and names the linked services. An owner can replace or detach the form first. |
| Customer cancellation notice blocked the owner from declining a pending request. | Staff decisions use a separate transaction with role and location checks, row version validation, status history, and capacity release. |
| Rescheduling offered the original start as a replacement. | The original start is excluded. Nearby alternatives can still overlap the appointment’s own existing reservation. |
| Optional intake was hidden behind a generic confirmation link. | Checkout identifies it and offers a direct link to open the form. |
| Special hours only exposed the default location. | Calendar lets the owner select an active location and displays its timezone. |
| Inactive or missing staff profiles hid existing appointments in Calendar. | Day and Week retain inactive staff with scheduled appointments and show an Unassigned row where needed. |
| Dashboard booking required guessing a time and could not add a second attendee to a group slot. | Staff choose from server availability, with seats shown for existing group sessions. The booking hold receives the chosen session ID and rechecks it. |
| The dashboard blocked cancellation of one confirmed group attendee. | Staff can cancel a scoped attendee using the existing cancellation function. The remaining group bookings keep their reservation. |
| Clearing a CRM note could restore the previous text after a reload. | An explicitly cleared note persists as the newest value. Prior entries remain in history. |

## Remaining improvements

| Priority | Finding and next change |
| --- | --- |
| High | Add a pending-invitations list and revoke/reissue controls. A lost one-time link currently blocks a replacement until expiry. |
| High | Fetch form responses by form with pagination and load answers for the same page. The shared snapshot caps submissions and answers independently. |
| Medium | Add recurring weekly location hours in Settings. Opening a closed weekday today requires more than editing one date's exception. |
| Medium | Add Hidden, Optional, and Required phone settings with confirmation validation. Checkout currently always displays an optional phone number. |
| Medium | Preserve the dashboard channel in the saved booking source. Shared confirmation still stores Booking page as the source for staff-created bookings. |
| Medium | Populate company and address mappings for newly created contacts from standalone form submissions. Those answers currently remain on the submission. |

The schema source and rollback check are in `scripts/supabase-booking-audit-fixes.sql` and `scripts/verify-booking-audit-fixes.sql`. The live database checks used an isolated test business and rolled back all fixture changes.
