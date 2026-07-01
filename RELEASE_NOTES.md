# Atlas BOS — Release Notes v1.0.0

**Release date:** 2026-06-30  
**Codename:** Atlas  
**Status:** Production-ready

Atlas v1.0.0 is the first production release of the Business Operating System. It delivers a unified multi-tenant platform with authenticated web UI, REST API, background workers, container deployment, and observability — built on 133 Prisma models, 12 SQL migrations, and 11 domain modules.

---

## Highlights

### UX & Onboarding

- **Two-step onboarding wizard** (`OnboardingWizard`) guides new users through workspace and organization creation with timezone auto-detection and slug generation.
- **App shell** with sidebar navigation across CRM, Finance, Projects, Workflows, Automation, AI, and Settings.
- **Loading and error boundaries** on authenticated routes for resilient page transitions.
- **Responsive layouts** validated by Playwright mobile viewport smoke tests.

### Web Middleware & Auth

- **Next.js middleware** (`apps/web/src/middleware.ts`) enforces cookie-based session gating on all non-public routes.
- Unauthenticated users redirect to `/login?next=<path>`; authenticated users on auth routes redirect to `/dashboard`.
- Public paths: `/`, `/login`, `/register`, `/login/mfa`, `/terms`, `/privacy`.
- API-side **JWT + Bearer authentication** with organization route access verification and active membership checks.

### Toast Notifications

- **`ToastProvider`** wired in the root layout via `providers.tsx`.
- Success and error toasts on CRM updates, onboarding completion, and form submissions via `useToast()` from `@atlas/ui`.

### Members Management

- **`/settings/members`** page for listing, inviting, and managing organization members.
- API: `GET/POST /v1/organizations/:id/members`, team member assignment endpoints.
- RBAC permission checks enforced on member routes.

### Audit Log

- **`/settings/audit`** page displays paginated audit log entries with actor, action, entity, and timestamp.
- API: `GET /v1/organizations/:organizationId/audit-log` and entity-scoped history.
- Outbox pattern publishes domain events to Kafka via the worker outbox publisher.

### CRM Account Details

- **`/crm/accounts/[id]`** detail page with inline edit, field validation, and status badges.
- Full CRUD for accounts, contacts, deals, and pipeline stages.
- Toast feedback on successful updates.

### Workflow Approvals

- **`/workflows/approvals`** inbox for pending approval requests.
- Approve/reject actions via `POST .../approvals/:id/approve` and `.../reject`.
- Workflow runtime worker advances instances on approval completion.

### Notifications Bell

- **`NotificationBell`** component in the app shell header with unread count badge.
- Fetches inbox via `notificationsApi.listInbox()`; links to `/notifications` full page.
- Notification delivery worker processes email and in-app channels.

### MFA Challenge UI

- **`/login/mfa`** page for TOTP verification after login returns `mfa_required: true`.
- Session ID stored in `sessionStorage`; redirects to login if session is missing.
- API: `POST /v1/auth/mfa/verify`.

### CI/CD

- **GitHub Actions** workflow (`.github/workflows/ci.yml`) on push/PR to `main`, `master`, `develop`.
- Pipeline: install → Prisma generate → SQL migrate → lint → typecheck → build → unit/integration tests → Playwright E2E.
- Services: Postgres (pgvector), Redis; `KAFKA_MOCK=true` in CI.
- **`pnpm validate`** provides a Windows-safe sequential runner bypassing Turbo when needed.

### Observability

- **Prometheus metrics** on API (`:3001/metrics`) and worker (`:3002/metrics`) when `PROMETHEUS_ENABLED=true`.
- **Grafana** dashboards provisioned from `infra/grafana/provisioning/`.
- Structured logging with `x-request-id` correlation IDs.
- Health endpoints: `GET /health` (liveness), `GET /ready` (database readiness).

---

## Platform Capabilities (v1.0)

| Module | Package | Key Features |
|--------|---------|--------------|
| Tenant Identity | `@atlas/module-tenant-identity` | Auth, workspaces, orgs, teams, RBAC |
| Notifications | `@atlas/module-notifications` | In-app inbox, email delivery, preferences |
| Storage | `@atlas/module-storage` | Folders, file upload, sharing |
| Audit | `@atlas/module-audit` | Audit log, outbox, domain events |
| Workflow | `@atlas/module-workflow` | Definitions, instances, approvals |
| Automation | `@atlas/module-automation` | Rules, cron triggers, dry-run |
| AI | `@atlas/module-ai` | Agent definitions, runs, tool registry |
| AI Memory | `@atlas/module-ai-memory` | Knowledge base, hybrid semantic search |
| CRM | `@atlas/module-crm` | Accounts, contacts, deals, pipelines |
| Finance | `@atlas/module-finance` | Chart of accounts, journal entries |
| Projects | `@atlas/module-projects` | Projects and tasks |

---

## Infrastructure

| Component | Technology |
|-----------|------------|
| Database | PostgreSQL 16 + pgvector, 9 schemas, V001–V012 migrations |
| Cache/Queue | Redis 7, BullMQ (7 queue types + DLQ) |
| Messaging | Redpanda/Kafka, CloudEvents 1.0, Redis pub/sub fan-out |
| Containers | Multi-stage Node 20 Alpine images (API, worker, web) |
| Orchestration | Kubernetes manifests with HPA, ingress, probes |
| Compose | `docker-compose.prod.yml` — full stack with Prometheus + Grafana |

---

## Upgrade Notes

### From 0.x to 1.0.0

1. Update `package.json` version references if pinning internally.
2. Run all SQL migrations: `pnpm db:migrate` (applies V001–V012).
3. Set production secrets — especially `JWT_SECRET` (≥ 64 random characters).
4. Run `pnpm env:validate` before deploy.
5. Run `pnpm validate` to confirm build and test health.
6. Review [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) before going live.

### Breaking Changes

None — v1.0.0 is the first production release. Pre-1.0 development builds should migrate via `pnpm db:migrate`.

---

## Known Limitations

- AI agent executor uses a stub implementation; swap for LLM providers in production.
- Embeddings use deterministic local 64-dim vectors; replace with provider-backed vectors for production RAG.
- Email delivery logs to console when `SMTP_HOST` is unset.
- Full Phase 4 UI spec (208 screens) is implemented incrementally; v1.0 covers core product surfaces.

---

## Documentation

- [FINAL_ARCHITECTURE.md](FINAL_ARCHITECTURE.md)
- [CHANGELOG.md](CHANGELOG.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)