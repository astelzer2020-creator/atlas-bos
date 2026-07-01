---
title: Monorepo Folder Structure
document_id: ATLAS-PHASE2-06
version: 1.0.0
status: approved
phase: 2
last_updated: 2026-06-30
authors:
  - Atlas Platform Architecture Team
related_documents:
  - ATLAS-ARCH-02
  - ATLAS-ARCH-03
  - ATLAS-ARCH-24
  - ../standards/coding-standards.md
  - ../standards/naming-standards.md
adr_references:
  - ADR-0001
  - ADR-0004
tags:
  - monorepo
  - folder-structure
  - modular-monolith
  - clean-architecture
  - ddd
---

# Monorepo Folder Structure

## Purpose

Define the canonical repository layout for Atlas BOS — a production-grade monorepo that enforces **bounded context boundaries**, supports **Clean Architecture + DDD**, enables **microservice extraction**, and scales to dozens of engineering teams without merge conflicts or architectural erosion.

This document is the authoritative reference for where code, configuration, tests, and documentation live. All new work must conform to this structure unless superseded by an approved ADR.

## Scope

### In Scope

- Complete monorepo directory tree (`apps/`, `packages/`, `services/`, `infra/`, `docs/`)
- Bounded context module internal structure
- Shared package organization and dependency rules
- Test file placement and naming conventions
- Configuration and environment file locations
- Tooling root files (workspace, CI, lint)

### Out of Scope

- Per-module entity schemas (Phase 3 — Database Design)
- OpenAPI and GraphQL contract files (Phase 5 — API Contracts)
- Infrastructure provisioning implementation (see `03-infrastructure-architecture.md`)

---

## Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Vertical slices** | Organize by bounded context, not technical layer at repo root |
| **Explicit boundaries** | Modules expose only `module.ts` facades; no cross-module infrastructure imports |
| **Colocated tests** | Unit tests beside source; integration tests in dedicated `__tests__` trees |
| **Shared kernel minimalism** | `shared-kernel` contains only cross-cutting primitives — resist growth |
| **Extract-ready** | Each module maps 1:1 to a future deployable service |
| **Docs as code** | Architecture, ADRs, and API specs live in `docs/` alongside implementation |

---

## Repository Root

```
atlas-bos/
├── apps/                       # Deployable applications (Node.js / Next.js)
├── packages/                   # Shared libraries and bounded context modules
├── services/                   # Extracted Go performance services
├── infra/                      # Infrastructure-as-code, K8s manifests, local dev
├── docs/                       # All platform documentation
├── tools/                      # Repo-wide scripts, codegen, migration utilities
├── .github/                    # GitHub Actions workflows, CODEOWNERS, templates
├── package.json                # Root workspace manifest (pnpm/turbo)
├── pnpm-workspace.yaml         # Workspace package globs
├── turbo.json                  # Build pipeline orchestration
├── tsconfig.base.json          # Shared TypeScript compiler options
├── eslint.config.mjs           # Root ESLint flat config
├── .prettierrc                 # Prettier formatting rules
├── .editorconfig               # Editor consistency
├── docker-compose.yml          # Local development stack
├── Makefile                    # Common developer commands
├── README.md                   # Repository overview and quick start
└── MASTER_INSTRUCTIONS.md      # Project governance and phase gates
```

### Root File Responsibilities

| File | Purpose |
|------|---------|
| `pnpm-workspace.yaml` | Declares `apps/*`, `packages/*`, `packages/modules/*` |
| `turbo.json` | Defines build/test/lint dependency graph and caching |
| `tsconfig.base.json` | Strict TypeScript defaults inherited by all packages |
| `docker-compose.yml` | PostgreSQL, Redis, Kafka, OpenSearch, OPA for local dev |
| `Makefile` | `make dev`, `make test`, `make migrate`, `make lint` |

---

## `apps/` — Deployable Applications

Applications are thin composition roots that wire modules together. They contain **no business logic**.

```
apps/
├── api/                        # Main modular monolith API process
│   ├── src/
│   │   ├── main.ts             # Bootstrap: DI container, HTTP server
│   │   ├── app.module.ts       # Module registration and middleware
│   │   ├── config/             # App-level config loading
│   │   └── health/             # Liveness/readiness probes
│   ├── test/
│   │   ├── integration/        # Full-stack API integration tests
│   │   └── e2e/                # End-to-end smoke tests
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── web/                        # Next.js frontend (App Router)
│   ├── src/
│   │   ├── app/                # Next.js App Router pages and layouts
│   │   ├── features/           # Feature folders aligned to bounded contexts
│   │   │   ├── customer/
│   │   │   ├── commercial/
│   │   │   ├── ledger/
│   │   │   └── ...
│   │   ├── components/         # App-specific composed components
│   │   ├── hooks/              # Shared React hooks
│   │   ├── lib/                # API clients, auth helpers, utilities
│   │   └── styles/             # Global styles and theme overrides
│   ├── public/                 # Static assets
│   ├── test/
│   │   ├── unit/               # Component unit tests (Vitest)
│   │   └── e2e/                # Playwright browser tests
│   ├── next.config.ts
│   ├── Dockerfile
│   └── package.json
│
├── worker/                     # Async event consumers and background jobs
│   ├── src/
│   │   ├── main.ts             # Consumer group bootstrap
│   │   ├── consumers/          # Kafka consumer registrations per module
│   │   ├── schedulers/         # Cron/scheduled job runners
│   │   └── handlers/           # Cross-cutting job handlers (outbox relay)
│   ├── test/
│   ├── Dockerfile
│   └── package.json
│
└── gateway/                    # API gateway (BFF + routing + auth)
    ├── src/
    │   ├── main.ts
    │   ├── routes/             # Proxy routing rules
    │   ├── middleware/         # JWT validation, rate limiting, tenant injection
    │   ├── graphql/            # GraphQL gateway / federation entry
    │   └── websocket/          # WebSocket upgrade handlers
    ├── test/
    ├── Dockerfile
    └── package.json
```

### App Dependency Rules

| Rule | Description |
|------|-------------|
| **A1** | Apps may import from `packages/modules/*/module.ts` facades and `packages/platform` |
| **A2** | Apps must not import module `domain/`, `infrastructure/`, or `application/` directly |
| **A3** | `apps/api` is the sole owner of HTTP route registration for REST/GraphQL |
| **A4** | `apps/web` communicates only via public APIs — never direct DB or module imports |
| **A5** | `apps/worker` registers consumers declared in module `infrastructure/messaging/` |

---

## `packages/` — Shared Libraries and Modules

```
packages/
├── shared-kernel/              # Minimal cross-cutting primitives
│   ├── src/
│   │   ├── ids/                # TenantId, OrganizationId, UserId, etc.
│   │   ├── value-objects/      # Money, EmailAddress, DateRange, PhoneNumber
│   │   ├── events/             # EventEnvelope<T>, DomainEvent base
│   │   ├── result/             # Result<T, E> railway-oriented errors
│   │   └── time/               # Timestamp, Ulid utilities
│   ├── test/
│   └── package.json            # @atlas/shared-kernel
│
├── platform/                   # Cross-cutting platform services
│   ├── src/
│   │   ├── auth/               # JWT parsing, session context, tenant middleware
│   │   ├── authorization/      # OPA client, policy evaluation helpers
│   │   ├── logging/            # Structured logger, correlation ID
│   │   ├── tracing/            # OpenTelemetry instrumentation
│   │   ├── idempotency/        # Redis-backed idempotency store
│   │   ├── database/           # Connection pool, RLS context setter, unit-of-work
│   │   ├── messaging/          # Outbox, Kafka publisher abstractions
│   │   ├── errors/             # Error taxonomy, HTTP mappers
│   │   ├── config/             # Typed environment config loader
│   │   └── testing/            # Test utilities, factories, mocks
│   ├── test/
│   └── package.json            # @atlas/platform
│
├── ui/                         # Design system (React components, tokens)
│   ├── src/
│   │   ├── components/         # Button, Input, Table, Modal, etc.
│   │   ├── tokens/             # Colors, spacing, typography
│   │   ├── icons/
│   │   └── hooks/
│   ├── test/
│   └── package.json            # @atlas/ui
│
├── contracts/                  # Shared API and event schemas
│   ├── src/
│   │   ├── rest/               # OpenAPI-generated types
│   │   ├── graphql/            # GraphQL schema fragments
│   │   └── events/             # Integration event JSON schemas
│   ├── test/
│   └── package.json            # @atlas/contracts
│
└── modules/                  # Bounded context modules (core business logic)
    ├── tenant-identity/
    ├── customer/
    ├── commercial/
    ├── ledger/
    ├── workforce/
    ├── delivery/
    ├── service/
    ├── content/
    ├── communication/
    ├── campaign/
    ├── stock/
    ├── obligation/
    ├── insight/
    ├── presence/
    ├── calendar/
    ├── knowledge/
    ├── orchestration/
    └── intelligence/
```

### Package Naming Convention

All packages use the `@atlas/` scope:

| Package | NPM Name |
|---------|----------|
| Shared kernel | `@atlas/shared-kernel` |
| Platform | `@atlas/platform` |
| Design system | `@atlas/ui` |
| Contracts | `@atlas/contracts` |
| Customer module | `@atlas/module-customer` |
| Ledger module | `@atlas/module-ledger` |

---

## Bounded Context Module Structure

Every module under `packages/modules/{context}/` follows identical Clean Architecture layering:

```
packages/modules/customer/
├── domain/
│   ├── aggregates/
│   │   ├── contact.ts
│   │   ├── lead.ts
│   │   └── contact.spec.ts         # Colocated unit tests
│   ├── entities/
│   ├── value-objects/
│   ├── events/
│   │   ├── lead-created.event.ts
│   │   └── contact-updated.event.ts
│   ├── repositories/               # Interfaces ONLY — no implementations
│   │   ├── contact.repository.ts
│   │   └── lead.repository.ts
│   ├── services/                   # Domain services (pure logic)
│   └── specifications/
│
├── application/
│   ├── commands/
│   │   ├── create-lead.command.ts
│   │   ├── create-lead.handler.ts
│   │   └── create-lead.handler.spec.ts
│   ├── queries/
│   │   ├── get-contact.query.ts
│   │   ├── get-contact.handler.ts
│   │   └── contact-query.service.ts
│   ├── dto/
│   │   ├── contact.dto.ts
│   │   └── mappers/
│   ├── policies/                   # Authorization policies for use cases
│   └── events/                     # Integration event handlers (ACL entry)
│
├── infrastructure/
│   ├── persistence/
│   │   ├── postgres/
│   │   │   ├── contact.repository.impl.ts
│   │   │   ├── migrations/         # Flyway SQL: V001__create_contacts.sql
│   │   │   └── schema/             # Module schema DDL reference
│   │   └── redis/
│   ├── messaging/
│   │   ├── publishers/
│   │   ├── consumers/
│   │   └── outbox/
│   ├── search/
│   │   └── opensearch/
│   ├── acl/                        # Anti-corruption layers
│   │   ├── commercial-order-handler.ts
│   │   └── external-salesforce/
│   └── external/                   # Third-party API clients
│
├── presentation/
│   ├── rest/
│   │   ├── contact.controller.ts
│   │   ├── contact.routes.ts
│   │   └── contact.controller.spec.ts
│   └── graphql/
│       ├── contact.resolver.ts
│       └── contact.types.ts
│
├── test/
│   ├── integration/                # DB + messaging integration tests
│   │   ├── contact.repository.integration.spec.ts
│   │   └── create-lead.integration.spec.ts
│   ├── contract/                   # Event schema contract tests
│   │   └── lead-created.contract.spec.ts
│   └── fixtures/
│       ├── contact.fixture.ts
│       └── factories/
│
├── module.ts                       # PUBLIC FACADE — only external import point
├── index.ts                        # Re-exports from module.ts
├── package.json
└── tsconfig.json
```

### Module Facade (`module.ts`)

The facade is the **only** entry point for cross-module imports:

```typescript
// packages/modules/customer/module.ts
export { CreateLeadCommand, CreateLeadHandler } from './application/commands';
export { ContactQueryService } from './application/queries';
export type { CustomerId, LeadId, LeadCreatedEvent } from './domain';
// Explicitly NO exports from infrastructure/ or presentation/
```

### Module Boundary Rules

| Rule | Description |
|------|-------------|
| **M1** | Modules depend only on `@atlas/shared-kernel` and `@atlas/platform` |
| **M2** | Cross-module imports allowed only from `module.ts` facades |
| **M3** | No direct imports of another module's `domain/`, `infrastructure/`, or `application/` |
| **M4** | Cross-module writes via integration events → ACL handlers → commands |
| **M5** | Cross-module reads via facade query services or Insight read models |
| **M6** | Each module owns a PostgreSQL schema (e.g., `customer`, `ledger`) |
| **M7** | Circular dependencies forbidden — enforced by `dependency-cruiser` in CI |

### Module Dependency Matrix

```
                    shared-kernel
                         │
                    platform
                         │
        ┌────────────────┼────────────────┐
        │                │                │
  tenant-identity    customer         commercial
        │                │                │
        │           (events only)    (events only)
        │                │                │
        │                └───────┬────────┘
        │                        │
        │                     ledger
        │                        │
        └──────── orchestration ─┴── intelligence
                    (ACL only)      (read + ACL)
```

---

## `services/` — Extracted Go Performance Services

Go services are extracted when TypeScript cannot meet throughput or latency requirements. Each service follows hexagonal (ports/adapters) architecture.

```
services/
├── search-indexer/                 # OpenSearch indexing pipeline
│   ├── cmd/
│   │   └── indexer/
│   │       └── main.go
│   ├── internal/
│   │   ├── domain/
│   │   ├── ports/
│   │   ├── adapters/
│   │   │   ├── kafka/
│   │   │   ├── opensearch/
│   │   │   └── postgres/
│   │   └── config/
│   ├── test/
│   │   ├── unit/
│   │   └── integration/
│   ├── Dockerfile
│   ├── go.mod
│   └── Makefile
│
├── event-processor/                # High-throughput event fan-out
│   ├── cmd/
│   ├── internal/
│   ├── test/
│   ├── Dockerfile
│   └── go.mod
│
├── media-transcoder/               # Video/image processing (future)
│   └── ...
│
└── README.md                       # Go service conventions and extraction playbook
```

### Go Service Conventions

| Convention | Standard |
|------------|----------|
| Layout | Standard Go project layout (`cmd/`, `internal/`) |
| Module path | `github.com/atlas-bos/{service-name}` |
| Config | Environment variables with `ATLAS_` prefix |
| Logging | Structured JSON to stdout (compatible with Loki) |
| Tracing | OpenTelemetry Go SDK |
| Tests | `go test ./...` with Testcontainers for integration |
| API | gRPC for internal; REST for external if needed |

---

## `infra/` — Infrastructure and Operations

```
infra/
├── terraform/                      # Cloud infrastructure (AWS primary)
│   ├── modules/                    # Reusable Terraform modules
│   │   ├── vpc/
│   │   ├── eks/
│   │   ├── rds/
│   │   ├── elasticache/
│   │   ├── msk/                    # Managed Kafka
│   │   └── s3/
│   ├── environments/
│   │   ├── dev/
│   │   ├── staging/
│   │   ├── production/
│   │   └── dr/                     # Disaster recovery region
│   └── README.md
│
├── kubernetes/                     # K8s manifests (Kustomize overlays)
│   ├── base/
│   │   ├── api/
│   │   ├── web/
│   │   ├── worker/
│   │   ├── gateway/
│   │   └── services/
│   ├── overlays/
│   │   ├── dev/
│   │   ├── staging/
│   │   └── production/
│   └── README.md
│
├── helm/                           # Helm charts for third-party dependencies
│   ├── kafka/
│   ├── opensearch/
│   └── opa/
│
├── docker/                         # Shared Dockerfiles and compose overrides
│   ├── postgres/
│   │   └── init/                   # Local dev seed scripts
│   └── opa/
│       └── policies/               # OPA Rego policy bundles
│
├── monitoring/                     # Grafana dashboards, alert rules
│   ├── dashboards/
│   └── alerts/
│
└── scripts/                        # Deployment and operational scripts
    ├── deploy.sh
    ├── rollback.sh
    └── db-migrate.sh
```

---

## `docs/` — Documentation

```
docs/
├── architecture/
│   ├── INDEX.md
│   ├── phase-1/                    # Architecture design documents (01–25)
│   └── phase-2/                    # Standards, strategies, PRD
├── adr/                            # Architecture Decision Records
│   ├── README.md
│   └── ADR-NNNN-*.md
├── standards/
│   ├── coding-standards.md
│   ├── naming-standards.md
│   └── git-strategy.md
├── database/                       # Phase 3 — schema documentation
├── api/                            # Phase 5 — API contracts
└── runbooks/                       # Operational runbooks
    ├── incident-response.md
    └── on-call.md
```

---

## `tools/` — Developer Tooling

```
tools/
├── codegen/
│   ├── openapi-generator/        # Generate TypeScript types from OpenAPI
│   ├── event-schema-generator/     # Generate event types from JSON Schema
│   └── module-scaffold/            # `pnpm create-module customer`
├── migration/
│   └── flyway-runner/              # Cross-module migration orchestration
├── lint/
│   └── dependency-cruiser/         # Module boundary enforcement config
└── ci/
    └── coverage-reporter/          # Aggregate coverage across packages
```

---

## Test Organization

### Test Placement Rules

| Test Type | Location | Naming | Runner |
|-----------|----------|--------|--------|
| **Unit** | Colocated with source (`*.spec.ts`, `*_test.go`) | `{name}.spec.ts` | Vitest / Jest / Go test |
| **Integration** | `test/integration/` within package | `{feature}.integration.spec.ts` | Vitest + Testcontainers |
| **Contract** | `test/contract/` within module | `{event}.contract.spec.ts` | Pact / schema validation |
| **E2E** | `apps/{app}/test/e2e/` | `{journey}.e2e.spec.ts` | Playwright |
| **Load** | `tools/load-tests/` | `{scenario}.k6.js` | k6 |
| **Security** | `tools/security/` | OWASP ZAP configs | CI pipeline |

### Test Directory Examples

```
# Unit test — colocated
packages/modules/customer/domain/aggregates/contact.spec.ts

# Integration test — module test tree
packages/modules/customer/test/integration/contact.repository.integration.spec.ts

# E2E test — app test tree
apps/web/test/e2e/customer/create-lead.e2e.spec.ts

# Cross-module integration — api app
apps/api/test/integration/quote-to-cash.integration.spec.ts
```

### Coverage Requirements

| Scope | Minimum Line Coverage |
|-------|----------------------|
| `domain/` | 90% |
| `application/` | 85% |
| `infrastructure/` | 75% |
| `presentation/` | 70% |
| `apps/` | 60% (wiring and config) |

---

## Configuration Files

### Environment Configuration

```
apps/api/
├── .env.example                    # Documented template (committed)
├── .env.local                      # Local overrides (gitignored)
└── src/config/
    ├── index.ts                    # Typed config loader
    ├── database.config.ts
    ├── kafka.config.ts
    └── app.config.ts
```

### Environment File Rules

| Rule | Description |
|------|-------------|
| **C1** | `.env.example` committed with all keys documented, no secrets |
| **C2** | `.env`, `.env.local`, `.env.*.local` always gitignored |
| **C3** | Production secrets via AWS Secrets Manager / K8s Secrets — never in repo |
| **C4** | All env vars prefixed with `ATLAS_` (see naming-standards.md) |

---

## Import Path Aliases

TypeScript path aliases configured in `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@atlas/shared-kernel": ["packages/shared-kernel/src"],
      "@atlas/shared-kernel/*": ["packages/shared-kernel/src/*"],
      "@atlas/platform": ["packages/platform/src"],
      "@atlas/platform/*": ["packages/platform/src/*"],
      "@atlas/ui": ["packages/ui/src"],
      "@atlas/ui/*": ["packages/ui/src/*"],
      "@atlas/contracts": ["packages/contracts/src"],
      "@atlas/module-customer": ["packages/modules/customer/module.ts"],
      "@atlas/module-ledger": ["packages/modules/ledger/module.ts"]
    }
  }
}
```

### Import Rules

| Rule | Description |
|------|-------------|
| **I1** | Always import via `@atlas/` aliases — no relative paths crossing package boundaries |
| **I2** | Relative imports allowed only within the same package |
| **I3** | Barrel exports (`index.ts`) used sparingly — prefer explicit `module.ts` facades |
| **I4** | `dependency-cruiser` CI check enforces allowed import graph |

---

## Adding a New Bounded Context Module

1. Run scaffold: `pnpm create-module {context-name}`
2. Register in `apps/api/src/app.module.ts`
3. Add PostgreSQL schema migration in `infrastructure/persistence/postgres/migrations/`
4. Register Kafka consumers in `apps/worker/src/consumers/`
5. Add REST routes in `apps/api` and GraphQL resolvers if needed
6. Create frontend feature folder in `apps/web/src/features/{context}/`
7. Update `CODEOWNERS` with team ownership
8. Add module to `dependency-cruiser` allowed graph
9. Document in Phase 3 database docs and Phase 5 API contracts

---

## Microservice Extraction Checklist

When extracting a module to a standalone service:

1. Module already has clean `module.ts` facade ✓
2. Module owns dedicated PostgreSQL schema ✓
3. All cross-module communication is via events (no in-process calls) ✓
4. REST/gRPC presentation layer is self-contained ✓
5. Create new entry in `services/` or standalone `apps/{module}-api/`
6. Update gateway routing rules
7. Migrate consumers to new consumer group
8. Run parallel deployment with traffic shadowing
9. Record extraction in ADR

---

## Validation

CI enforces folder structure compliance:

| Check | Tool | Failure Action |
|-------|------|----------------|
| Module boundary imports | `dependency-cruiser` | Block merge |
| No `any` types | `@typescript-eslint/no-explicit-any` | Block merge |
| Test coverage thresholds | Istanbul + Codecov | Block merge |
| Migration naming | Flyway validate | Block merge |
| Folder scaffold compliance | Custom lint script | Warn |

---

## Cross-References

| Document | Relationship |
|----------|--------------|
| [02-software-architecture.md](../phase-1/02-software-architecture.md) | Layered architecture and module boundaries |
| [03-infrastructure-architecture.md](../phase-1/03-infrastructure-architecture.md) | Deployment topology |
| [24-testing.md](../phase-1/24-testing.md) | Testing pyramid and quality gates |
| [coding-standards.md](../standards/coding-standards.md) | Code style within this structure |
| [naming-standards.md](../standards/naming-standards.md) | File and symbol naming |
| [ADR-0001](../../adr/ADR-0001-modular-monolith-first.md) | Modular monolith decision |
| [ADR-0004](../../adr/ADR-0004-typescript-primary-backend.md) | TypeScript backend decision |

---

*Document owner: Chief Software Architect · Review cadence: Quarterly or on structural change*