# Workspace usability audit — 2026-11-23

## Confirmed issues and changes

| Area | Finding | Status |
| --- | --- | --- |
| Booking confirmation | `confirm_booking` persists the appointment and returns a management token, but no transactional email sender is invoked. | Open: requires an email provider, a verified sender domain, and a server-side secret. |
| Workspace navigation | The workspace snapshot effect depended on the entire Supabase user object, so refreshed auth sessions could trigger another full load. | Fixed: snapshot load now depends on user ID. |
| Team | The landing page's global `h2` letter spacing compressed small Team headings until letters overlapped. | Fixed: workspace headings use normal letter spacing. |
| Bookings | The table could overflow its panel, hiding the action column after Source. | Fixed: table panel has horizontal scrolling and a minimum table width. |
| Calendar | Only a fixed Week view existed; date headers were inert. | Fixed: Day, Week, Month controls, clickable dates, and an hourly Day agenda. |

## Workflow inventory

| Workflow | Current code path | Further verification |
| --- | --- | --- |
| Signup and onboarding | Supabase Auth and `provision_business` | Fresh end-to-end signup deferred because no test inbox was provided. |
| Services and staff | Dashboard mutations and server-backed availability | Multi-member browser run still needed. |
| Public booking | Hold and confirm RPCs | Confirmation email absent; booking itself succeeds in the reported screenshot. |
| Booking management | Token-based reschedule and cancellation | Connected database checks exist; repeat browser checks after deployment. |
| Customer management | Profiles, import/export, merge | Browser checks for CSV import and merge remain. |
| Forms | Builder, publication, submissions | Browser submit and permissions check remain. |
| Messaging | UI and database model | SMS provider not configured. |
| AI phone | Sandbox only | Live phone provider not configured. |
| Payments | Manual invoicing and recording | Stripe is not configured. |

The production browser requires an authenticated owner session for a complete visual and workflow audit. Source review, build, typecheck, and automated tests do not establish that every production interaction works. Do not mark this audit complete until the browser checks and confirmation email delivery are verified.
