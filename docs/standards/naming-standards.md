---
title: Naming Standards
document_id: ATLAS-STD-002
version: 1.0.0
status: approved
phase: 2
last_updated: 2026-06-30
authors:
  - Atlas Platform Engineering Team
related_documents:
  - ATLAS-ARCH-02
  - ATLAS-ARCH-05
  - ATLAS-ARCH-06
  - coding-standards.md
  - ../architecture/phase-2/06-folder-structure.md
tags:
  - naming
  - conventions
  - database
  - api
  - events
---

# Naming Standards

## Purpose

Define consistent naming conventions across all Atlas BOS artifacts — files, code symbols, database objects, API endpoints, events, environment variables, and Kubernetes resources. Consistent naming reduces cognitive load, enables tooling automation, and prevents integration errors.

## Scope

### In Scope

- Source files and directories
- TypeScript, Go, and SQL symbols
- Database tables, columns, indexes, constraints
- REST and GraphQL API endpoints
- Integration events and Kafka topics
- Environment variables and configuration keys
- Kubernetes resources and labels
- Git branches, tags, and commits (see [git-strategy.md](./git-strategy.md))

### Out of Scope

- Product marketing names and UI copy
- Customer-facing error message wording

---

## General Principles

| Principle | Rule |
|-----------|------|
| **English only** | All identifiers in English |
| **Descriptive** | Names reveal intent; avoid abbreviations except approved list |
| **Consistent** | Same concept = same name across layers (e.g., `tenant_id` everywhere) |
| **No Hungarian notation** | No type prefixes (`strName`, `iCount`) |
| **No single letters** | Except loop indices (`i`, `j`) and well-known (`T` for generic) |
| **Approved abbreviations** | `id`, `url`, `api`, `dto`, `acl`, `rls`, `org`, `auth`, `config`, `repo`, `msg`, `ctx` |

---

## Files and Directories

### Directory Naming

| Type | Convention | Example |
|------|------------|---------|
| Top-level directories | `kebab-case` | `shared-kernel`, `tenant-identity` |
| Layer directories | `kebab-case` (singular) | `domain`, `application`, `infrastructure` |
| Feature directories | `kebab-case` | `create-lead`, `contact-query` |
| Test directories | `__tests__` or `test/` | `test/integration/` |

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| TypeScript source | `kebab-case.ts` | `create-lead.handler.ts` |
| TypeScript test | `kebab-case.spec.ts` | `create-lead.handler.spec.ts` |
| TypeScript integration test | `kebab-case.integration.spec.ts` | `contact.repository.integration.spec.ts` |
| TypeScript contract test | `kebab-case.contract.spec.ts` | `lead-created.contract.spec.ts` |
| React component | `kebab-case.tsx` or `PascalCase.tsx` | `contact-form.tsx` |
| React hook | `use-kebab-case.ts` | `use-contact-list.ts` |
| Go source | `snake_case.go` | `contact_repository.go` |
| Go test | `snake_case_test.go` | `contact_repository_test.go` |
| SQL migration | `V{version}__{description}.sql` | `V001__create_contacts_table.sql` |
| OPA policy | `kebab-case.rego` | `tenant-isolation.rego` |
| Config | `kebab-case.config.ts` | `database.config.ts` |
| ADR | `ADR-{NNNN}-{kebab-case}.md` | `ADR-0001-modular-monolith-first.md` |
| Documentation | `kebab-case.md` or `NN-kebab-case.md` | `06-folder-structure.md` |

### File Suffix Conventions

| Suffix | Meaning | Example |
|--------|---------|---------|
| `.command.ts` | CQRS command object | `create-lead.command.ts` |
| `.handler.ts` | Command/query handler | `create-lead.handler.ts` |
| `.query.ts` | CQRS query object | `get-contact.query.ts` |
| `.controller.ts` | REST controller | `contact.controller.ts` |
| `.resolver.ts` | GraphQL resolver | `contact.resolver.ts` |
| `.repository.ts` | Repository interface | `contact.repository.ts` |
| `.repository.impl.ts` | Repository implementation | `contact.repository.impl.ts` |
| `.event.ts` | Domain or integration event | `lead-created.event.ts` |
| `.dto.ts` | Data transfer object | `contact.dto.ts` |
| `.mapper.ts` | DTO ↔ domain mapper | `contact.mapper.ts` |
| `.fixture.ts` | Test fixture/factory | `contact.fixture.ts` |
| `.policy.ts` | Authorization policy | `contact-read.policy.ts` |
| `.routes.ts` | Route registration | `contact.routes.ts` |
| `.module.ts` | Module facade | `module.ts` |
| `.config.ts` | Configuration | `database.config.ts` |
| `.spec.ts` | Unit test | `contact.spec.ts` |
| `.integration.spec.ts` | Integration test | `contact.integration.spec.ts` |
| `.e2e.spec.ts` | End-to-end test | `create-lead.e2e.spec.ts` |

---

## TypeScript Symbols

### Classes and Interfaces

| Type | Convention | Example |
|------|------------|---------|
| Class | `PascalCase` | `CreateLeadHandler`, `ContactRepository` |
| Interface | `PascalCase` (no `I` prefix) | `ContactRepository`, `EventPublisher` |
| Abstract class | `PascalCase` | `AtlasError`, `AggregateRoot` |
| Type alias | `PascalCase` | `ContactId`, `OrderStatus` |
| Enum-like const | `PascalCase` name, `SCREAMING_SNAKE` values | `LeadSource.Referral` |
| Generic type param | Single uppercase letter | `T`, `E`, `K`, `V` |

### Functions and Variables

| Type | Convention | Example |
|------|------------|---------|
| Function | `camelCase` | `createLead`, `mapContactToDto` |
| Method | `camelCase` | `confirm()`, `addLineItem()` |
| Variable | `camelCase` | `contactId`, `isActive` |
| Constant | `SCREAMING_SNAKE_CASE` | `MAX_RETRY_ATTEMPTS`, `DEFAULT_PAGE_SIZE` |
| Boolean | `is/has/can/should` prefix | `isActive`, `hasPermission`, `canConfirm` |
| Private field | `camelCase` (no underscore prefix) | `private readonly repository` |
| Callback | `on` + `PascalCase` or `handle` + noun | `onConfirm`, `handleSubmit` |

### Domain-Specific Naming

| Concept | Convention | Example |
|---------|------------|---------|
| Branded ID types | `{Entity}Id` | `ContactId`, `TenantId`, `OrderId` |
| Value objects | Descriptive noun | `Money`, `EmailAddress`, `DateRange` |
| Commands | `{Verb}{Noun}Command` | `CreateLeadCommand`, `ConfirmOrderCommand` |
| Queries | `{Get/List/Search}{Noun}Query` | `GetContactQuery`, `ListInvoicesQuery` |
| Handlers | `{Command/Query}Handler` | `CreateLeadHandler`, `GetContactHandler` |
| Events (domain) | `{Noun}{PastTenseVerb}Event` | `LeadCreatedEvent`, `OrderConfirmedEvent` |
| Events (integration) | `{context}.{aggregate}.{action}.v{N}` | `customer.lead.created.v1` |
| DTOs | `{Noun}Dto` | `ContactDto`, `InvoiceLineDto` |
| Errors | `{Reason}Error` | `ValidationError`, `NotFoundError` |
| Repositories | `{Entity}Repository` | `ContactRepository` |
| Services | `{Noun}Service` or `{Noun}{Verb}Service` | `ContactQueryService`, `PricingService` |
| Policies | `{resource}-{action}.policy.ts` | `contact-read.policy.ts` |
| Aggregates | Domain noun (singular) | `Contact`, `Order`, `Invoice` |

---

## Go Symbols

| Type | Convention | Example |
|------|------------|---------|
| Package | `lowercase` (single word) | `contact`, `indexer` |
| Exported type | `PascalCase` | `ContactRepository`, `IndexRequest` |
| Unexported type | `camelCase` | `contactRow`, `indexBuffer` |
| Exported function | `PascalCase` | `NewContactRepository`, `HandleEvent` |
| Unexported function | `camelCase` | `parseEvent`, `buildDocument` |
| Interface | `PascalCase` (+ `er` suffix for single method) | `Repository`, `EventHandler` |
| Constant | `PascalCase` (exported) or `camelCase` | `MaxBatchSize`, `defaultTimeout` |
| File | `snake_case.go` | `contact_repository.go` |

---

## Database Naming (PostgreSQL)

### Schema Naming

| Type | Convention | Example |
|------|------------|---------|
| Module schema | `{module_name}` (snake_case) | `customer`, `ledger`, `commercial` |
| Shared schema | `atlas_core` | Platform-wide tables (tenants, users) |
| Audit schema | `atlas_audit` | Immutable audit log tables |

### Table Naming

| Rule | Convention | Example |
|------|------------|---------|
| Tables | `snake_case`, plural noun | `contacts`, `invoices`, `order_line_items` |
| Junction tables | `{table1}_{table2}` (alphabetical) | `contacts_tags`, `roles_permissions` |
| Audit tables | `{table}_audit` or `{table}_history` | `contacts_audit`, `invoices_history` |
| Outbox tables | `{module}_outbox` | `customer_outbox`, `commercial_outbox` |
| Projection tables | `{entity}_projections` or `{entity}_read_model` | `contacts_read_model` |
| Lookup/enum tables | `{concept}_types` or `{concept}_statuses` | `order_statuses`, `currency_types` |

### Column Naming

| Type | Convention | Example |
|------|------------|---------|
| Primary key | `id` | `UUID PRIMARY KEY` |
| Foreign key | `{referenced_table_singular}_id` | `tenant_id`, `contact_id`, `organization_id` |
| Timestamps | `{action}_at` | `created_at`, `updated_at`, `deleted_at`, `confirmed_at` |
| Actor tracking | `{action}_by` | `created_by`, `updated_by`, `deleted_by` |
| Boolean | `is_{adjective}` or `has_{noun}` | `is_active`, `has_verified_email` |
| Count/amount | `{noun}_count` or `{noun}_amount` | `line_item_count`, `total_amount` |
| Version (optimistic lock) | `version` | `INTEGER NOT NULL DEFAULT 1` |
| Status | `status` | `TEXT NOT NULL` with CHECK constraint |
| JSON metadata | `metadata` or `{purpose}_data` | `metadata`, `settings_data` |
| External reference | `external_id` or `{provider}_id` | `external_id`, `stripe_customer_id` |

### Standard Columns (Required on Tenant-Scoped Tables)

Every tenant-scoped table must include:

```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
tenant_id   UUID NOT NULL REFERENCES atlas_core.tenants(id),
created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
deleted_at  TIMESTAMPTZ,                          -- soft delete
created_by  UUID,
updated_by  UUID,
version     INTEGER NOT NULL DEFAULT 1            -- optimistic concurrency
```

### Index Naming

| Type | Convention | Example |
|------|------------|---------|
| Standard index | `idx_{table}_{column(s)}` | `idx_contacts_tenant_id` |
| Unique index | `uq_{table}_{column(s)}` | `uq_contacts_tenant_email` |
| Partial index | `idx_{table}_{column(s)}_{condition}` | `idx_contacts_tenant_email_active` |
| Foreign key index | `idx_{table}_{fk_column}` | `idx_invoices_contact_id` |
| GIN/GiST index | `idx_{table}_{column}_{type}` | `idx_contacts_metadata_gin` |

### Constraint Naming

| Type | Convention | Example |
|------|------------|---------|
| Primary key | `{table}_pkey` | `contacts_pkey` |
| Foreign key | `fk_{table}_{referenced_table}` | `fk_contacts_tenant` |
| Unique | `uq_{table}_{column(s)}` | `uq_contacts_tenant_external_id` |
| Check | `chk_{table}_{description}` | `chk_orders_status_valid` |
| Not null | (inline, no name needed) | `NOT NULL` |

### Migration Naming

```
V{version}__{description}.sql

V001__create_contacts_table.sql
V002__add_contacts_email_index.sql
V003__create_contacts_audit_table.sql
```

| Rule | Description |
|------|-------------|
| Version | Zero-padded sequential integer per module schema |
| Separator | Double underscore `__` between version and description |
| Description | Snake_case, verb-first, describing the change |
| Forward-only | No `U` (undo) migrations; use expand-contract pattern |

---

## API Endpoint Naming (REST)

### URL Structure

```
https://api.atlas.example.com/v{version}/{resource}
```

| Rule | Convention | Example |
|------|------------|---------|
| Version | `/v1/`, `/v2/` in URL path | `/v1/contacts` |
| Resources | Plural `kebab-case` nouns | `/v1/contacts`, `/v1/order-line-items` |
| Resource ID | UUID or ULID in path | `/v1/contacts/01JABC...` |
| Sub-resources | Nested under parent | `/v1/contacts/01JABC.../activities` |
| Actions | POST to `/{action}` sub-path | `/v1/orders/01JABC.../confirm` |
| Bulk operations | `/{resource}/bulk` | `/v1/invoices/bulk` |
| Search | `/{resource}/search` (POST) | `/v1/contacts/search` |
| Metadata | `/v1/meta/{resource}` | `/v1/meta/permissions` |

### HTTP Method Conventions

| Method | Usage | Example |
|--------|-------|---------|
| `GET` | Read single or collection | `GET /v1/contacts`, `GET /v1/contacts/{id}` |
| `POST` | Create resource or action | `POST /v1/contacts`, `POST /v1/orders/{id}/confirm` |
| `PUT` | Full replace | `PUT /v1/contacts/{id}` |
| `PATCH` | Partial update | `PATCH /v1/contacts/{id}` |
| `DELETE` | Soft or hard delete | `DELETE /v1/contacts/{id}` |

### Query Parameters

| Type | Convention | Example |
|------|------------|---------|
| Pagination cursor | `cursor` | `?cursor=01JABC...` |
| Page size | `limit` | `?limit=25` (default 25, max 100) |
| Sorting | `sort` | `?sort=-created_at,name` (- prefix = DESC) |
| Filtering | Field name directly | `?status=active&email=john@example.com` |
| Field selection | `fields` | `?fields=id,name,email` |
| Include relations | `include` | `?include=activities,tags` |
| Search | `q` | `?q=john` |

### Request/Response Headers

| Header | Direction | Example |
|--------|-----------|---------|
| `Authorization` | Request | `Bearer {jwt}` |
| `X-Atlas-Tenant-Id` | Request (injected by gateway) | `550e8400-e29b-41d4-a716-446655440000` |
| `X-Atlas-Org-Id` | Request | `7c9e6679-7425-40de-944b-e07fc1f90ae7` |
| `X-Correlation-Id` | Request/Response | `01JABC...` |
| `Idempotency-Key` | Request (mutations) | `550e8400-e29b-41d4-a716-446655440000` |
| `X-Idempotent-Replayed` | Response | `true` |
| `X-Request-Id` | Response | `req_01JABC...` |
| `Content-Type` | Both | `application/json` |
| `Accept` | Request | `application/json` |
| `Atlas-Version` | Request (optional) | `2026-06-30` (date-based versioning) |

---

## GraphQL Naming

| Type | Convention | Example |
|------|------------|---------|
| Types | `PascalCase` singular | `Contact`, `Invoice`, `OrderLineItem` |
| Input types | `{Action}{Entity}Input` | `CreateContactInput`, `UpdateInvoiceInput` |
| Queries | `camelCase` | `contact`, `contacts`, `invoiceByNumber` |
| Mutations | `{verb}{Entity}` | `createContact`, `confirmOrder`, `deleteInvoice` |
| Fields | `camelCase` | `displayName`, `createdAt`, `lineItems` |
| Enums | `PascalCase` name, `SCREAMING_SNAKE` values | `OrderStatus.CONFIRMED` |
| Interfaces | `PascalCase` (+ `able` suffix) | `Node`, `Timestampable`, `TenantScoped` |
| Unions | `{Entity}Result` | `CreateContactResult` (success \| error) |

---

## Integration Events and Kafka

### Event Name Format

```
{context}.{aggregate}.{action}.v{major}
```

| Component | Convention | Example |
|-----------|------------|---------|
| Context | Module/bounded context name | `customer`, `commercial`, `ledger` |
| Aggregate | Domain aggregate (singular) | `lead`, `order`, `invoice` |
| Action | Past-tense verb | `created`, `confirmed`, `posted`, `cancelled` |
| Version | `v` + major version number | `v1`, `v2` |

### Examples

| Event Name | Publisher | Description |
|------------|-----------|-------------|
| `tenant.organization.created.v1` | Tenant & Identity | New organization provisioned |
| `customer.lead.created.v1` | Customer | New lead in CRM pipeline |
| `customer.contact.updated.v1` | Customer | Contact details changed |
| `commercial.order.confirmed.v1` | Commercial | Order confirmed by customer |
| `commercial.order.cancelled.v1` | Commercial | Order cancelled |
| `ledger.invoice.posted.v1` | Ledger | Invoice posted to accounting |
| `ledger.payment.received.v1` | Ledger | Payment recorded |
| `workforce.employee.hired.v1` | Workforce | New employee onboarded |
| `service.case.resolved.v1` | Service | Support case closed |
| `stock.inventory.reserved.v1` | Stock | Inventory reserved for order |

### Kafka Topic Naming

```
atlas.{event-name}

atlas.customer.lead.created.v1
atlas.commercial.order.confirmed.v1
atlas.ledger.invoice.posted.v1
```

| Rule | Description |
|------|-------------|
| Prefix | `atlas.` on all topics |
| Name | Matches event name exactly |
| Partitions | Partition key = `{tenantId}:{aggregateId}` |
| Consumer groups | `atlas-{module}-{handler-name}` |

### Consumer Group Naming

```
atlas-{module}-{handler-name}

atlas-ledger-commercial-order-handler
atlas-insight-contact-projection
atlas-orchestration-quote-to-cash-saga
```

### Event Payload Fields (Required)

```json
{
  "eventId": "01JABC...",
  "eventType": "customer.lead.created.v1",
  "occurredAt": "2026-06-30T14:32:01.123Z",
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "organizationId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "correlationId": "01JABC...",
  "causationId": "01JDEF...",
  "actor": {
    "type": "user",
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
  },
  "payload": { }
}
```

---

## Environment Variables

### Format

```
ATLAS_{SCOPE}_{NAME}
```

| Component | Convention | Example |
|-----------|------------|---------|
| Prefix | Always `ATLAS_` | — |
| Scope | Subsystem or service | `DB`, `KAFKA`, `REDIS`, `API`, `WEB` |
| Name | `SCREAMING_SNAKE_CASE` | `HOST`, `PORT`, `MAX_CONNECTIONS` |

### Standard Environment Variables

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `ATLAS_ENV` | Environment name | `development`, `staging`, `production` |
| `ATLAS_LOG_LEVEL` | Logging verbosity | `debug`, `info`, `warn`, `error` |
| `ATLAS_DB_HOST` | PostgreSQL host | `localhost` |
| `ATLAS_DB_PORT` | PostgreSQL port | `5432` |
| `ATLAS_DB_NAME` | Database name | `atlas` |
| `ATLAS_DB_USER` | Database user | `atlas_app` |
| `ATLAS_DB_PASSWORD` | Database password (secret) | — |
| `ATLAS_DB_POOL_MIN` | Connection pool minimum | `2` |
| `ATLAS_DB_POOL_MAX` | Connection pool maximum | `20` |
| `ATLAS_REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `ATLAS_KAFKA_BROKERS` | Kafka broker list | `localhost:9092` |
| `ATLAS_OPENSEARCH_URL` | OpenSearch endpoint | `http://localhost:9200` |
| `ATLAS_JWT_SECRET` | JWT signing secret (secret) | — |
| `ATLAS_JWT_ISSUER` | JWT issuer URL | `https://auth.atlas.example.com` |
| `ATLAS_OPA_URL` | OPA policy engine URL | `http://localhost:8181` |
| `ATLAS_STRIPE_SECRET_KEY` | Stripe API key (secret) | — |
| `ATLAS_STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | — |
| `ATLAS_S3_BUCKET` | Default S3 bucket | `atlas-uploads-dev` |
| `ATLAS_API_PORT` | API server port | `3000` |
| `ATLAS_GATEWAY_PORT` | Gateway port | `8080` |
| `ATLAS_WEB_PORT` | Next.js port | `3001` |
| `ATLAS_OTEL_ENDPOINT` | OpenTelemetry collector | `http://localhost:4317` |
| `ATLAS_CORRELATION_HEADER` | Correlation ID header name | `X-Correlation-Id` |

### Environment Variable Rules

| Rule | Description |
|------|-------------|
| **E1** | All env vars prefixed with `ATLAS_` |
| **E2** | Secrets never committed — use secrets manager in production |
| **E3** | Every env var documented in `.env.example` |
| **E4** | Typed config loader validates at startup — fail fast on missing required vars |
| **E5** | Boolean env vars: `true`/`false` strings (not `1`/`0`) |

---

## Kubernetes Resources

### Resource Naming

```
atlas-{service}-{component}

atlas-api
atlas-web
atlas-worker
atlas-gateway
atlas-search-indexer
atlas-event-processor
```

### Labels

| Label | Convention | Example |
|-------|------------|---------|
| `app.kubernetes.io/name` | Service name | `atlas-api` |
| `app.kubernetes.io/component` | Component type | `api`, `worker`, `gateway` |
| `app.kubernetes.io/part-of` | Platform identifier | `atlas-bos` |
| `app.kubernetes.io/version` | Semver | `1.2.3` |
| `atlas.io/team` | Owning team | `customer`, `ledger`, `platform` |
| `atlas.io/module` | Bounded context | `customer`, `commercial` |
| `atlas.io/tier` | Resource tier | `critical`, `standard`, `background` |

### ConfigMaps and Secrets

| Type | Convention | Example |
|------|------------|---------|
| ConfigMap | `atlas-{service}-config` | `atlas-api-config` |
| Secret | `atlas-{service}-secrets` | `atlas-api-secrets` |
| TLS Secret | `atlas-{domain}-tls` | `atlas-api-tls` |

### Namespaces

| Namespace | Purpose |
|-----------|---------|
| `atlas-system` | Platform services (gateway, OPA, monitoring) |
| `atlas-apps` | Application workloads (api, web, worker) |
| `atlas-services` | Extracted Go services |
| `atlas-data` | Data infrastructure (if self-hosted) |
| `atlas-staging` | Staging environment overlay |

---

## Permission and Scope Naming

### RBAC Permission Format

```
{resource}:{action}

contacts:read
contacts:write
contacts:delete
invoices:read
invoices:write
invoices:approve
orders:confirm
settings:manage
```

### OAuth Scopes

```
{resource}:{action}          (mirrors RBAC permissions)
openid                       (OIDC standard)
profile                      (OIDC standard)
offline_access               (refresh tokens)
```

### OPA Policy Package Naming

```
atlas.authz.{module}.{resource}

atlas.authz.customer.contacts
atlas.authz.ledger.invoices
atlas.authz.platform.admin
```

---

## Metrics and Observability Naming

### Prometheus Metrics

```
atlas_{subsystem}_{metric_name}_{unit}

atlas_api_http_requests_total
atlas_api_http_request_duration_seconds
atlas_db_query_duration_seconds
atlas_kafka_messages_published_total
atlas_kafka_consumer_lag_seconds
```

### OpenTelemetry Span Names

```
{module}.{operation}

customer.CreateLead
ledger.PostInvoice
commercial.ConfirmOrder
platform.AuthorizeRequest
```

### Log Operation Names

```
{module}.{operation}

customer.createLead
ledger.postInvoice
gateway.authenticate
worker.processOutbox
```

---

## Quick Reference Card

| Artifact | Convention | Example |
|----------|------------|---------|
| Directory | `kebab-case` | `tenant-identity` |
| TypeScript file | `kebab-case.ts` | `create-lead.handler.ts` |
| TypeScript class | `PascalCase` | `CreateLeadHandler` |
| TypeScript function | `camelCase` | `createLead` |
| TypeScript constant | `SCREAMING_SNAKE` | `MAX_RETRY_ATTEMPTS` |
| Go file | `snake_case.go` | `contact_repository.go` |
| DB table | `snake_case` plural | `order_line_items` |
| DB column | `snake_case` | `tenant_id`, `created_at` |
| DB index | `idx_{table}_{cols}` | `idx_contacts_tenant_id` |
| REST endpoint | `/v1/{kebab-resources}` | `/v1/order-line-items` |
| Event | `{ctx}.{agg}.{action}.v{N}` | `customer.lead.created.v1` |
| Kafka topic | `atlas.{event-name}` | `atlas.customer.lead.created.v1` |
| Env var | `ATLAS_{SCOPE}_{NAME}` | `ATLAS_DB_HOST` |
| K8s resource | `atlas-{service}` | `atlas-api` |
| Permission | `{resource}:{action}` | `contacts:write` |
| Metric | `atlas_{subsys}_{name}_{unit}` | `atlas_api_http_requests_total` |

---

## Cross-References

| Document | Relationship |
|----------|--------------|
| [06-folder-structure.md](../architecture/phase-2/06-folder-structure.md) | File placement |
| [coding-standards.md](./coding-standards.md) | Code style using these names |
| [05-database-architecture.md](../architecture/phase-1/05-database-architecture.md) | Database conventions detail |
| [06-api-architecture.md](../architecture/phase-1/06-api-architecture.md) | API conventions detail |
| [13-messaging.md](../architecture/phase-1/13-messaging.md) | Event naming detail |

---

*Document owner: Principal Engineering · Review cadence: Quarterly*