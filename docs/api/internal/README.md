---
title: Internal Service APIs
document_id: ATLAS-API-INTERNAL
version: 1.0.0
status: approved
phase: 5
last_updated: 2026-06-30
authors:
  - Atlas Platform Engineering Team
related_documents:
  - ../00-conventions.md
  - ../../architecture/phase-1/02-software-architecture.md
  - ../../architecture/phase-1/06-api-architecture.md
  - ../../architecture/phase-1/07-authentication.md
  - ../../standards/naming-standards.md
tags:
  - internal-api
  - grpc
  - mtls
  - event-bus
---

# Internal Service APIs

## Purpose

Document the **service-to-service** API surface for Atlas BOS module communication. Internal APIs are never exposed through the public API gateway and are accessible only within the service mesh (VPC / Kubernetes cluster).

## Network Boundary

```
Internet ──▶ Public ALB ──▶ Kong Gateway ──▶ Public REST (/v1/*)
VPC internal ──▶ Internal ALB ──▶ Service Mesh (Istio/Linkerd) ──▶ Internal APIs (/internal/v1/*)
```

| Class | Prefix | Auth | Exposure |
|-------|--------|------|----------|
| Public REST | `/v1/` | OAuth2 / API key / session JWT | Internet |
| **Internal REST** | `/internal/v1/` | mTLS + service JWT | Service mesh only |
| **Internal gRPC** | `{service}.atlas.svc:50051` | mTLS + service JWT | Service mesh only |
| Admin | `/admin/v1/` | Platform admin SSO + IP allowlist | VPN |
| Agent | `/agent/v1/` | Service account + scoped | Internal |

Internal APIs have **looser versioning** (coordinated deploys) but maintain contract tests in CI.

---

## Authentication (mTLS + Service JWT)

All internal calls require **mutual TLS** at the transport layer and a **service JWT** in the `Authorization` header.

### mTLS Configuration

| Setting | Value |
|---------|-------|
| CA | Atlas internal PKI (cert-manager) |
| Certificate rotation | 90 days |
| Cipher suites | TLS 1.3 only |
| Client cert verification | Required (mesh enforces) |
| SPIFFE ID format | `spiffe://atlas.internal/ns/{namespace}/sa/{service-account}` |

### Service JWT Claims

```json
{
  "sub": "svc://tenant-identity",
  "iss": "https://auth.internal.atlas.svc",
  "aud": "https://internal.atlas.svc",
  "svc": "tenant-identity",
  "ver": "1",
  "iat": 1719753600,
  "exp": 1719753660
}
```

| Claim | Description |
|-------|-------------|
| `sub` | Service URI identifier |
| `svc` | Calling service name |
| `aud` | Internal API audience |
| `exp` | 60-second TTL (short-lived, per-request or per-batch) |

### Request Headers (Internal)

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer {service_jwt}` |
| `X-Request-Id` | Yes | Correlation ID propagated from originating request |
| `X-Atlas-Organization-Id` | Conditional | Tenant context for org-scoped operations |
| `X-Atlas-Actor-Type` | Yes | `user`, `service_account`, `agent`, `system` |
| `X-Atlas-Actor-Id` | Conditional | Original actor UUID (for audit trail) |
| `X-Atlas-Causation-Id` | Optional | Event or request that caused this call |
| `X-Atlas-Idempotency-Key` | POST | Same semantics as public API |

### Service Identity Registry

| Service | SPIFFE ID | JWT `sub` |
|---------|-----------|-----------|
| `tenant-identity` | `spiffe://atlas.internal/ns/platform/sa/tenant-identity` | `svc://tenant-identity` |
| `authorization` | `spiffe://atlas.internal/ns/platform/sa/authorization` | `svc://authorization` |
| `customer` | `spiffe://atlas.internal/ns/crm/sa/customer` | `svc://customer` |
| `ledger` | `spiffe://atlas.internal/ns/finance/sa/ledger` | `svc://ledger` |
| `communication` | `spiffe://atlas.internal/ns/messaging/sa/communication` | `svc://communication` |
| `insight` | `spiffe://atlas.internal/ns/analytics/sa/insight` | `svc://insight` |
| `orchestration` | `spiffe://atlas.internal/ns/automation/sa/orchestration` | `svc://orchestration` |
| `intelligence` | `spiffe://atlas.internal/ns/ai/sa/intelligence` | `svc://intelligence` |
| `notification` | `spiffe://atlas.internal/ns/platform/sa/notification` | `svc://notification` |
| `search-indexer` | `spiffe://atlas.internal/ns/search/sa/search-indexer` | `svc://search-indexer` |

---

## Protocol Selection

| Protocol | Use Case | Serialization |
|----------|----------|---------------|
| **gRPC** | Hot-path service-to-service (Go extractees, high throughput) | Protobuf |
| **Internal REST** | TypeScript module calls, debugging, admin tooling | JSON |
| **Event bus** | Async integration, cross-module reactions | CloudEvents 1.0 / Avro |

```
┌─────────────┐  gRPC (sync)   ┌─────────────┐
│   Ledger    │◀──────────────▶│  Customer   │
└──────┬──────┘                └──────┬──────┘
       │                              │
       │         Kafka (async)        │
       └──────────────┬───────────────┘
                      ▼
              ┌───────────────┐
              │ Insight, etc. │
              └───────────────┘
```

---

## Service Catalog

### Platform Services

#### `tenant-identity` (Tenant & Identity)

| Method | Endpoint / RPC | Description |
|--------|----------------|-------------|
| gRPC | `ResolveMembership` | Validate user membership in organization |
| gRPC | `GetOrganization` | Fetch organization metadata by ID |
| gRPC | `ProvisionOrganization` | Internal provisioning (post-signup pipeline) |
| REST | `GET /internal/v1/organizations/{id}` | Organization lookup |
| REST | `GET /internal/v1/users/{id}` | User lookup (sanitized) |
| REST | `POST /internal/v1/sessions/validate` | Validate session token |

**Consumers:** All modules (tenant context resolution), gateway, authorization.

#### `authorization` (Authorization / OPA)

| Method | Endpoint / RPC | Description |
|--------|----------------|-------------|
| gRPC | `CheckPermission` | Single permission check (ALLOW/DENY + reason) |
| gRPC | `BatchCheckPermissions` | Bulk check for UI permission matrix |
| gRPC | `ResolveEffectivePermissions` | Effective permissions for principal at scope |
| REST | `POST /internal/v1/authz/check` | HTTP wrapper for CheckPermission |
| REST | `POST /internal/v1/authz/invalidate-cache` | Cache bust on policy update |

**Consumers:** All modules, API gateway, AI agent runtime.

#### `notification` (Notifications)

| Method | Endpoint / RPC | Description |
|--------|----------------|-------------|
| gRPC | `SendNotification` | Dispatch email/push/in-app notification |
| gRPC | `SendTemplatedNotification` | Template-based delivery |
| REST | `POST /internal/v1/notifications/send` | HTTP dispatch endpoint |

**Consumers:** Tenant-identity (invitations), ledger (invoice sent), service (case updates).

#### `search-indexer` (Search — Go)

| Method | Endpoint / RPC | Description |
|--------|----------------|-------------|
| gRPC | `IndexDocument` | Upsert document in OpenSearch |
| gRPC | `DeleteDocument` | Remove from index |
| gRPC | `BulkIndex` | Batch indexing |
| REST | `POST /internal/v1/search/reindex` | Trigger full reindex job |

**Consumers:** All modules via event consumers; direct calls for urgent index updates.

---

### Domain Module Services

#### `customer` (CRM)

| gRPC RPC | Description |
|----------|-------------|
| `GetContact` | Fetch contact by ID |
| `GetContactByEmail` | Lookup contact within organization |
| `ListContacts` | Paginated internal list (no UI envelope) |
| `UpsertContact` | Idempotent contact create/update |

**REST:** `GET /internal/v1/contacts/{id}`, `POST /internal/v1/contacts/upsert`

**Consumers:** Communication (entity linking), commercial (deal association), intelligence (AI context).

#### `ledger` (Finance)

| gRPC RPC | Description |
|----------|-------------|
| `GetInvoice` | Fetch invoice |
| `CreateInvoiceFromOrder` | Saga step — commercial → ledger |
| `PostPayment` | Record payment against invoice |
| `GetAccountBalance` | Chart of accounts balance query |

**REST:** `POST /internal/v1/invoices/from-order`

**Consumers:** Commercial, orchestration (quote-to-cash saga), insight.

#### `communication` (Messaging)

| gRPC RPC | Description |
|----------|-------------|
| `SendMessage` | Send message to conversation |
| `GetConversation` | Fetch conversation metadata |
| `LinkEntity` | Attach conversation to CRM entity |
| `PublishPresence` | Update user presence state |

**REST:** `POST /internal/v1/messages/send`

**Consumers:** Service (case threads), orchestration (workflow notifications), intelligence.

#### `insight` (Analytics)

| gRPC RPC | Description |
|----------|-------------|
| `RecordMetric` | Ingest metric data point |
| `GetDashboardData` | Internal dashboard query (no authz — caller responsible) |
| `RunReport` | Execute parameterized report |

**Consumers:** All modules (event projections), intelligence (AI analytics).

#### `orchestration` (Automation / Workflows)

| gRPC RPC | Description |
|----------|-------------|
| `StartWorkflow` | Trigger workflow instance |
| `SignalWorkflow` | Send signal to running workflow |
| `GetWorkflowStatus` | Poll workflow state |

**REST:** `POST /internal/v1/workflows/start`

**Consumers:** All modules (event-triggered automation), intelligence (AI actions).

#### `intelligence` (AI)

| gRPC RPC | Description |
|----------|-------------|
| `ExecuteTool` | Run AI agent tool against module API |
| `EmbedText` | Generate embedding vector |
| `RetrieveContext` | RAG context retrieval |
| `RunInference` | LLM inference (streaming via server-side stream) |

**REST:** `POST /internal/v1/ai/tools/execute`

**Consumers:** Web app (via gateway proxy), orchestration (AI-powered workflows).

---

## Internal REST Conventions

Internal REST follows public conventions with these differences:

| Aspect | Public API | Internal API |
|--------|------------|--------------|
| Response envelope | `{ data, meta, pagination }` | Flat JSON or protobuf-equivalent (no `object` discriminator) |
| Error detail | Sanitized RFC 7807 | Full internal codes + stack trace ID |
| Rate limits | Tier-based | 50,000 req/min default; unlimited within mesh burst |
| Versioning | Strict 12-month deprecation | Coordinated deploy; breaking changes with joint PR |
| Pagination | Cursor-based | Cursor or `offset`/`limit` (internal tooling only) |

### Example Internal Request

```http
POST /internal/v1/authz/check HTTP/1.1
Host: authorization.atlas.svc
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
X-Request-Id: 550e8400-e29b-41d4-a716-446655440000
X-Atlas-Organization-Id: 7c9e6679-7425-40de-944b-e07fc1f90ae7
X-Atlas-Actor-Type: user
X-Atlas-Actor-Id: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "principal_type": "user",
  "principal_id": "550e8400-e29b-41d4-a716-446655440000",
  "permission": "crm:contacts:read",
  "resource_type": "contact",
  "resource_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "scope_type": "organization",
  "scope_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

### Example Internal Response

```json
{
  "allowed": true,
  "reason": "role_admin_grants_permission",
  "evaluated_at": "2026-06-30T12:00:00.123Z",
  "cache_hit": false,
  "policy_version": "2026.06.30.1"
}
```

---

## Internal Event Bus

Atlas uses **Apache Kafka** as the primary integration event bus with **NATS** for low-latency internal fan-out (presence, typing indicators, real-time notifications).

### Event Naming

```
{context}.{aggregate}.{action}.v{major}
```

Kafka topic: `atlas.{event-name}` (e.g., `atlas.tenant.organization.created.v1`)

Partition key: `{organizationId}:{aggregateId}`

### Event Envelope (CloudEvents 1.0)

```json
{
  "specversion": "1.0",
  "id": "01JABCXYZ1234567890",
  "source": "atlas://tenant-identity",
  "type": "tenant.organization.created.v1",
  "time": "2026-06-30T14:32:01.123Z",
  "datacontenttype": "application/json",
  "subject": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "atlasorganizationid": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "atlasworkspaceid": "550e8400-e29b-41d4-a716-446655440000",
  "atlasactorid": "550e8400-e29b-41d4-a716-446655440000",
  "atlasactortype": "user",
  "atlastraceid": "01JABC...",
  "data": {
    "organizationId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "workspaceId": "550e8400-e29b-41d4-a716-446655440000",
    "slug": "acme-corp",
    "name": "Acme Corp"
  }
}
```

### Required Payload Fields

| Field | Type | Description |
|-------|------|-------------|
| `eventId` | ULID | Unique event identifier (same as CloudEvents `id`) |
| `occurredAt` | ISO 8601 | Event timestamp |
| `organizationId` | UUID | RLS tenant key |
| `correlationId` | ULID | Originating request trace |
| `causationId` | ULID | Parent event or command |
| `actor` | object | `{ type, id }` — who triggered the action |

---

## Event Topic Catalog

### Platform / Tenant Events

| Topic | Publisher | Key Subscribers | Description |
|-------|-----------|-----------------|-------------|
| `atlas.tenant.workspace.created.v1` | tenant-identity | billing | New workspace |
| `atlas.tenant.organization.created.v1` | tenant-identity | All modules | Org provisioned — triggers module seeding |
| `atlas.tenant.organization.suspended.v1` | tenant-identity | All modules | Org suspended |
| `atlas.tenant.member.joined.v1` | tenant-identity | authorization, notification | Member accepted invitation |
| `atlas.tenant.member.removed.v1` | tenant-identity | authorization, notification | Member removed |
| `atlas.tenant.team.created.v1` | tenant-identity | authorization | New team |

### Identity / Auth Events

| Topic | Publisher | Key Subscribers | Description |
|-------|-----------|-----------------|-------------|
| `atlas.identity.user.registered.v1` | tenant-identity | notification | New user signup |
| `atlas.identity.user.verified.v1` | tenant-identity | tenant-identity | Email verified — triggers onboarding |
| `atlas.identity.session.created.v1` | tenant-identity | insight | Login audit |
| `atlas.identity.session.revoked.v1` | tenant-identity | insight | Logout / forced revocation |

### Authorization Events

| Topic | Publisher | Key Subscribers | Description |
|-------|-----------|-----------------|-------------|
| `atlas.authz.role.assigned.v1` | authorization | insight, notification | Role granted |
| `atlas.authz.role.revoked.v1` | authorization | insight | Role removed |
| `atlas.authz.policy.updated.v1` | authorization | All API services | Cache invalidation |

### Domain Events (Phase 1 Core)

| Topic | Publisher | Key Subscribers | Description |
|-------|-----------|-----------------|-------------|
| `atlas.customer.lead.created.v1` | customer | orchestration, intelligence | New CRM lead |
| `atlas.customer.contact.updated.v1` | customer | search-indexer, intelligence | Contact changed |
| `atlas.commercial.order.confirmed.v1` | commercial | ledger, stock, delivery | Order confirmed |
| `atlas.ledger.invoice.posted.v1` | ledger | insight, orchestration | Invoice posted |
| `atlas.ledger.payment.received.v1` | ledger | insight, notification | Payment recorded |
| `atlas.service.case.resolved.v1` | service | customer, insight | Support case closed |
| `atlas.workforce.employee.hired.v1` | workforce | tenant-identity, calendar | Employee onboarded |

### Infrastructure Events

| Topic | Publisher | Key Subscribers | Description |
|-------|-----------|-----------------|-------------|
| `atlas.platform.webhook.delivery.v1` | webhook-dispatcher | insight | Webhook delivery attempt |
| `atlas.platform.audit.recorded.v1` | all modules | audit-store | Compliance audit record |

---

## Consumer Group Naming

```
atlas-{module}-{handler-name}

Examples:
  atlas-ledger-commercial-order-handler
  atlas-insight-contact-projection
  atlas-search-indexer-contact-updated
  atlas-orchestration-quote-to-cash-saga
  atlas-notification-member-joined
```

---

## NATS Subjects (Low-Latency Fan-Out)

| Subject Pattern | Publisher | Subscribers | Description |
|-----------------|-----------|-------------|-------------|
| `atlas.presence.{orgId}.{userId}` | communication | WebSocket gateway | User presence updates |
| `atlas.typing.{conversationId}` | communication | WebSocket gateway | Typing indicators |
| `atlas.notify.{userId}` | notification | WebSocket gateway | Real-time in-app notifications |
| `atlas.ai.stream.{sessionId}` | intelligence | WebSocket gateway | AI response streaming |

---

## Delivery Guarantees

| Property | Value |
|----------|-------|
| Kafka delivery | At-least-once |
| Ordering | Per-partition (per `organizationId:aggregateId`) |
| Outbox relay | Transactional outbox → Kafka (no dual-write) |
| Consumer idempotency | Required — keyed by `eventId` in Redis (24h TTL) |
| Dead letter | `{topic}.dlq` after 6 retries with exponential backoff |
| Retry schedule | 1s, 5s, 30s, 2m, 10m, 1h |

---

## Contract Testing

| Test Type | Tool | Scope |
|-----------|------|-------|
| gRPC contract | Buf + protovalidate | Proto schema compatibility |
| REST contract | Pact / OpenAPI diff | Internal REST endpoints |
| Event contract | Schema Registry (Avro/JSON Schema) | Event payload evolution |
| Integration | Testcontainers (Kafka, PostgreSQL) | End-to-end publish/consume |

CI gates:
- Breaking proto changes require major version bump
- Event schema changes follow expand-contract (add optional fields only in same major version)
- Consumer contract tests must pass before producer deploy

---

## Observability

All internal calls propagate:

| Signal | Implementation |
|--------|----------------|
| Trace | OpenTelemetry — `traceparent` header, W3C format |
| Metrics | gRPC/HTTP request duration, error rate per service pair |
| Logs | Structured JSON with `request_id`, `organization_id`, `service`, `rpc` |

Service mesh (Istio) provides automatic mTLS, traffic metrics, and circuit breaking.

---

## OpenAPI / Proto Artifacts

| Artifact | Location | Status |
|----------|----------|--------|
| Internal REST (platform) | `docs/api/internal/openapi/platform-internal.yaml` | Planned |
| gRPC protos | `packages/proto/atlas/` | Planned |
| Event schemas | `packages/events/schemas/` | Planned |

---

## References

- [06-api-architecture.md](../../architecture/phase-1/06-api-architecture.md) §10 — Internal vs External boundaries
- [02-software-architecture.md](../../architecture/phase-1/02-software-architecture.md) — Event catalog, gRPC
- [07-authentication.md](../../architecture/phase-1/07-authentication.md) §9 — Service-to-service auth
- [naming-standards.md](../../standards/naming-standards.md) — Event and topic naming
- [02-platform-core.md](../../database/02-platform-core.md) — Platform events published

---

*Document owner: Platform Infrastructure Team · Classification: Internal*