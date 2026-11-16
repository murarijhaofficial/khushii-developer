# Implementation status
- [x] pnpm workspace and Vercel/Render deployment manifests and lockfile
- [x] React dashboard, login and lead management UI
- [x] Express API, Prisma schema, cookie session authentication, role checks and migrations
- [x] Authenticated website lead ingestion and demo seeding
- [x] Campaign drafts and API routes
- [ ] WordPress plugin installation and site form mapping
- [ ] WhatsApp Cloud API template sending, delivery webhooks, consent and queues
- [ ] Meta/Google/LinkedIn OAuth and lead sync
- [ ] Production-grade tests, MFA, refresh/session revocation and security review
- [ ] Redis worker and workflow automation engine

## Multi-user workflow
- Added admin team creation, sales lead assignment, role-based lead editing and current-role checks on authenticated requests.
- Added role policy tests and removed the 100-lead display limit.
- Still needed: user lifecycle and password reset, audit history, scalable pagination, production bootstrap and live provider integrations with verified webhooks.
- Installed dependencies, corrected the Prisma schema, generated the initial migration and verified the build and role-policy tests.
- Created a local PostgreSQL database, applied the initial migration, seeded sample data, and verified the admin login and lead retrieval.
- Applied the initial migration to the configured Neon database and prepared repeatable demo seeding with a separate remote password.

- Replaced bearer authentication with revocable PostgreSQL sessions, HttpOnly cookies, CSRF protection and login rate limiting; detailed remaining phases are in DEVELOPMENT_PROGRESS.md.

- Added administrator-managed embeddable website forms and HMAC-signed custom website ingestion; live website installation remains to be configured and verified.

- Inspected Nestoria Property Projects 2.2.0 and added a separate signed, retrying WordPress connector for new and existing enquiries, plus CRM enquiry detail display. Live site installation remains pending.

- Rebuilt the Nestoria connector ZIP with an explicit root directory and Unix file permissions after an activation report; archive and PHP checks pass, while live WordPress installation still needs verification.

- Connector 0.2.0: self-contained plugin, WordPress connection settings with encrypted secret, signed connection test, automatic full-history batch scan and CRM refresh. Local tests cover 123 enquiries; actual website installation and public API configuration remain required.
- Verified signed connection check against the running API (HTTP 200); prepared Render/Vercel installs with the committed lockfile. Public hosting remains to be configured by the user.

- Fixed Render build failure from missing generated Prisma enums: API build now explicitly generates its client before TypeScript compilation. Render installs build dependencies and builds only the API. Root pnpm build passed.

- Verified Vercel frontend output at apps/web/dist/index.html and added an explicit apps/web/vercel.json for web-root deployment. Dashboard root/output settings must match; frontend build passed.

- Login network diagnosis: removed silent localhost fallback in production, normalized API origin/path and improved invalid API response/network errors. URL tests and frontend build pass; live Render and Vercel URLs are needed to diagnose hosted reachability/CORS.

- Live diagnosis: Render health, admin login, session and logout return HTTP 200; the supplied Vercel origin is absent from Render CORS responses. Normalize configured origin trailing slashes and test exact allowlist matching. Live dashboard CORS_ORIGIN still needs updating to the supplied Vercel origin.

- Nestoria 0.3.0: immediate new-enquiry attempt with retry fallback, safe delivery diagnostics and manual pending-record send. Added authorized CRM receipt count/last-arrival endpoint and UI; live WordPress installation remains required.

- Confirmed zero real website arrivals (only 40 demo records). Added direct signed WordPress import with cursor pagination, deduplication and admin controls; optional CRM forms moved below the existing-website integration. Connector 0.4.0 must be installed for the new export route.

- Improved lead display: compact contact rows with full-width enquiry detail panels, structured fields parsed from legacy/multiline notes, project-name fallback, readable dates/budgets and safe source links. Existing records do not need reimporting.

- Added Khushii Enquiry Pro 2.3.0 support to shared connector 0.5.0: new-entry delivery, existing-record sync, separate external IDs, enquiry-interest display and full message preservation. Existing plugin remains intact; live verification pending installation/deployment.
