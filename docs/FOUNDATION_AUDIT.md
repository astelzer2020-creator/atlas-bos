# Milestone 1 — Foundation Audit

**Date:** 2026-06-30  
**Scope:** Architecture, dependencies, build pipeline, database, APIs, auth, infrastructure

## Architecture Summary

| Layer | Technology |
|-------|------------|
| Monorepo | pnpm 9 + Turbo 2 |
| API | Fastify (`@atlas/api`) |
| Worker | Node background processors (`@atlas/worker`) |
| Web | Next.js 15 (`@atlas/web`) |
| Database | PostgreSQL 16 + pgvector, Prisma client, SQL migrations (V001–V012) |
| Messaging | Kafka/Redpanda (mock in test), Redis pub/sub |
| Modules | 11 domain packages under `packages/modules/` |

## Prioritized Improvements

### P0 — Implemented

| Issue | Resolution |
|-------|------------|
| SQL migration pipeline broken | `packages/database/scripts/migrate-sql.mjs` applies `db/migrations/V*.sql` |
| RLS not enforced | `configureTenantContextResolver` + Prisma tenant extension wired in API bootstrap |
| RBAC not enforced on routes | `resolveRoutePermission` + `assertRoutePermission` in auth middleware |
| Turbo broken on Windows | `pnpm validate` runs sequential per-package build/typecheck/test |
| Kafka mock forced in development | Mock only when `NODE_ENV=test` |
| Prometheus `/metrics` inject hang in tests | Middleware disabled in `test` env; route remains testable |
| Stray compiled artifacts in `src/` | Removed `.js`/`.d.ts` build outputs from package `src/` trees |
| Lint failures blocking CI | Fixed ESLint issues; scoped lint to `src/**/*.ts` |

### P1 — Implemented

| Issue | Resolution |
|-------|------------|
| No CI/CD | `.github/workflows/ci.yml` with Postgres, Redis, migrate, lint, build, tests, Playwright |
| Dual lockfiles | Removed root and package-level `package-lock.json` files |
| README outdated | Updated status and milestone tracking |
| Lint in validation | Added lint step to `scripts/validate.mjs` |

### P2 — Deferred to Later Milestones

| Issue | Target Milestone |
|-------|------------------|
| Production stubs (AI agent, email, workflow service_task) | M2 — Core Product |
| Lint coverage ~18% of packages | M8 — Final Polish |
| Missing RBAC permissions for storage/workflow/audit modules | M4 — Enterprise Features |
| Integration test typecheck gaps | M8 — Final Polish |

## Validation

Run the full Windows-safe validation suite:

```bash
pnpm validate
```

This executes lint, build, typecheck, unit tests, integration tests, and Playwright E2E sequentially.

## Security Posture (Foundation)

- JWT authentication with cookie + Bearer support
- Organization route access verification (JWT `org_id` + active membership)
- RBAC permission checks on mapped routes
- Row-level security via `setOrganizationContext` on Prisma queries
- Helmet, CORS, rate limiting on API
- Structured error responses (RFC 7807 problem details)