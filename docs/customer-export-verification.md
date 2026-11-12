# Paginated contact export

The Customers page now has two exports. “Export loaded CSV” retains the dashboard snapshot's latest 500 contacts and enriched loaded appointment, payment, note, and tag values. “Export all contacts” pages through every unarchived, unmerged customer for the selected business and includes customer ID, contact fields, address fields, source, status, and creation time. It intentionally does not label bounded financial or note data as complete.

The `export_customer_contacts_page` Edge action requires a verified user with an active owner membership, or an all-location manager membership with `can_manage_customers`. It ignores caller-supplied actor IDs, validates the business and cursor UUIDs, fixes a creation-time cutoff on the first page, and advances by customer UUID in 200-row pages. A page failure stops the export before a file is downloaded. CSV cells use the existing formula-escaping helper.

Local TypeScript and the production build passed. The deployed `backend-api` version 92 returned HTTP 401, `Authentication required`, for an unauthenticated request carrying a forged actor ID. An isolated authenticated browser export with more than 500 contacts and a cross-business denial test remain to be run. This is a contact export, not the full privacy-request export and deletion workflow.
