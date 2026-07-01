# Atlas Architecture Documentation Index

**Last Updated:** 2026-06-30  
**Current Phase:** Phase 1 — Complete Architecture

---

## Phase 1: Architecture Documents

### Core Architecture

| # | Document | Status |
|---|----------|--------|
| 01 | [Business Architecture](phase-1/01-business-architecture.md) | Complete |
| 02 | [Software Architecture](phase-1/02-software-architecture.md) | Complete |
| 03 | [Infrastructure Architecture](phase-1/03-infrastructure-architecture.md) | Complete |
| 04 | [AI Architecture](phase-1/04-ai-architecture.md) | Complete |

### Data & API Layer

| # | Document | Status |
|---|----------|--------|
| 05 | [Database Architecture](phase-1/05-database-architecture.md) | Complete |
| 06 | [API Architecture](phase-1/06-api-architecture.md) | Complete |

### Identity & Access

| # | Document | Status |
|---|----------|--------|
| 07 | [Authentication](phase-1/07-authentication.md) | Complete |
| 08 | [Authorization](phase-1/08-authorization.md) | Complete |

### Platform Services

| # | Document | Status |
|---|----------|--------|
| 09 | [Storage](phase-1/09-storage.md) | Complete |
| 10 | [Notifications](phase-1/10-notifications.md) | Complete |
| 11 | [Integrations](phase-1/11-integrations.md) | Complete |
| 12 | [Payments](phase-1/12-payments.md) | Complete |
| 13 | [Messaging](phase-1/13-messaging.md) | Complete |
| 14 | [Search](phase-1/14-search.md) | Complete |

### Automation & Intelligence

| # | Document | Status |
|---|----------|--------|
| 15 | [Workflow Engine](phase-1/15-workflow-engine.md) | Complete |
| 16 | [Automation Engine](phase-1/16-automation-engine.md) | Complete |
| 17 | [AI Agent System](phase-1/17-ai-agent-system.md) | Complete |
| 18 | [Memory System](phase-1/18-memory-system.md) | Complete |

### Operations

| # | Document | Status |
|---|----------|--------|
| 19 | [Monitoring](phase-1/19-monitoring.md) | Complete |
| 20 | [Logging](phase-1/20-logging.md) | Complete |
| 21 | [Security](phase-1/21-security.md) | Complete |
| 22 | [Deployment](phase-1/22-deployment.md) | Complete |
| 23 | [Scaling](phase-1/23-scaling.md) | Complete |
| 24 | [Testing](phase-1/24-testing.md) | Complete |
| 25 | [Disaster Recovery](phase-1/25-disaster-recovery.md) | Complete |

---

## Phase 2–5

| Phase | Location | Status |
|-------|----------|--------|
| Phase 2 — Documentation | `docs/architecture/phase-2/` | Complete |
| Phase 3 — Database Design | `docs/database/` + `prisma/` | Complete |
| Phase 4 — UI Specification | `docs/ui/` | Complete |
| Phase 5 — API Contracts | `docs/api/` | Complete |

---

## Cross-Cutting Concerns Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        Atlas Platform                           │
├─────────────┬─────────────┬─────────────┬───────────────────────┤
│   Identity  │   Business  │     AI      │      Operations       │
│  Auth/RBAC  │   Modules   │   Agents    │  Monitor/Log/Security │
├─────────────┴─────────────┴─────────────┴───────────────────────┤
│              Event Bus (Domain Events + Integration Events)      │
├─────────────────────────────────────────────────────────────────┤
│         API Gateway (REST + GraphQL + Webhooks + SSE)           │
├─────────────────────────────────────────────────────────────────┤
│    PostgreSQL  │  Redis  │  OpenSearch  │  S3  │  Vector DB     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Document Conventions

- All documents use semantic versioning in front matter.
- ADRs reference format: `ADR-NNNN`.
- Every architecture document includes: Purpose, Scope, Context, Design, Alternatives Considered, Consequences, Open Questions.