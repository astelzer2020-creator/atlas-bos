# Atlas API Documentation

**Phase:** 5 — Complete  
**Last Updated:** 2026-06-30

## API Surfaces

| Surface | Use Case | Location |
|---------|----------|----------|
| **REST** | CRUD, integrations, webhooks | [`openapi/`](openapi/) (19 specs) |
| **GraphQL** | Composite UI reads, mutations | [`graphql/schema.graphql`](graphql/schema.graphql) |
| **Events** | Async integration (Kafka) | [`events/catalog.md`](events/catalog.md) |
| **Webhooks** | Outbound customer notifications | [`webhooks/catalog.md`](webhooks/catalog.md) |
| **Background Jobs** | Async processing | [`queues/background-jobs.md`](queues/background-jobs.md) |
| **Internal** | Service-to-service | [`internal/README.md`](internal/README.md) |

## Quick Start

1. Read [00-conventions.md](00-conventions.md) for headers, pagination, errors, idempotency
2. Authenticate via [openapi/auth.yaml](openapi/auth.yaml)
3. Scope requests to `/v1/organizations/{organizationId}/...`
4. Subscribe to events via [webhooks/catalog.md](webhooks/catalog.md)

## Conventions

- **Base URL:** `https://api.atlas.example.com/v1`
- **Versioning:** URL path + `Atlas-Version` header
- **Auth:** `Authorization: Bearer <jwt>` or `Authorization: Atlas-Key <key>`
- **Tenant:** `Atlas-Organization-Id` header (or JWT claim `org_id`)
- **Idempotency:** `Idempotency-Key` on POST/PATCH/DELETE
- **Pagination:** `?cursor=<token>&limit=50`
- **Errors:** RFC 7807 (`application/problem+json`)
- **Money:** Integer cents + ISO 4217 currency code

## OpenAPI Specifications

| Spec | Module |
|------|--------|
| [auth.yaml](openapi/auth.yaml) | Authentication & OAuth |
| [platform.yaml](openapi/platform.yaml) | Organizations, workspaces, teams |
| [crm.yaml](openapi/crm.yaml) | CRM |
| [erp.yaml](openapi/erp.yaml) | ERP & inventory |
| [finance.yaml](openapi/finance.yaml) | Finance & accounting |
| [hr.yaml](openapi/hr.yaml) | HR |
| [projects.yaml](openapi/projects.yaml) | Project management |
| [marketing.yaml](openapi/marketing.yaml) | Marketing |
| [ai.yaml](openapi/ai.yaml) | AI agents & memory |
| [automation.yaml](openapi/automation.yaml) | Automation & workflows |
| [billing.yaml](openapi/billing.yaml) | Billing & subscriptions |
| [documents.yaml](openapi/documents.yaml) | Documents & storage |
| [notifications.yaml](openapi/notifications.yaml) | Notifications |
| [marketplace.yaml](openapi/marketplace.yaml) | App marketplace |
| [messaging.yaml](openapi/messaging.yaml) | Messaging |
| [support.yaml](openapi/support.yaml) | Customer support |
| [integrations.yaml](openapi/integrations.yaml) | Third-party integrations |
| [knowledge-base.yaml](openapi/knowledge-base.yaml) | Knowledge base |
| [analytics.yaml](openapi/analytics.yaml) | Analytics & reporting |

## Rate Limits

| Tier | Requests/min | Burst |
|------|-------------|-------|
| Free | 60 | 100 |
| Starter | 300 | 500 |
| Growth | 1,000 | 2,000 |
| Business | 5,000 | 10,000 |
| Enterprise | Custom | Custom |

## Architecture Reference

[06-api-architecture.md](../architecture/phase-1/06-api-architecture.md)