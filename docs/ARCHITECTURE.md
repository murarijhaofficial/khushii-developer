# Current architecture

The pnpm workspace contains an Express/TypeScript API in `apps/api` and a React/Vite client in `apps/web`. Prisma and versioned migrations are in `apps/api/prisma`; PostgreSQL persists CRM records and authentication sessions. The web app calls `/api/v1` and keeps CSRF tokens in memory. Sessions use an HttpOnly cookie; the API checks the current user role on each request.

This is a starter, not the full platform described in the master brief. There is a reminder worker, but no Redis integration or verified live advertising/WhatsApp integration. A Nestoria WordPress connector supports signed push delivery and signed, read-only export for administrator-initiated CRM imports; its actual website installation/version and credentials must be verified. Provider activation requires separately implemented and verified authentication, signatures, idempotency, consent handling and credentials.

The lead workspace stores activities, reminders, consent evidence and outbound message attempts in PostgreSQL. Provider adapters use server-only Resend/Meta credentials. A separate reminder worker sends opted-in internal reminder emails; in-app/browser alerts are driven by authenticated polling. Signed WhatsApp receipts are durably deduplicated and reconciled. Provider accounts and live sends remain unverified until credentials and webhook subscriptions are configured. See LEAD_WORKSPACE.md for scope and operational limits.

## Database configuration

The local API, Prisma migrations and reminder worker read `DATABASE_URL` from the server environment; when started from `apps/api`, dotenv loads it from `apps/api/.env`. Lead and enquiry records, campaign and local template drafts, activities, reminders, user accounts and sessions are stored in this database. The browser stores only the desktop-notification preference locally, not CRM records. Approved templates are retrieved from Meta when configured; local drafts are not submitted to Meta.

For hosted operation, configure the API and reminder worker with the same intended `DATABASE_URL` in their server-side environment. A local `.env` file is not transferred to Render automatically; `render.yaml` declares separate environment variables that must be set for each service. Apply reviewed Prisma migrations to the intended database before deploying code that requires them. Keep the database URL out of Vite variables and source control. Integration tests must use an isolated test database and must not seed or reset the CRM database.

## Team account access

Admins can edit team names, emails, roles and access, and set a new password. Only super admins may manage super admin accounts or grant that role; an administrator can edit their own details and access, and the last active super admin cannot be disabled or demoted. Disabling access or resetting a password revokes that user's sessions. All users can change their own password from their sidebar profile using their current password; other sessions are revoked. Passwords must be 12–128 characters. Share administrator-set passwords securely.

The `20261120010000_user_enabled` migration must be applied to the intended database before deploying this API. Coordinate the API and frontend deployment, and verify account management with authorized test accounts. No email invitation or password recovery flow is implemented.
