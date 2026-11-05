# Customer merge verification

The dashboard now offers a merge action in a customer profile. The user selects the destination and checks an explicit confirmation before the service-role-only `merge_customers` RPC is called. The Edge gateway derives the actor from the verified bearer token. After success, the dashboard reloads its workspace snapshot and hides customers whose status is `merged`.

Connected database check: a rollback-only SQL block inserted two customers into the existing isolated authorization-test business, switched to `service_role`, called `merge_customers` as that business's owner, and asserted that the result identified the destination and marked the source as merged. The block raised a caught sentinel error so the inserts, merge, audit record, and any other effects rolled back. A separate query found **zero** test customers remaining.

TypeScript and the production build passed. The UI has not been exercised with an authenticated browser session. The connected check covered a basic two-customer merge; it did not test every related table, duplicate relationship, or concurrent merge. Those cases remain part of the broader database acceptance suite.
