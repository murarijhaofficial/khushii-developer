# Khushii CRM coding agent guide
- Use pnpm workspaces, TypeScript strict mode, Zod validation and Prisma migrations.
- Never place API tokens, JWT signing keys or integration secrets in the Vite frontend.
- Do not describe mock providers as connected live integrations.
- For each feature: update the schema if needed, implement API authorization, UI, tests and documentation.
- Log progress in docs/PROGRESS.md and verify `pnpm build` before declaring completion.
- Do not send WhatsApp marketing messages without explicit opt-in and approved templates.
- Implement webhook signature verification and idempotency for each provider before production use.
- Do not commit .env or production contact information.

## Development workflow
- Read `docs/ARCHITECTURE.md` and `DEVELOPMENT_PROGRESS.md` before changing code; work module by module and avoid unrelated changes.
- Validate external input, enforce server-side authorization and ownership, and add migrations for schema changes.
- Add tests for new functionality; run the relevant tests, type checks, available lint checks and production build. Record unavailable checks and blockers.
- Document external provider dependencies and activation requirements. Do not claim untested functionality works.
- Update the development tracker after each task, including remaining work; preserve existing functionality and compatibility where practical.
- Keep styling consistent and never expose credentials.
