# Atlas Database Documentation

**Phase:** 3 — Complete  
**Last Updated:** 2026-06-30

## Overview

Atlas uses **PostgreSQL 16+** with **17 PostgreSQL schemas** spanning platform core, business domains, AI, and platform services.

### Cross-Cutting Patterns

| Pattern | Implementation |
|---------|----------------|
| Multi-tenant isolation | `organization_id` on every tenant table + RLS (`app.organization_id`) |
| Soft delete | `deleted_at TIMESTAMPTZ` + partial unique indexes |
| Audit | `created_at`, `updated_at`, `created_by_id`, `updated_by_id`, `version` |
| Optimistic locking | `version INTEGER` incremented on every update |
| Temporal history | `atlas_audit.entity_versions` + audit log |
| Events | `atlas_audit.event_outbox` (transactional outbox) |
| Money | `BIGINT` cents (application layer); some DDL uses `NUMERIC(19,4)` — normalize in migration V0002 |
| Embeddings | `pgvector vector(3072)` in `ai_memory.memory_embeddings` |

See [00-conventions.md](00-conventions.md) and [05-database-architecture.md](../architecture/phase-1/05-database-architecture.md).

---

## Phase 3 Deliverables

| # | Document | Domain | Status |
|---|----------|--------|--------|
| 00 | [00-conventions.md](00-conventions.md) | Standards | Complete |
| 01 | [01-erd-overview.md](01-erd-overview.md) | Full platform ERD | Complete |
| 02 | [02-platform-core.md](02-platform-core.md) | Organizations, workspaces, teams | Complete |
| 03 | [03-identity-auth.md](03-identity-auth.md) | Users, sessions, MFA, SSO | Complete |
| 04 | [04-authorization.md](04-authorization.md) | Roles, permissions, policies | Complete |
| 05 | [05-crm.md](05-crm.md) | CRM | Complete |
| 06 | [06-erp.md](06-erp.md) | ERP, inventory, orders | Complete |
| 07 | [07-finance.md](07-finance.md) | Finance, GL, invoices | Complete |
| 08 | [08-hr.md](08-hr.md) | HR, workforce | Complete |
| 09 | [09-projects.md](09-projects.md) | Project management | Complete |
| 10 | [10-marketing.md](10-marketing.md) | Marketing | Complete |
| 11 | [11-ai-memory.md](11-ai-memory.md) | AI memory | Complete |
| 12 | [12-ai-agents.md](12-ai-agents.md) | AI agents | Complete |
| 13 | [13-knowledge-base.md](13-knowledge-base.md) | Knowledge base | Complete |
| 14 | [14-automation.md](14-automation.md) | Automation & workflows | Complete |
| 15 | [15-marketplace.md](15-marketplace.md) | Marketplace | Complete |
| 16 | [16-billing-subscription.md](16-billing-subscription.md) | Billing & subscriptions | Complete |
| 17 | [17-notifications.md](17-notifications.md) | Notifications | Complete |
| 18 | [18-documents-storage.md](18-documents-storage.md) | Documents & storage | Complete |
| 19 | [19-analytics.md](19-analytics.md) | Analytics | Complete |
| 20 | [20-audit-events.md](20-audit-events.md) | Audit, events, outbox | Complete |
| 99 | [99-migration-strategy.md](99-migration-strategy.md) | Migrations | Complete |

---

## PostgreSQL Schema Map

```
atlas_core      → Platform, identity, authorization
customer        → CRM (contacts, accounts, deals)
stock           → ERP inventory (products, warehouses, stock)
commercial      → ERP orders (PO, SO, suppliers)
ledger          → Finance (GL, invoices, payments)
workforce       → HR (employees, time off)
projects        → Project management
marketing       → Campaigns, segments
knowledge_base  → KB articles, spaces
automation      → Rules, workflows
ai_memory       → Memory chunks, embeddings, sessions
ai_agents       → Agent runs, tools, approvals
marketplace     → App store
billing         → Subscriptions, usage
notifications   → Notification delivery
storage         → Files, folders
analytics       → Dashboards, metrics
atlas_audit     → Audit log, outbox, temporal versions
```

---

## Prisma Models

| File | PostgreSQL Schema(s) | Model Count |
|------|---------------------|-------------|
| [platform.prisma](../../prisma/models/platform.prisma) | `atlas_core` | 23 |
| [crm.prisma](../../prisma/models/crm.prisma) | `customer` | 9 |
| [erp.prisma](../../prisma/models/erp.prisma) | `stock`, `commercial` | 11 |
| [finance.prisma](../../prisma/models/finance.prisma) | `ledger` | 11 |
| [hr.prisma](../../prisma/models/hr.prisma) | `workforce` | 8 |
| [projects.prisma](../../prisma/models/projects.prisma) | `projects` | 8 |
| [marketing.prisma](../../prisma/models/marketing.prisma) | `marketing` | 8 |
| [ai.prisma](../../prisma/models/ai.prisma) | `ai_memory`, `ai_agents` | 14 |
| [knowledge-base.prisma](../../prisma/models/knowledge-base.prisma) | `knowledge_base` | 6 |
| [automation.prisma](../../prisma/models/automation.prisma) | `automation` | 7 |
| [marketplace.prisma](../../prisma/models/marketplace.prisma) | `marketplace` | 7 |
| [billing.prisma](../../prisma/models/billing.prisma) | `billing` | 10 |
| [notifications.prisma](../../prisma/models/notifications.prisma) | `notifications` | 6 |
| [documents.prisma](../../prisma/models/documents.prisma) | `storage` | 7 |
| [analytics.prisma](../../prisma/models/analytics.prisma) | `analytics` | 7 |
| [audit.prisma](../../prisma/models/audit.prisma) | `atlas_audit` | 5 |

**Total:** 133 Prisma models across 17 schemas. Root config: [schema.prisma](../../prisma/schema.prisma).

---

## Entity Documentation Standard

Every entity document includes:

1. Bounded context and DDD aggregate boundaries
2. Business rules and invariants
3. Full PostgreSQL DDL with constraints
4. ER diagrams (mermaid)
5. Indexes with rationale
6. RLS policies
7. Soft delete and audit strategy
8. Flyway migration notes