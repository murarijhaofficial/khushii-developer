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

- Added the per-lead workspace, activity/status/assignment history, call logging, reminders and personal follow-up center.
- Added Resend and approved text-template Cloud API adapters with idempotent message tracking, explicit WhatsApp consent and signed durable status receipts. Provider credential spaces were added to the API .env; no secrets exposed or real messages sent.
- Added optional email-reminder worker and Render worker definition. Local migrations/tests and fictional-data browser QA passed; Neon additive migrations applied. Provider setup and hosted redeployment remain outstanding.
- Final verification: workspace GET against configured Neon returned HTTP 200; provider readiness correctly reports email/WhatsApp unavailable while credentials are blank. Local API restored. No lint script is configured.

## Phone-based repeat enquiries (2026-11-17)
- Status: IMPLEMENTED - verification and deployment pending.
- Cause: website idempotency matched submission ID only; manual leads were always inserted.
- Changes: enquiry history migration and backfill; phone normalization and serialized matching across lead creation, forms and website sync; authorized workspace enquiry history; manual duplicate access control. Existing lead status/assignment are preserved. Existing duplicates are not merged.
- Verification: Prisma client generation and direct API/frontend TypeScript checks passed. Added normalization and integration coverage; test execution blocked by Node uv_os_get_passwd ENOMEM in this Windows environment. `pnpm build` was blocked because pnpm could not verify/download the pinned pnpm release from the registry; a direct Vite build ran out of memory. No lint script configured. Migration has not been applied; integration tests require an isolated migrated local database.
- Remaining: resolve host resource/user-profile issue, run tests and pnpm build, apply migration to target database and deploy; review historical duplicates and verify live ingestion.

## Campaign and template review (2026-11-17)
- Status: IN PROGRESS; campaign audience selection, campaign launch, and reports are not implemented.
- Added a Templates navigation page for approved Meta templates and selection into the existing campaign draft; marketing users can read approved templates. No schema change or provider send added.
- Verification: API and frontend TypeScript checks, direct Vite production build and five compiled API unit tests passed. The normal tsx runner failed because Node uv_os_get_passwd returned ENOMEM. pnpm build was blocked because pinned pnpm verification could not reach the registry. Template navigation and marketing authorization have not been integration-tested; no live Meta account tested. No lint script configured.
- Remaining: implement persisted individual/select-all audiences, authorization and opt-in enforcement, safe durable campaign delivery and reporting, tests, provider verification and production build.

## Website lead sync diagnosis (2026-11-17)
- Status: BLOCKED pending database migration and live verification.
- A signed, read-only WordPress export returned HTTP 200 with 10 enquiries and 0 rejected items. The configured database lacks LeadEnquiry; read-only migration audit found 20261117010000_lead_enquiries is the only pending migration and no failed migrations. The configured database has not been proven to be the one used by the deployed API.
- Current sync and website receipt status require LeadEnquiry. The migration creates the table and backfills enquiry records from existing leads. Render configuration does not apply migrations.
- No database or website data modified. Remaining: obtain approval to apply the migration to the configured remote database, verify the deployed API database matches, then run sync and confirm records; review campaign selection, sending and reports separately. No build needed for this diagnostic-only documentation update.

## Website lead migration and import (2026-11-17)
- Status: TESTED against configured remote database and signed WordPress export; deployed CRM UI/database connection still needs confirmation.
- Applied approved 20261117010000_lead_enquiries migration. Signed WordPress sync processed 10 records: 2 new leads, 4 new enquiries on existing leads, 4 existing submissions, 0 rejected. A repeat processed all 10 as existing, with no additional leads or enquiries.
- Remaining: verify the hosted CRM is using this database and that website enquiries appear in the UI; campaign audience, launch and reporting remain unfinished.

## WordPress sync reporting (2026-11-17)
- Status: IMPLEMENTED locally; hosted deployment and integration test pending.
- The sync API now reports newly created leads, enquiries attached to existing leads and replayed submissions separately; the UI labels those counts and falls back for older APIs. The existing response field is retained.
- Verification: pnpm build, workspace typecheck, 5 API unit tests and 5 frontend tests passed. The integration test was updated but requires an isolated local PostgreSQL database, unavailable here. No lint script is configured.
- The approved remote migration and live WordPress import were completed and retry-tested; hosted CRM database identity and UI still need verification. Campaign audience selection, sending and reporting remain unimplemented.

## CRM database configuration review (2026-11-17)
- Status: REVIEWED locally; hosted environment values remain unverified.
- Confirmed the API, Prisma schema and reminder worker use server-side DATABASE_URL. Prisma stores CRM records and campaign drafts; browser localStorage only keeps the desktop-notification preference. Meta templates are fetched from the provider when configured.
- Documented that Render API and worker each need the intended database configured separately; never expose its URL in Vite. No database or environment values changed.
- Remaining: confirm the hosted API and worker use the same intended database, deploy pending sync reporting changes, and implement campaign audience selection, sending and reports. The last production build and typecheck passed; no new build required for this documentation-only review.

## Campaign audience and reporting (2026-11-17)
- Status: IMPLEMENTED and tested with mocked Meta; hosted deployment and live provider verification pending.
- Added individual and select-all audience selection, approved-template selection and variables, start/pause actions, durable recipient claims and reports. Current opt-in is checked before dispatch; duplicate phone numbers within a campaign are rejected; unknown sends are never automatically retried. Legacy drafts remain stored and require recreation to start.
- Database: additive 20261117020000_campaign_recipients migration applied to the configured CRM database; no CRM campaign or customer records were changed. A pooled migration attempt left an idle advisory lock; disconnected the verified idle session and applied through a direct connection. Public migration records verified afterward.
- Verification: pnpm build, workspace typecheck, 12 API unit/HTTP tests, 5 frontend regression tests and Prisma schema validation passed. All migrations and a campaign opt-in/skip/report flow passed in a uniquely named temporary schema using fictional data and a mocked provider; schema removed afterward. Existing full session integration suite remains unrun because no isolated local PostgreSQL server is available. No lint script configured.
- Remaining: deploy API and frontend, confirm hosted services use the intended database, configure and verify the Meta account and signed webhooks, then explicitly enable CAMPAIGN_WORKER_ENABLED and conduct an authorized live test. No campaign messages sent; provider configuration and live results remain unverified.

## Offline campaign preparation (2026-11-17)
- Status: IMPLEMENTED and tested locally with mocked Meta; hosted deployment and live provider verification pending.
- Added database-backed CRM template drafts and campaign draft creation without provider credentials. Drafts are explicitly unapproved and are not submitted to Meta. Starting requires a matching approved Meta name, language and body; the saved name, body and language are rechecked during dispatch. Static provider headers and footers remain outside the CRM draft.
- Database: additive 20261117030000_campaign_template_drafts migration applied to the configured CRM database and its migration record verified. No campaign messages or actual provider requests were sent.
- Verification: pnpm build, workspace typecheck, 15 API tests and 5 frontend regression tests passed. In an isolated temporary schema, tested offline template/campaign creation, rejection while unconfigured and when Meta content mismatched, and mocked approved dispatch with opt-in and reports; schema removed. Full existing session integration suite remains unrun because no isolated local PostgreSQL server is available. No lint script configured.
- Remaining: deploy API/frontend and confirm hosted database configuration; configure Meta credentials, approve matching templates and subscribe verified webhooks; run an explicitly authorized live test before enabling campaign sending.

## Template draft management (2026-11-17)
- Added authorized editing and deletion of CRM template drafts without provider tokens. Existing campaign snapshots retain the name, language and body selected at creation, even if the original draft changes.
- Verification: 15 API tests including draft role checks, workspace typecheck and pnpm build passed. The isolated end-to-end check covered draft creation but preceded the edit/delete controls; those controls were checked with mocked database HTTP tests. No live Meta send performed.
- Remaining: deploy API/frontend and verify hosted database, then configure and verify Meta approval, credentials and webhooks before enabling campaign sending.

## Sign-in and team presentation (2026-11-20)
- Status: IMPLEMENTED locally; hosted deployment and browser verification pending.
- Redesigned the shared team sign-in screen, removed the prefilled example administrator email, added password visibility and accessible error feedback. Improved team account creation labels, progress and success feedback; existing server authorization remains in place.
- Removed the Nestoria label from lead-list presentation while preserving lead records and source identifiers. No schema, API or integration changes.
- Verification: direct API and web TypeScript checks and Vite production build passed. `pnpm build`, workspace typecheck and API test commands stalled at the pnpm launcher; cancelled after waiting. Direct test runners failed with Windows `uv_os_get_passwd` ENOMEM. No lint script configured. Hosted URL was inaccessible to the review tool, so login and team flows require browser verification after deployment.
- Remaining: resolve the pnpm/Windows environment issue, run the full build and relevant tests, deploy the frontend and verify sign-in and team creation with authorized accounts.

## Dashboard scrolling and sidebar (2026-11-20)
- Status: IMPLEMENTED locally; hosted deployment and browser verification pending.
- Recent leads now scroll in a bounded, keyboard-accessible region with a persistent header. The sidebar stays within the viewport instead of stretching with dashboard content. No API or data changes.
- Verification: frontend TypeScript check and direct Vite production build passed. `pnpm build` stalled at the launcher and was cancelled; no lint script configured. No new automated tests for this presentation-only change.
- Remaining: resolve pnpm launcher issue, run the full build, deploy and verify scrolling and sidebar behavior on desktop and mobile.
