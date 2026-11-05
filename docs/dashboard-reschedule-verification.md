# Dashboard rescheduling verification

The Bookings table now searches loaded customer and service names, filters by status and month, and opens a reschedule form for non-cancelled appointments with a known row version.

The new authenticated `reschedule_dashboard_booking` Edge action verifies active owner or CRM-enabled manager membership for the business, checks that the appointment belongs to that business, converts the requested local date and time using the business timezone, and calls the protected `reschedule_appointment` RPC with the server-verified actor, request key, and expected row version. The RPC retains its conflict rollback and policy checks. The dashboard reloads the authoritative snapshot after the operation and checks the resulting date/time before reporting success. If the outcome cannot be confirmed, it instructs the user to reload before retrying.

TypeScript and the production build passed. An unauthenticated call supplying a forged owner actor ID returned HTTP **401** from the deployed Edge function. The underlying RPC's successful move, conflict rollback, and actor isolation were tested in the connected database previously; see `docs/authorization-verification.md`. This new browser-to-Edge path has not yet been exercised with an authenticated account or a group appointment.
