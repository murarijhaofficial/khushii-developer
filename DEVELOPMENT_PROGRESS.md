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
