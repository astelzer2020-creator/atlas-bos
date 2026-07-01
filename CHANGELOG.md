# Changelog

All notable changes to Atlas BOS are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-30

### Added

- Production release documentation: `RELEASE_NOTES.md`, `FINAL_ARCHITECTURE.md`, `PRODUCTION_CHECKLIST.md`, `docs/DEPLOYMENT.md`
- `scripts/env-validate.mjs` and `pnpm env:validate` for pre-deploy environment checks
- UX onboarding wizard with workspace and organization creation flow
- Next.js auth middleware with cookie-based route protection and `next` redirect parameter
- Toast notification system via `@atlas/ui` `ToastProvider` across product pages
- Members management UI at `/settings/members`
- Audit log viewer at `/settings/audit`
- CRM account detail page at `/crm/accounts/[id]` with inline editing
- Workflow approvals inbox at `/workflows/approvals`
- Notification bell component with unread count in app shell header
- MFA challenge UI at `/login/mfa` with session-based verification flow
- Knowledge base UI at `/ai/knowledge` for document upload and semantic search
- E2E smoke tests (Playwright) for landing, login, register, and mobile viewport
- Performance test suite with hybrid search and queue throughput benchmarks

### Changed

- README updated to v1.0.0 production-ready status with quick start and validation commands
- Version bumped from `0.1.0` to `1.0.0`

### Security

- API auth middleware enforces JWT verification, organization route access, active membership, and RBAC permissions
- Row-level security via Prisma tenant context extension
- Helmet security headers (CSP, HSTS, CORP, COOP) in production
- Rate limiting: 200 req/min per user/IP in production
- Containers run as non-root UID 1001 with read-only root filesystem in K8s

## [0.9.0] - 2026-06-30

### Added

- Full authenticated app shell with sidebar navigation across all product modules
- Web pages for CRM (accounts, contacts, deals), Finance, Projects, Workflows, Automation, AI, Settings, Notifications
- Typed API client (`apps/web/src/lib/api-client.ts`) with snake_case response mapping
- Organization context hook for multi-tenant page data loading
- Page header, data table, and form error components

### Changed

- Web app expanded from dashboard shell to functional product surfaces

## [0.8.0] - 2026-06-30

### Added

- `@atlas/e2e-tests` Playwright package with smoke test suite
- `@atlas/performance-tests` with hybrid search (2000 chunks < 500ms) and envelope throughput benchmarks
- `@atlas/module-ai-memory` with hybrid semantic search and knowledge chunk storage
- Knowledge base API routes and `/ai/knowledge` frontend route
- AI tool registry with `get_current_time` and `echo` built-in tools

### Changed

- SQL migration V012 adds AI memory tables and embedding columns

## [0.7.0] - 2026-06-30

### Added

- `@atlas/integration-tests` package with 20 tests (11 mock + 9 live with graceful skip)
- Integration coverage for API health, worker health, queue envelopes, and CloudEvents round-trip
- Optional Testcontainers Redis support via `INTEGRATION_USE_TESTCONTAINERS=true`
- Cron schedule engine in `@atlas/module-automation` with Redis deduplication

### Changed

- Live integration suites skip gracefully when `API_BASE_URL`, `WORKER_BASE_URL`, or `REDIS_URL` are unavailable

## [0.6.0] - 2026-06-30

### Added

- `docker-compose.prod.yml` with API, worker, web, Postgres, Redis, Redpanda, Prometheus, Grafana
- Multi-stage Dockerfiles: `infra/docker/Dockerfile.api`, `Dockerfile.worker`, `Dockerfile.web`
- Kubernetes manifests in `infra/k8s/`: deployments, services, ingress, HPA, configmap, secret template
- Prometheus scrape config for API and worker `/metrics` endpoints
- Grafana provisioning with datasource and dashboard config

### Changed

- Production compose requires `JWT_SECRET` via environment variable substitution

## [0.5.0] - 2026-06-30

### Added

- `@atlas/worker` application with 6 background processors:
  - Outbox publisher (DB poll → Kafka + Redis fan-out)
  - Workflow runtime (approval step advancement)
  - Automation matcher (Kafka consumer)
  - AI executor (BullMQ `ai` queue)
  - Notification delivery (BullMQ `email` queue)
  - Scheduled jobs (cron trigger evaluation)
- Worker health server: `GET /health`, `GET /ready`, `GET /metrics` on port 3002
- Graceful shutdown handling in worker bootstrap

### Changed

- Domain events published via transactional outbox pattern in `atlas_audit.outbox`

## [0.4.0] - 2026-06-30

### Added

- `@atlas/event-bus` package with Kafka producer, Redis pub/sub, CloudEvents 1.0 envelope
- `@atlas/queue` package with BullMQ wrapper, 7 queue types, DLQ archive and replay
- Topic naming convention: `atlas.<domain>.<entity>.<action>.v1`
- `KAFKA_MOCK` mode for test/CI environments

### Changed

- Kafka mock now only forced in `NODE_ENV=test` (not development)

## [0.3.0] - 2026-06-30

### Added

- GitHub Actions CI pipeline (`.github/workflows/ci.yml`)
- `scripts/validate.mjs` Windows-safe sequential validation runner
- Foundation audit documentation (`docs/FOUNDATION_AUDIT.md`)
- SQL migration pipeline fix: `packages/database/scripts/migrate-sql.mjs`
- RBAC enforcement via `resolveRoutePermission` + `assertRoutePermission`
- RLS enforcement via `configureTenantContextResolver` + Prisma tenant extension

### Fixed

- Turbo broken on Windows — validation runs per-package sequentially
- Prometheus `/metrics` middleware hang in tests — disabled in test env
- Stray compiled artifacts removed from package `src/` trees
- ESLint failures blocking CI

### Removed

- Duplicate `package-lock.json` files (pnpm-only monorepo)

## [0.2.0] - 2026-06-30

### Added

- `@atlas/module-finance` — chart of accounts, journal entries (15 tests)
- `@atlas/module-projects` — projects and tasks (15 tests)
- `@atlas/module-crm` — accounts, contacts, deals, pipeline stages (13 tests)
- `@atlas/module-ai` — agent definitions and runs (12 tests)
- SQL migrations V009 (CRM), V010 (finance), V011 (projects), V008 (AI agents)
- API routes for CRM, finance, projects, and AI modules

## [0.1.0] - 2026-06-30

### Added

- Monorepo scaffold with pnpm 9 + Turbo 2
- `@atlas/shared-kernel` — domain primitives, branded IDs, errors (17 tests)
- `@atlas/platform` — JWT auth, logging, metrics, HTTP utilities (9 tests)
- `@atlas/database` — Prisma client, 9 PostgreSQL schemas, SQL migrations V001–V007 (5 tests)
- `@atlas/ui` — design system components including Button, Card, Input, Toast (6 tests)
- `@atlas/module-tenant-identity` — auth, workspaces, orgs, teams, RBAC (12 tests)
- `@atlas/module-notifications` — in-app and email notifications (10 tests)
- `@atlas/module-storage` — document storage with local provider (8 tests)
- `@atlas/module-audit` — audit log and outbox (12 tests)
- `@atlas/module-workflow` — workflow definitions, instances, approvals (17 tests)
- `@atlas/module-automation` — automation rules and triggers (26 tests)
- `@atlas/api` — Fastify REST API wiring all modules (2+ tests)
- `@atlas/web` — Next.js 15 app with auth pages and dashboard shell
- `docker-compose.yml` — dev infrastructure (Postgres, Redis, Redpanda, Prometheus, Grafana)
- Phase 1–5 architecture documentation (100+ design documents)
- `.env.example` with all configuration variables

[1.0.0]: https://github.com/atlas-bos/atlas-bos/compare/v0.9.0...v1.0.0
[0.9.0]: https://github.com/atlas-bos/atlas-bos/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/atlas-bos/atlas-bos/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/atlas-bos/atlas-bos/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/atlas-bos/atlas-bos/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/atlas-bos/atlas-bos/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/atlas-bos/atlas-bos/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/atlas-bos/atlas-bos/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/atlas-bos/atlas-bos/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/atlas-bos/atlas-bos/releases/tag/v0.1.0