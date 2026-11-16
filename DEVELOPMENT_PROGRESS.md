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
