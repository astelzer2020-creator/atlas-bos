---
title: Architecture Decision Records
document_id: ATLAS-ADR-INDEX
version: 1.0.0
status: approved
last_updated: 2026-06-30
authors:
  - Atlas Architecture Team
---

# Architecture Decision Records (ADR)

## Purpose

Architecture Decision Records capture significant technical decisions made during Atlas BOS development. Each ADR documents the **context**, **decision**, and **consequences** so future engineers understand *why* choices were made — not just *what* was built.

## Status Definitions

| Status | Meaning |
|--------|---------|
| **Proposed** | Under discussion; not yet adopted |
| **Accepted** | Approved and in effect |
| **Deprecated** | No longer recommended; superseded by newer ADR |
| **Superseded** | Replaced by another ADR (link provided) |

## ADR Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-0001](./ADR-0001-modular-monolith-first.md) | Modular Monolith First | Accepted | 2026-06-30 |
| [ADR-0002](./ADR-0002-postgresql-primary-oltp.md) | PostgreSQL as Primary OLTP | Accepted | 2026-06-30 |
| [ADR-0003](./ADR-0003-event-driven-kafka.md) | Event-Driven Architecture with Kafka | Accepted | 2026-06-30 |
| [ADR-0004](./ADR-0004-typescript-primary-backend.md) | TypeScript as Primary Backend Language | Accepted | 2026-06-30 |
| [ADR-0005](./ADR-0005-rbac-abac-opa.md) | RBAC + ABAC Authorization with OPA | Accepted | 2026-06-30 |
| [ADR-0006](./ADR-0006-rest-graphql-hybrid.md) | REST + GraphQL Hybrid API | Accepted | 2026-06-30 |
| [ADR-0007](./ADR-0007-multi-tenant-rls.md) | Multi-Tenant Isolation with RLS | Accepted | 2026-06-30 |
| [ADR-0008](./ADR-0008-stripe-payments.md) | Stripe for Payment Processing | Accepted | 2026-06-30 |
| [ADR-0009](./ADR-0009-opensearch-search.md) | OpenSearch for Full-Text Search | Accepted | 2026-06-30 |
| [ADR-0010](./ADR-0010-ai-agent-architecture.md) | AI Agent Architecture | Accepted | 2026-06-30 |

## How to Create a New ADR

1. Copy the template below into `docs/adr/ADR-{NNNN}-{short-title}.md`
2. Use the next sequential number (currently ADR-0011)
3. Set status to `Proposed`
4. Open a PR with the ADR for architecture team review
5. After approval, update status to `Accepted` and add to this index
6. Reference the ADR in related architecture documents

### ADR Template

```markdown
# ADR-NNNN: Title

**Status:** Proposed | Accepted | Deprecated | Superseded by [ADR-XXXX](./ADR-XXXX-title.md)
**Date:** YYYY-MM-DD
**Deciders:** Names or teams
**Related:** Links to architecture docs, other ADRs

## Context

What is the issue or situation that motivates this decision?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

### Positive
- Benefit 1

### Negative
- Trade-off 1

### Neutral
- Follow-up action 1
```

## Decision Categories

| Category | ADRs |
|----------|------|
| **Architecture** | ADR-0001, ADR-0003, ADR-0010 |
| **Data** | ADR-0002, ADR-0007, ADR-0009 |
| **API & Integration** | ADR-0006, ADR-0008 |
| **Language & Runtime** | ADR-0004 |
| **Security** | ADR-0005, ADR-0007 |

## Cross-References

| Document | Relationship |
|----------|--------------|
| [02-software-architecture.md](../architecture/phase-1/02-software-architecture.md) | Implements ADR-0001, ADR-0003, ADR-0004 |
| [05-database-architecture.md](../architecture/phase-1/05-database-architecture.md) | Implements ADR-0002, ADR-0007 |
| [06-api-architecture.md](../architecture/phase-1/06-api-architecture.md) | Implements ADR-0006 |
| [08-authorization.md](../architecture/phase-1/08-authorization.md) | Implements ADR-0005 |
| [12-payments.md](../architecture/phase-1/12-payments.md) | Implements ADR-0008 |
| [14-search.md](../architecture/phase-1/14-search.md) | Implements ADR-0009 |
| [17-ai-agent-system.md](../architecture/phase-1/17-ai-agent-system.md) | Implements ADR-0010 |

---

*Document owner: Architecture Team · Review cadence: On new ADR creation*