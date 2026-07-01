# Phase 5 — API Contracts Index

**Status:** Complete  
**Last Updated:** 2026-06-30

## Summary

| Metric | Count |
|--------|-------|
| Convention documents | 1 |
| OpenAPI 3.1 specifications | 19 |
| REST operations (approx.) | 350+ |
| GraphQL types | 130+ |
| GraphQL queries | 63 |
| GraphQL mutations | 38 |
| GraphQL subscriptions | 12 |
| Domain events (CloudEvents) | 108 |
| Webhook event types | 58 |
| Background jobs | 46 |

## Deliverables

All documentation: [`docs/api/`](../../api/)

### REST — OpenAPI 3.1

| Spec | Module | Operations |
|------|--------|------------|
| [00-conventions.md](../../api/00-conventions.md) | Cross-cutting | — |
| [openapi/auth.yaml](../../api/openapi/auth.yaml) | Authentication | 12 |
| [openapi/platform.yaml](../../api/openapi/platform.yaml) | Platform core | 23 |
| [openapi/crm.yaml](../../api/openapi/crm.yaml) | CRM | 33 |
| [openapi/erp.yaml](../../api/openapi/erp.yaml) | ERP | 37 |
| [openapi/finance.yaml](../../api/openapi/finance.yaml) | Finance | 35 |
| [openapi/hr.yaml](../../api/openapi/hr.yaml) | HR | 28 |
| [openapi/projects.yaml](../../api/openapi/projects.yaml) | Projects | 26 |
| [openapi/marketing.yaml](../../api/openapi/marketing.yaml) | Marketing | 25 |
| [openapi/ai.yaml](../../api/openapi/ai.yaml) | AI | 23 |
| [openapi/automation.yaml](../../api/openapi/automation.yaml) | Automation | 21 |
| [openapi/billing.yaml](../../api/openapi/billing.yaml) | Billing | 17 |
| [openapi/documents.yaml](../../api/openapi/documents.yaml) | Documents | 17 |
| [openapi/notifications.yaml](../../api/openapi/notifications.yaml) | Notifications | 14 |
| [openapi/marketplace.yaml](../../api/openapi/marketplace.yaml) | Marketplace | 13 |
| [openapi/messaging.yaml](../../api/openapi/messaging.yaml) | Messaging | 18 |
| [openapi/support.yaml](../../api/openapi/support.yaml) | Support | 17 |
| [openapi/integrations.yaml](../../api/openapi/integrations.yaml) | Integrations | 22 |
| [openapi/knowledge-base.yaml](../../api/openapi/knowledge-base.yaml) | Knowledge Base | 15 |
| [openapi/analytics.yaml](../../api/openapi/analytics.yaml) | Analytics | 16 |

### GraphQL

| Document | Description |
|----------|-------------|
| [graphql/schema.graphql](../../api/graphql/schema.graphql) | Full federated schema (types, queries, mutations, subscriptions) |
| [graphql/README.md](../../api/graphql/README.md) | Conventions, DataLoader, complexity limits, auth |

### Async

| Document | Description |
|----------|-------------|
| [events/catalog.md](../../api/events/catalog.md) | 108 domain events (CloudEvents 1.0) |
| [webhooks/catalog.md](../../api/webhooks/catalog.md) | 58 outbound webhook types + HMAC verification |
| [queues/background-jobs.md](../../api/queues/background-jobs.md) | 46 background jobs across 8 queues |

### Internal

| Document | Description |
|----------|-------------|
| [internal/README.md](../../api/internal/README.md) | gRPC/REST service catalog, mTLS, Kafka topics |

## Conventions

- **Base URL:** `https://api.atlas.example.com/v1`
- **Tenant scope:** `/v1/organizations/{organizationId}/...`
- **Auth:** Bearer JWT or `Atlas-Key` API key
- **Errors:** RFC 7807 Problem Details
- **Pagination:** Cursor-based
- **Mutations:** `Idempotency-Key` header required

## Phase 6 Gate

All Phases 1–5 are complete. Implementation may begin per MASTER_INSTRUCTIONS.

Recommended first implementation PRs:
1. Platform monorepo scaffold (`06-folder-structure.md`)
2. Database migrations (Flyway V0001 platform core)
3. Auth service + platform REST endpoints
4. Next.js app shell (`01-navigation-layout.md`)