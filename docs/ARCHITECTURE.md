# Current architecture

The pnpm workspace contains an Express/TypeScript API in `apps/api` and a React/Vite client in `apps/web`. Prisma and versioned migrations are in `apps/api/prisma`; PostgreSQL persists CRM records and authentication sessions. The web app calls `/api/v1` and keeps CSRF tokens in memory. Sessions use an HttpOnly cookie; the API checks the current user role on each request.

This is a starter, not the full platform described in the master brief. There is no worker, Redis integration or live advertising/WhatsApp integration. A Nestoria WordPress connector supports signed push delivery and signed, read-only export for administrator-initiated CRM imports; its actual website installation/version and credentials must be verified. Provider activation requires separately implemented and verified authentication, signatures, idempotency, consent handling and credentials.
