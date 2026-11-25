# Usability audit — 2026-11-24

This pass focused on owner/staff workflows that do not depend on external APIs.

## Fixed in this release

- Workspace sections now have stable URLs (`?section=bookings`, `?section=calendar`, and so on). Refresh, browser Back/Forward, and copied links retain the selected section.
- The top bar now searches permitted workspace sections, customers, and services. `/` focuses the search from anywhere outside a form field.
- Booking operations now default to upcoming appointments and offer Today, next 7 days, next 30 days, this month, past, and all-date filters.
- Booking search now includes customer phone, staff, status, and source in addition to customer, email, and service.
- The booking list reports the visible result count so an empty or narrow result set is understandable.
- Day calendar hours are limited to the selected day's normal operating range while automatically expanding to include bookings and blocked time outside that range.
- Multi-hour blocked time renders once in day view instead of repeating in every covered hour.
- Empty day-calendar hours expose a keyboard-accessible quick action to prefill a one-hour staff block.
- The sidebar business avatar now uses the active business initials instead of a hard-coded letter.
- Booking rows now open an in-context appointment summary with status, customer contact links, staff, source, and available booking/customer notes.
- Week-calendar events now open the same appointment summary, and summaries can be copied as plain text for internal handoff.
- Added one-click booking views for Today, Upcoming, Awaiting approval, Past, and All, plus soonest/latest sorting.
- Added CSV export for exactly the bookings currently visible after filters and search.
- Added service catalog search, Bookable/Hidden filtering, result counts, and a recoverable filtered empty state.
- Grouped the long sidebar into Operate, Setup, Engage, and Business sections while preserving permission-based visibility.
- Added team search across names, email, roles, and assigned services, with role/status filters, counts, and a recoverable empty state.
- Added form search across names, descriptions, and questions, plus Published/Draft filtering, counts, and recoverable empty states.
- Service intake now summarizes every configured service-to-form assignment and provides direct edit actions.
- Submission empty states now distinguish a filtered search from a form that has not received responses.
- Added invoice quick views for Outstanding, Overdue, Paid, and All, plus invoice/customer search and due-date/amount sorting.
- Added filtered invoice CSV export, visible result counts, recoverable empty states, and client-side currency precision validation.
- Added selectable 7-, 30-, and 90-day analytics periods with explicit date ranges, refresh/retry controls, and period-aware CSV exports.
- Added honest analytics loading, failure, empty-service, and empty-booking-source states.
- Repaired the settings layout so every panel stays in the content column, with usable section navigation on desktop and mobile.
- Added unsaved-change protection, validation, plain-language booking-policy summaries, and discard controls to business settings.
- Made appointments in both week and day calendar views open the same accessible detail workflow.
- Added booking time, booked value, and attached intake answers to appointment details.
- Added service selection counts, select-all/clear controls, unsaved-state feedback, discard, and useful empty states to the booking-page editor.
- Corrected customer CSV export so “loaded” means the currently visible filtered records, with an explicit filename.
- Removed the unnecessary email requirement for manual customer creation while retaining optional-email validation and adding editable creation tags.
- Added recoverable customer search empty states plus profile validation, dirty-state protection, and discard controls.
- Prevented incomplete legacy activity timestamps from crashing customer profiles; affected entries now show a safe fallback.
- Added form-builder safeguards for blank or repeated question labels, repeated CRM mappings, and invalid choice lists before a form version can be published.
- Added form draft dirty-state protection and a one-click discard path while editing an existing form.
- Prevented duplicate form-status requests, reset stale submission searches when switching forms, and made malformed legacy submission dates safe in lists, details, sorting, and CSV export.

## Verified

- TypeScript typecheck passed.
- 17 standard tests passed; 8 connected tests remained opt-in and skipped.
- Production client, server, and Cloudflare builds passed.
- Browser checks passed at 1280×800 and 390×844 with no page-level horizontal overflow.
- Browser checks covered deep-link reload, Back navigation, upcoming/past filters, workspace search, day-calendar navigation, block de-duplication, and keyboard focus on the quick-block action.

## Next non-API improvements

1. Add recurring location-hours editing with affected-appointment warnings. One-off special hours already exist, but normal weekly hours still originate from onboarding.
2. Add pending team-invitation management: list, expiry, copy link, revoke, and reissue. Email delivery can remain deferred.
3. Add form-specific paginated submissions and answer export so one busy form cannot crowd older submissions out of the workspace snapshot.
4. Add customer phone collection modes (hidden, optional, required) to the booking-page draft and enforce the published setting in the booking transaction.
5. Extend appointment summaries to day-calendar events, status history, and intake answers.
6. Add saved operational views for common filters such as “Today”, “Awaiting approval”, and “My appointments”.
7. Split the large dashboard route into lazy-loaded section modules; the current production build warns that the main app chunk exceeds 500 kB.
8. Add direct item targeting from global search, not only section navigation, after customer and service detail routes exist.

External email, payments, calendar sync, SMS, and AI calling remain intentionally outside this pass.
