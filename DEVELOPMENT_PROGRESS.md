# Development progress

Statuses: NOT STARTED, IN PROGRESS, BLOCKED, IMPLEMENTED ? UNVERIFIED, TESTED, COMPLETED.

## Phase 1 ? authentication foundation
- Module/task: Replace bearer tokens with revocable database-backed cookie sessions and CSRF checks.
- Status: TESTED.
- Files created: `docs/ARCHITECTURE.md`, `apps/api/tests/session.test.ts`, `apps/api/prisma/migrations/20261116010000_sessions/migration.sql`.
- Files modified: API schema, server and package scripts; web application; agent guide and project documentation.
- Database changes: Session table, hashed session token, expiration, user relation and indexes. Additive migration applied to local and Neon development databases.
- API endpoints: login and me use cookie sessions; logout revokes the current session.
- Tests: local integration test covers HttpOnly cookie, session restore, CSRF rejection and revocation; existing role policy tests.
- Checks: Prisma generation, integration and role tests, type checks and production build; no lint script configured.
- Errors: Windows Prisma engine was locked by the running API; stopped it temporarily for client generation.
- Remaining: session management UI, password reset, MFA, audit logging, invitation and deactivation, custom roles, full security regression coverage.
- Completion date: not completed.

## Remaining phases
- CRM foundation (contacts, pipeline and activities): IN PROGRESS.
- Website forms and signed custom-plugin ingestion: TESTED locally; live installation and delivery retries remain outstanding.
- WhatsApp and advertising providers: NOT STARTED; live activation requires provider access and credentials.
- Property, visits and bookings: NOT STARTED.
- Automation, queues and Redis worker: NOT STARTED.
- Reporting and production readiness: NOT STARTED.

## Phase 3 ? website lead capture
- Status: TESTED locally.
- Created: website form migration and custom WordPress PHP client helper.
- Modified: Prisma schema, API routes, Integrations and Leads UI, integration tests and documentation.
- Database: website forms and lead-to-form attribution.
- API: admin form management, public form rendering and submission, and HMAC-signed website lead ingestion.
- Verification: local API integration tests cover form creation, idempotent submission, disabling, signed ingestion and authentication; build and type checks pass. Migration applied to Neon and authenticated form and lead lists verified. PHP helper not linted because PHP is unavailable locally.
- Errors: the Neon pooled connection held an idle advisory lock; released it from the owning idle session and applied the migration through a direct connection.
- Blockers: existing custom WordPress hooks, live website deployment, public HTTPS API and on-site retry queue need configuration and live verification. Ad and WhatsApp integrations remain not connected.
- Completion date: not completed.

## Phase 3 ? Nestoria connector
- Status: TESTED with local PHP WordPress stubs and CRM API; live WordPress verification outstanding.
- Files created: `integrations/wordpress/nestoria-crm-connector/`, packaged connector, and PHP behavior tests.
- Files modified: CRM lead details display, API integration test, docs and progress tracker.
- Database/API changes: none; uses the existing signed website lead endpoint and lead message field.
- Tests: PHP syntax, phone normalization, metadata mapping, request signature, retries and stable IDs with WordPress stubs; local API integration tests and build.
- Remaining: install on staging/production, configure public HTTPS API and matching server-side secret, ensure WP-Cron, queue existing leads and verify real delivery; other form plugins and chatbot are not connected.
- Completion date: not completed.

## Nestoria connector installation package
- Status: TESTED locally; live activation unverified.
- Issue: a WordPress activation link reported that the plugin file did not exist. The prior archive lacked an explicit root directory entry; the screenshot does not establish the server-side cause.
- Changes: rebuilt version 0.1.1 with an explicit plugin directory, standard file modes and repeatable archive validation.
- Tests: archive contents and integrity, PHP syntax and connector behavior stubs; production build.
- Remaining: reinstall and verify activation on the WordPress host; check host extraction and filesystem permissions if the problem persists.

## Nestoria connection controls and full import
- Status: TESTED locally; live installation and delivery unverified.
- Changes: self-contained 0.2.0 plugin; encrypted credential settings; Save, Test and Import all actions; ID-based scan of every saved private enquiry with paced delivery and retries; CRM refresh every 30 seconds while visible.
- API: signed POST /api/v1/integrations/website-connection with database connectivity check. Database changes: none.
- Tests: PHP syntax and extracted ZIP behavior; settings controls and secret non-disclosure; authenticated connection test; import scan across 123 records, signatures, retries and idempotency; CRM build/type checks.
- Remaining: a public HTTPS API, installing the connector in WordPress, entering matching credentials and verifying real deliveries. No claim that website leads have been imported.

## Render Prisma build fix
- Status: TESTED locally; Render redeployment pending.
- Modified: apps/api/package.json, render.yaml, deployment documentation and progress tracker.
- Cause: installation could not locate the monorepo Prisma schema, and API compilation ran without generating Prisma Client. Missing Role/LeadStatus enums caused downstream validation and transaction type errors.
- Fix: explicit schema generation in the API build; install dev dependencies needed for compilation; build API only on Render. No schema or business data changes.
- Verification: pnpm build passed with the updated generation step, API TypeScript compilation and Vite build. No new feature tests needed for the script correction.
- Remaining: push changes to the GitHub branch deployed by Render and redeploy with matching build/start settings.

## Vercel output directory configuration
- Status: TESTED locally; hosted redeployment pending.
- Modified: apps/web/vercel.json, README and progress docs.
- Findings: frontend compilation succeeds and emits apps/web/dist/index.html. Vercel expected dist relative to its configured root.
- Fix: provide web-root config with dist; retain root config with apps/web/dist; document matching dashboard settings for both roots. No API or database changes.
- Verification: frontend production build and emitted index.html confirmed.
- Remaining: save matching Vercel dashboard settings and redeploy.

## Hosted login connection diagnosis
- Status: TESTED locally; live connection unresolved pending exact deployment URLs.
- Modified: web API configuration, request handling, tests and documentation.
- Cause established in code: missing VITE_API_URL previously silently selected localhost in production. The supplied screenshot establishes a browser network failure, not the exact deployed URL or CORS cause.
- Changes: require a public HTTPS API for production; normalize API origin and trailing slashes; actionable connection/non-JSON errors. No authentication weakening or database changes.
- Verification: URL validation tests and production frontend/workspace builds.
- Remaining: confirm actual Render API address and exact Vercel origin, inspect health/CORS and redeploy corrected environment.

## Live login CORS diagnosis
- Confirmed: public Render health and server-side login/session/logout return HTTP 200; deployed Vercel bundle points to the correct Render /api/v1 URL. Preflight lacks Access-Control-Allow-Origin for the supplied Vercel URL.
- Fix: set Render CORS_ORIGIN to the exact Vercel origin. Code additionally normalizes trailing slashes, rejects invalid origin settings and preserves exact origin matching.
- Tests: unit and HTTP preflight coverage for allowed and blocked origins, plus workspace build.
- Status: local fix tested; live environment change pending user dashboard access.

## WordPress delivery reliability
- Status: TESTED locally and against the public CRM API; actual WordPress delivery unverified.
- Changes: connector 0.3.0 immediate delivery attempt, safe HTTP/network diagnostics, retry cancellation after success, direct-send admin action and API URL normalization. Added admin-only GET /integrations/website-status and corresponding persisted receipt indicator. No schema changes.
- Live check: deployed Render signed connection test returned HTTP 200 using configured key; no evidence yet of the website plugin's saved configuration.
- Verification: PHP tests exercise shutdown registration, retry diagnostics and successful retry cancellation; local API tests cover signatures, idempotency and authorized receipt counts.
- Remaining: update WordPress plugin and redeploy API/frontend, configure matching key, verify real website submission and historical import.

- Public API diagnostic: two signed deliveries returned HTTP 202 with the same lead ID; authenticated listing showed the lead; exactly that temporary diagnostic record was removed. Workspace build, API tests, PHP syntax and extracted plugin behavior tests passed.

## Direct WordPress lead synchronization
- Status: TESTED locally; website update and hosted redeployment pending.
- Confirmed: Neon has 40 demo leads and no real website/form submissions. Public WordPress connector README identifies version 0.3.0. The separate form counter is not a count of saved WordPress enquiries.
- Created: apps/api/src/nestoria-sync.ts. Modified: API routes, CRM integration UI, WordPress connector, deployment environment example, tests and docs.
- API: admin/CSRF-protected POST /integrations/nestoria/sync; signed WordPress GET /khushii-crm/v1/enquiries. No database migration.
- Behavior: imports private enquiries by ID cursor in pages of 50; createMany skipDuplicates preserves assignments/statuses; invalid contacts and connection errors are reported; arbitrary client-supplied website URLs are not accepted. Push/pull share the same external IDs.
- Verification: build and type checks, local signed mock-WordPress integration tests covering multiple pages, repeat import, unauthorized access and remote auth failure; PHP authentication/export/field mapping and packaged connector behavior tests.
- Remaining: install connector 0.4.0 on actual WordPress and deploy CRM changes; verify actual historical imports. No claim that live WordPress data has been imported.

## Lead enquiry presentation
- Status: TESTED locally; frontend redeployment pending.
- Created: apps/web/src/enquiry-details.ts and apps/web/tests/enquiry-details.test.ts.
- Modified: lead table UI and responsive styles; progress documentation.
- Changes: full-width labelled enquiry panel, separate project/plot/budget/visit/message/source fields, received project-name fallback when CRM relation is missing, contact links, readable dates and numeric budgets without assuming currency.
- Data/API changes: none. Existing collapsed WordPress notes are parsed on display; plain notes remain readable and source links permit HTTP/HTTPS only.
- Verification: parser/security regression tests and production build. No new API authorization or database migration required.
- Remaining: deploy frontend changes to Vercel and verify the layout in the hosted browser.

## Khushii Enquiry Pro compatibility
- Status: TESTED locally and with packaged WordPress behavior stubs; live installation unverified.
- Inspected: supplied khushii-enquiry-pro archive, version 2.3.0. Private `khep_enquiry` records and `_khep_*` fields confirmed; built-in CRM API is EspoCRM-specific.
- Modified: shared connector 0.5.0, sync payload validation and receipt counts, lead source/interest UI, tests and docs. Original uploaded plugin archive unchanged.
- Behavior: signed push after complete metadata save, paginated import of both post types, separate idempotency namespaces, retention of full 3000-character message plus context. Contact consent is not marketing consent. Existing namespace/status/assignment preservation remains intact.
- Schema changes: none. Lead note request limit increased to 6000 (database String already supports it).
- Tests: Enquiry Pro field/consent mapping, automatic delivery, shared push/pull IDs, mixed-source API imports and retries, interest formatting, PHP syntax, package extraction, TypeScript and production build.
- Remaining: deploy API/frontend and upgrade shared connector in WordPress, then verify actual form submission and historical imports.

## Per-lead activity and communication workspace
- Status: TESTED locally; provider activation and hosted deployment outstanding.
- Created: LeadWorkspace UI, lead-workspace API module, messaging adapters/tests, durable WhatsApp receipt reconciliation, reminder worker, two additive migrations and docs/LEAD_WORKSPACE.md.
- Modified: Prisma schema, API registration/status/assignment tracking, lead navigation, global follow-ups, styles, tests, environment examples and Render worker deployment.
- Database: LeadActivity, Reminder, OutboundMessage, LeadConsent; receipt payload and processedAt. Applied to local development and configured Neon databases.
- API: authorized workspace reads; notes/calls/meetings; consent; reminders/completion; provider configuration flags; approved templates; idempotent outbound email/WhatsApp; signed WhatsApp verification/status webhooks.
- Tests: mocked provider payloads/template approval; IDOR and viewer write denial; reminder claims and completion; consent gating; duplicate message IDs and payload collisions; webhook signatures, repeats, order and early receipts; headless Chrome note/reminder workflow with fictional data; production build and type checks.
- Errors: corrected discriminated-union closure typing during compilation. Existing Windows Prisma engine lock requires stopping the local API during generation.
- Blockers: Resend and WhatsApp credentials are blank placeholders, Meta webhook subscription is not verified and the reminder worker is not deployed.
- Remaining: live provider configuration and explicit test sends, worker deployment, media/button templates, inbound inbox, email delivery webhooks, older-history pagination and broadcast campaigns.
- Completion date: not marked complete; live activation outstanding.

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
