---
title: API Architecture
version: 1.0.0
status: draft
phase: 1
last_updated: 2026-06-30
authors:
  - Atlas Architecture Team
related_documents:
  - 02-software-architecture.md
  - 05-database-architecture.md
  - 07-authentication.md
  - 08-authorization.md
  - 11-integrations.md
adr_references:
  - ADR-0006
  - ADR-0014
  - ADR-0021
---

# API Architecture

## Purpose

Define the API surface, protocols, and operational standards for Atlas — enabling consistent, secure, and scalable access for the Next.js web application, mobile clients, third-party integrations, AI agents, and internal microservices. This document establishes the REST + GraphQL hybrid strategy, versioning, error handling, rate limiting, real-time channels, and gateway architecture that all Atlas modules must conform to.

## Scope

### In Scope

- REST + GraphQL hybrid API strategy
- API versioning (URL path + header negotiation)
- Rate limiting tiers and enforcement
- Cursor-based pagination
- Error response format (RFC 7807 Problem Details)
- Idempotency key handling
- Webhook delivery architecture
- API gateway (Kong / AWS API Gateway)
- Internal vs external API boundaries
- Real-time communication (SSE, WebSocket)
- API documentation (OpenAPI 3.1)
- Request/response conventions, content negotiation, and correlation

### Out of Scope

- Per-endpoint API contracts (Phase 5 — API Contracts)
- GraphQL schema per module (Phase 5)
- SDK generation pipeline implementation
- Specific Kong plugin configuration (see `03-infrastructure-architecture.md`)

## Context

Atlas is an API-first platform where every business capability — CRM, invoicing, projects, HR, documents, AI agents — is exposed through a unified API layer. Consumers include:

1. **First-party clients** — Next.js web app, future mobile apps
2. **Third-party integrations** — OAuth apps, marketplace partners
3. **AI agent runtime** — Tool calls against structured APIs
4. **Internal services** — Service-to-service calls within the mesh
5. **Webhooks** — Outbound event delivery to customer endpoints

The API layer must support billions of requests per month, enforce tenant isolation and authorization uniformly, and provide excellent developer experience for integration partners comparable to Stripe or Shopify.

### Design Principles

| Principle | Rationale |
|-----------|-----------|
| **API-first** | Every feature ships with an API before UI |
| **Contract-driven** | OpenAPI 3.1 is the REST source of truth |
| **Right protocol for the job** | REST for CRUD/integrations; GraphQL for composite UI queries |
| **Consistent errors** | RFC 7807 everywhere — no ad-hoc error shapes |
| **Safe retries** | Idempotency keys on all mutating operations |
| **Defense in depth** | Gateway rate limits + app-level authz + tenant context |

---

## Detailed Design

### 1. API Surface Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           API Consumers                                  │
├──────────────┬──────────────┬──────────────┬───────────────────────────┤
│  Next.js Web │  Mobile Apps │  OAuth Apps  │  AI Agent Runtime         │
│  Application │  (future)    │  Partners    │  (internal)               │
└──────┬───────┴──────┬───────┴──────┬───────┴───────────┬───────────────┘
       │              │              │                   │
       └──────────────┴──────────────┴───────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │    API Gateway     │
                    │  (Kong / AWS APIGW)│
                    │  - TLS termination │
                    │  - Rate limiting   │
                    │  - Auth validation │
                    │  - Request routing │
                    └─────────┬─────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │  REST API   │    │  GraphQL    │    │  Real-time  │
   │  Service    │    │  Gateway    │    │  Gateway    │
   │  /v1/...    │    │  /graphql   │    │  /stream    │
   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Domain Services  │
                    │  (TypeScript)     │
                    │  CRM, Finance, HR │
                    └───────────────────┘
```

---

### 2. REST + GraphQL Hybrid Strategy

#### 2.1 Protocol Selection Matrix

| Use Case | Protocol | Rationale |
|----------|----------|-----------|
| CRUD on single resources | REST | Simple, cacheable, OpenAPI-documented |
| Third-party integrations | REST | Industry standard; SDK-friendly |
| Webhook payload schemas | REST (JSON) | Stable event contracts |
| File upload/download | REST | Multipart, presigned URLs |
| Dashboard composite views | GraphQL | Reduce over-fetching; single round-trip |
| Mobile list + detail prefetch | GraphQL | Flexible field selection |
| AI agent tool invocations | REST | Deterministic, auditable endpoints |
| Admin reporting queries | GraphQL or REST | Complex filters via GraphQL; exports via REST |
| Bulk operations | REST | `POST /v1/invoices/bulk` with job polling |
| Real-time updates | SSE / WebSocket | Not GraphQL subscriptions (Phase 1) |

#### 2.2 REST API Structure

**Base URL:** `https://api.atlas.example.com`

```
/v1/{resource}                    # Collection
/v1/{resource}/{id}               # Single resource
/v1/{resource}/{id}/{sub-resource}# Nested resource
/v1/{resource}/bulk               # Bulk operations
/v1/{resource}/search             # Complex search (POST)
/v1/meta/...                      # Platform metadata
```

**Examples:**

```
GET    /v1/contacts?cursor=...&limit=50
POST   /v1/invoices
GET    /v1/invoices/{id}
PATCH  /v1/invoices/{id}
DELETE /v1/invoices/{id}
POST   /v1/invoices/{id}/send
GET    /v1/projects/{id}/tasks
POST   /v1/webhooks
GET    /v1/meta/openapi.json
```

#### 2.3 GraphQL API Structure

**Endpoint:** `POST /graphql` (versioned via header)

- **Apollo Server** (or equivalent) federated across domain services in later phases; monolith schema initially
- **Query complexity limits** — max depth 10, max cost 1000
- **Persisted queries** for production web/mobile clients (allowlist)
- **No mutations for bulk/destructive ops** — route to REST for clearer audit trails

```graphql
# Example: Dashboard query
query ProjectDashboard($projectId: ID!) {
  project(id: $projectId) {
    id
    name
    status
    tasks(filter: { status: OPEN }, limit: 10) {
      edges { node { id title assignee { name } } }
    }
    members { id name avatarUrl }
    activityFeed(limit: 20) { ... }
  }
}
```

#### 2.4 Internal Graph Representation

Both REST and GraphQL handlers invoke the same **application service layer** (hexagonal architecture). No business logic duplication.

```
REST Controller ──┐
                  ├──▶ Application Service ──▶ Domain ──▶ Repository
GraphQL Resolver ─┘
```

---

### 3. API Versioning

#### 3.1 Versioning Strategy (Dual)

| Method | Format | Usage |
|--------|--------|-------|
| **URL path** (primary) | `/v1/`, `/v2/` | External integrations, webhooks, public docs |
| **Header** (secondary) | `Atlas-Version: 2026-06-30` | GraphQL, header-preferring clients |

**Date-based header versioning** (Stripe-style) for granular deprecation:

```
Atlas-Version: 2026-06-30
```

Maps internally to API version `v1`. Breaking changes ship behind new date versions with migration guides.

#### 3.2 Version Lifecycle

```
Preview (alpha) → Stable (v1) → Deprecated (12 months) → Sunset (removed)
```

| Stage | Header | Support |
|-------|--------|---------|
| Preview | `Atlas-Version: preview` | No SLA; breaking changes allowed |
| Stable | `Atlas-Version: 2026-06-30` | Full SLA |
| Deprecated | Response header `Deprecation: true` | Security fixes only |
| Sunset | `410 Gone` | Migration required |

#### 3.3 Breaking vs Non-Breaking Changes

| Non-Breaking (same version) | Breaking (new version required) |
|-----------------------------|----------------------------------|
| Add optional fields | Remove or rename fields |
| Add new endpoints | Change field types |
| Add enum values (with client tolerance) | Change authentication method |
| Add optional query parameters | Change pagination format |
| Add new error codes | Change URL structure |

#### 3.4 Version Routing at Gateway

```
Kong route: /v1/* → upstream-rest-v1
Kong route: /v2/* → upstream-rest-v2
Header plugin: resolve Atlas-Version → upstream override
```

---

### 4. Rate Limiting Tiers

#### 4.1 Tier Definitions

| Tier | Audience | Requests/min | Burst | Concurrent |
|------|----------|--------------|-------|------------|
| **Anonymous** | Unauthenticated (health, public) | 30 | 10 | 5 |
| **Free** | Free-plan tenants | 300 | 50 | 20 |
| **Pro** | Pro-plan tenants | 3,000 | 500 | 100 |
| **Business** | Business-plan tenants | 10,000 | 2,000 | 500 |
| **Enterprise** | Contract-defined | Custom | Custom | Custom |
| **Internal** | Service-to-service | 50,000 | 10,000 | 2,000 |
| **Webhook outbound** | Per delivery endpoint | 100 | 20 | 10 |

#### 4.2 Rate Limit Key Dimensions

```
rate_limit_key = {
  tenant_id,          # primary bucket
  user_id,            # secondary (per-user within tenant)
  api_key_id,         # for OAuth/integration apps
  ip_address,         # for anonymous/unauthenticated
  endpoint_class      # optional per-endpoint overrides (e.g., /search)
}
```

#### 4.3 Enforcement Architecture

```
Request → API Gateway (Kong rate-limiting plugin, Redis backend)
              │
              ├── Under limit → forward to upstream
              │
              └── Over limit → 429 Too Many Requests
                    Headers:
                      RateLimit-Limit: 3000
                      RateLimit-Remaining: 0
                      RateLimit-Reset: 1719753600
                      Retry-After: 42
```

**Sliding window** algorithm in Redis (Lua script) for accuracy. Gateway enforces coarse limits; application enforces expensive endpoint quotas (AI, exports, bulk).

#### 4.4 Response Headers (All Authenticated Requests)

```http
RateLimit-Limit: 3000
RateLimit-Remaining: 2847
RateLimit-Reset: 1719753600
X-RateLimit-Policy: tenant;w=60
```

---

### 5. Cursor-Based Pagination

#### 5.1 Standard Pagination Model

Atlas uses **cursor-based (keyset) pagination** exclusively. Offset pagination is not supported for collections >100 items.

**Request:**

```http
GET /v1/contacts?limit=50&cursor=eyJpZCI6IjAxMjM...
GET /v1/contacts?limit=50&sort=-created_at&cursor=...
```

**Response envelope:**

```json
{
  "data": [ ... ],
  "pagination": {
    "has_more": true,
    "next_cursor": "eyJpZCI6IjAxMjM...",
    "prev_cursor": null,
    "limit": 50
  }
}
```

#### 5.2 Cursor Encoding

Cursors are **opaque, signed, base64url-encoded** payloads:

```json
// Decoded cursor (never exposed to client)
{
  "v": 1,
  "sort": ["created_at", "id"],
  "dir": "desc",
  "values": ["2026-06-15T10:00:00Z", "550e8400-e29b-41d4-a716-446655440000"],
  "tenant_id": "..."
}
```

- Signed with HMAC-SHA256 to prevent tampering
- Includes `tenant_id` to prevent cross-tenant cursor reuse
- TTL: 24 hours (stale cursors return `400` with fresh start suggestion)

#### 5.3 Sorting

```
?sort=created_at        # ascending (default)
?sort=-created_at       # descending
?sort=name,-created_at  # compound sort
```

Allowed sort fields are whitelisted per resource in OpenAPI spec.

#### 5.4 GraphQL Pagination

Relay-style connections:

```graphql
contacts(first: 50, after: "cursor") {
  edges { node { ... } cursor }
  pageInfo { hasNextPage endCursor }
}
```

---

### 6. Error Response Format (RFC 7807)

All API errors return **RFC 7807 Problem Details** (`application/problem+json`).

#### 6.1 Standard Error Envelope

```json
{
  "type": "https://api.atlas.example.com/errors/validation-failed",
  "title": "Validation Failed",
  "status": 422,
  "detail": "One or more fields failed validation.",
  "instance": "/v1/invoices",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "errors": [
    {
      "field": "amount_cents",
      "code": "invalid_value",
      "message": "Must be a positive integer."
    }
  ]
}
```

#### 6.2 Standard Error Types

| HTTP Status | Type URI suffix | Usage |
|-------------|-----------------|-------|
| 400 | `/bad-request` | Malformed request, invalid cursor |
| 401 | `/unauthorized` | Missing or invalid authentication |
| 403 | `/forbidden` | Authenticated but not authorized |
| 404 | `/not-found` | Resource not found (or not visible) |
| 409 | `/conflict` | Optimistic lock conflict, duplicate |
| 422 | `/validation-failed` | Semantic validation errors |
| 429 | `/rate-limited` | Rate limit exceeded |
| 500 | `/internal-error` | Unexpected server error |
| 503 | `/service-unavailable` | Maintenance or overload |

#### 6.3 Error Code Convention

```
{domain}_{entity}_{reason}

Examples:
  auth_token_expired
  invoice_already_sent
  contact_email_duplicate
  tenant_quota_exceeded
```

Machine-readable `code` field in extension for programmatic handling.

#### 6.4 Security Considerations

- **404 vs 403:** Return 404 for resources the user cannot see (prevent enumeration)
- **500 errors:** Never expose stack traces; log internally with `request_id`
- **Validation errors:** Do not leak internal field names for hidden attributes

---

### 7. Idempotency Keys

#### 7.1 Requirement

All `POST` mutating endpoints (create, action) accept:

```http
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

- Client-generated UUID v4 (or ULID)
- Scope: per tenant + per endpoint pattern
- TTL: 24 hours in Redis

#### 7.2 Behavior

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│ Client POST  │────▶│ Check Redis key │────▶│ Cache hit?   │
│ + Idempotency│     │ idem:{tenant}:  │     │ Return cached│
│   Key        │     │ {key}           │     │ response     │
└──────────────┘     └────────┬────────┘     └──────────────┘
                              │ miss
                              ▼
                     ┌─────────────────┐
                     │ Process request │
                     │ Store response  │
                     │ in Redis (24h)  │
                     └─────────────────┘
```

| Scenario | Response |
|----------|----------|
| First request | Process normally; cache response |
| Duplicate key, same payload | Return cached response (same status + body) |
| Duplicate key, different payload | `409 Conflict` — key reuse with different body |
| In-flight duplicate | `409` with `Retry-After` or block until complete |

#### 7.3 Scope

- **Required:** `POST` (create), action endpoints (`/send`, `/approve`, `/charge`)
- **Optional:** `PATCH` (idempotent by nature with optimistic locking)
- **Not applicable:** `GET`, `DELETE` (inherently idempotent)

---

### 8. Webhook Delivery Architecture

#### 8.1 Overview

Atlas delivers outbound webhooks for domain events (invoice.paid, contact.created, etc.) to customer-configured HTTPS endpoints.

```
┌────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│ Domain     │───▶│ Event Outbox │───▶│ Event Bus       │───▶│ Webhook      │
│ Service    │    │ (PostgreSQL) │    │                 │    │ Dispatcher   │
└────────────┘    └──────────────┘    └─────────────────┘    └──────┬───────┘
                                                                     │
                                                              ┌──────▼───────┐
                                                              │ Delivery     │
                                                              │ Workers      │
                                                              │ (per-tenant  │
                                                              │  queue)      │
                                                              └──────┬───────┘
                                                                     │
                                                              ┌──────▼───────┐
                                                              │ Customer     │
                                                              │ Endpoint     │
                                                              │ (HTTPS)      │
                                                              └──────────────┘
```

#### 8.2 Webhook Registration

```json
POST /v1/webhooks
{
  "url": "https://customer.example.com/atlas/webhooks",
  "events": ["invoice.paid", "invoice.created"],
  "secret": "whsec_auto_generated",
  "description": "ERP integration"
}
```

#### 8.3 Delivery Guarantees

| Property | Value |
|----------|-------|
| Delivery semantics | At-least-once |
| Ordering | Best-effort per tenant (partitioned queue) |
| Timeout | 30 seconds per attempt |
| Retry schedule | Exponential: 1m, 5m, 30m, 2h, 8h, 24h (6 attempts) |
| Dead letter | After max retries → `webhook_deliveries` table, alert tenant |

#### 8.4 Signature Verification

```http
POST /customer/endpoint
Atlas-Signature: t=1719753600,v1=abc123...
Atlas-Webhook-Id: wh_550e8400
Content-Type: application/json

{ "type": "invoice.paid", "data": { ... } }
```

Signature: `HMAC-SHA256(secret, "{timestamp}.{body}")`

#### 8.5 Delivery Log API

```
GET /v1/webhooks/{id}/deliveries
GET /v1/webhooks/{id}/deliveries/{delivery_id}
POST /v1/webhooks/{id}/deliveries/{delivery_id}/retry
```

---

### 9. API Gateway Architecture

#### 9.1 Gateway Selection

**Primary:** Kong Gateway (self-hosted on Kubernetes) or AWS API Gateway + Lambda authorizer for managed option.

| Capability | Kong | AWS API Gateway |
|------------|------|-----------------|
| Rate limiting | Redis plugin | Usage plans |
| JWT/OAuth validation | OIDC plugin | Cognito/Lambda |
| Request transformation | Native | VTL/Lambda |
| GraphQL routing | Native | Limited |
| Cost at scale | Infra cost | Per-request cost |
| Multi-cloud | Portable | AWS-locked |

**Decision:** Kong as default for multi-cloud portability; AWS API Gateway acceptable for AWS-only deployments.

#### 9.2 Gateway Responsibilities

| Responsibility | Gateway | Application |
|----------------|---------|-------------|
| TLS termination | ✅ | — |
| Request size limits (10MB default) | ✅ | — |
| Rate limiting (coarse) | ✅ | Fine-grained per endpoint |
| JWT validation (signature, expiry) | ✅ | Claims extraction |
| Tenant resolution | Partial (JWT claims) | Full validation |
| Authorization | — | ✅ (OPA policy engine) |
| Request logging / tracing | ✅ | ✅ (span creation) |
| CORS | ✅ | — |
| DDoS protection | ✅ (with WAF) | — |

#### 9.3 Route Configuration

```yaml
# Kong declarative config (simplified)
services:
  - name: atlas-rest-v1
    url: http://rest-service.internal:3000
    routes:
      - name: rest-v1
        paths: ["/v1"]
        strip_path: false
    plugins:
      - name: rate-limiting
        config:
          minute: 3000
          policy: redis
      - name: jwt
      - name: correlation-id
        config:
          header_name: X-Request-Id
          generator: uuid

  - name: atlas-graphql
    url: http://graphql-service.internal:4000
    routes:
      - name: graphql
        paths: ["/graphql"]
```

#### 9.4 Request Flow

```
Client Request
    │
    ▼
[WAF / Cloudflare] ── DDoS, bot protection
    │
    ▼
[Kong Gateway]
    ├── TLS termination
    ├── Correlation ID injection (X-Request-Id)
    ├── JWT signature validation
    ├── Rate limit check
    ├── Route to upstream
    │
    ▼
[Application Middleware]
    ├── Full auth context resolution
    ├── Tenant + user extraction
    ├── Authorization (OPA)
    ├── Idempotency check
    ├── Business logic
    │
    ▼
Response (+ rate limit headers, request_id)
```

---

### 10. Internal vs External API Boundaries

#### 10.1 API Classes

| Class | Prefix | Auth | Exposure | Documentation |
|-------|--------|------|----------|---------------|
| **Public REST** | `/v1/` | OAuth2 / API key | Internet | OpenAPI (public) |
| **Public GraphQL** | `/graphql` | OAuth2 / session | Internet | GraphQL schema (public) |
| **Internal REST** | `/internal/v1/` | mTLS + service JWT | Service mesh only | OpenAPI (internal repo) |
| **Admin** | `/admin/v1/` | Platform admin SSO | VPN + IP allowlist | Internal |
| **Agent** | `/agent/v1/` | Service account + scoped | Internal | Agent tool catalog |

#### 10.2 Network Isolation

```
Internet ──▶ Public ALB ──▶ Kong ──▶ Public services
VPC internal ──▶ Internal ALB ──▶ Service mesh ──▶ Domain services
```

- Internal APIs are **never** exposed through public Kong routes
- Service mesh (Istio/Linkerd) enforces mTLS between services
- `/.internal/` health and debug endpoints blocked at gateway

#### 10.3 Contract Differences

| Aspect | External | Internal |
|--------|----------|----------|
| Stability guarantee | 12-month deprecation | Breaking changes with coordinated deploy |
| Error detail level | Sanitized | Full internal codes |
| Rate limits | Tier-based | High/default unlimited within mesh |
| Versioning | Strict | Loose (deploy together) |
| Payload optimization | Client-friendly | Performance-optimized (protobuf optional) |

---

### 11. Real-Time Communication (SSE / WebSocket)

#### 11.1 Protocol Selection

| Protocol | Use Case |
|----------|----------|
| **SSE** (Server-Sent Events) | Notification feed, activity stream, AI response streaming |
| **WebSocket** | Collaborative editing, real-time chat, presence |
| **HTTP long-poll** | Fallback for restrictive proxies (legacy) |

**Phase 1 default:** SSE for unidirectional server→client; WebSocket for bidirectional.

#### 11.2 SSE Architecture

```http
GET /v1/stream/notifications
Authorization: Bearer ...
Accept: text/event-stream

event: notification
data: {"type":"invoice.paid","id":"..."}

event: heartbeat
data: {"ts":"2026-06-30T12:00:00Z"}
```

- Authenticated via same JWT as REST
- Tenant-scoped event filtering server-side
- Redis Pub/Sub backbone for multi-instance fan-out
- Reconnection: `Last-Event-ID` header support

#### 11.3 WebSocket Architecture

```
wss://api.atlas.example.com/v1/ws
```

**Subprotocol:** `atlas.v1`

**Message envelope:**

```json
{
  "type": "subscribe",
  "channel": "project:550e8400:presence",
  "payload": {}
}
```

- Auth: JWT in connection query param or first message
- Channel authorization via OPA per subscribe
- Horizontal scale via Redis Pub/Sub + sticky sessions (or distributed without sticky via shared pub/sub)

#### 11.4 Real-Time Gateway

Dedicated lightweight service (not through Kong — long-lived connections):

```
Client ──▶ Real-time Gateway ──▶ Redis Pub/Sub ◀── Domain Services (publish)
```

---

### 12. API Documentation (OpenAPI 3.1)

#### 12.1 Documentation Strategy

| Artifact | Source | Publishing |
|----------|--------|------------|
| REST API spec | OpenAPI 3.1 YAML (source of truth) | `/v1/meta/openapi.json`, docs site |
| GraphQL schema | SDL generated from code | GraphQL introspection (dev only) |
| Webhook events | AsyncAPI 3.0 | Docs site |
| Error catalog | Generated from OpenAPI + registry | Docs site |
| Changelog | Markdown per API version | Docs site |

#### 12.2 OpenAPI Requirements

Every REST endpoint must document:

- Operation ID (unique, stable)
- Request/response schemas with examples
- All error responses (4xx, 5xx) with problem+json schema
- Required headers (Idempotency-Key, Atlas-Version)
- Rate limit tier annotation
- Required OAuth scopes
- Deprecation/sunset headers where applicable

#### 12.3 SDK Generation

```
openapi.yaml → OpenAPI Generator →
  - typescript-fetch (web app internal)
  - python, go, java (partner SDKs)
  - Postman collection
```

SDKs versioned alongside API versions. Published to npm, PyPI, etc.

#### 12.4 Interactive Documentation

- **Stoplight / Redocly** rendered docs at `https://docs.atlas.example.com/api`
- Try-it-now sandbox against staging environment
- GraphQL Playground disabled in production; available in staging

---

### 13. Request/Response Conventions

#### 13.1 Standard Headers

| Header | Direction | Description |
|--------|-----------|-------------|
| `Authorization` | Request | `Bearer {token}` or `Atlas-Key {api_key}` |
| `Atlas-Version` | Request | API version date |
| `Idempotency-Key` | Request | UUID for safe retries |
| `X-Request-Id` | Both | Correlation ID (UUID v4) |
| `Atlas-Tenant-Id` | Request | Optional explicit tenant (org switching) |
| `Accept-Language` | Request | Locale for error messages |
| `Content-Type` | Request | `application/json` (default) |
| `X-Atlas-Consistency` | Request | `strong` for read-your-writes |
| `RateLimit-*` | Response | Rate limit status |
| `X-Request-Id` | Response | Echo/generate correlation ID |
| `Deprecation` | Response | `true` if endpoint deprecated |

#### 13.2 Request Body Conventions

- JSON field naming: `snake_case`
- Timestamps: ISO 8601 UTC (`2026-06-30T12:00:00Z`)
- Currency: integer cents (`amount_cents: 1999`)
- IDs: UUID v4
- Empty strings not accepted — use `null` or omit

#### 13.3 Response Envelope

**Single resource:**

```json
{
  "data": { "id": "...", "type": "invoice", ... },
  "meta": { "request_id": "..." }
}
```

**Collection:**

```json
{
  "data": [ ... ],
  "pagination": { ... },
  "meta": { "request_id": "...", "total_count": null }
}
```

`total_count` is omitted by default (expensive); available via `?include=total_count` on supported endpoints.

---

### 14. Authentication Integration Points

API layer validates authentication but delegates to `07-authentication.md` for details:

| Token Type | Usage | Validation Point |
|------------|-------|------------------|
| Session JWT (httpOnly cookie) | Web app | Gateway + app |
| Bearer access token | API integrations | Gateway + app |
| API key | Server-to-server integrations | Gateway |
| Service JWT | Internal services | Mesh + app |

Authorization decisions: `08-authorization.md` (OPA policy engine).

---

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| REST-only | Dashboard over-fetching; poor mobile performance for composite views |
| GraphQL-only | Poor fit for webhooks, file uploads, caching, partner SDK expectations |
| Offset pagination | Performance degrades on large datasets; inconsistent under concurrent writes |
| gRPC external API | Poor browser support; higher barrier for integration partners |
| Custom error format | Inconsistent with industry; RFC 7807 is standard and tooling-friendly |
| GraphQL subscriptions | Added infrastructure complexity; SSE covers Phase 1 real-time needs |
| API Gateway in app layer | Duplicated cross-cutting concerns; gateway centralizes policy |
| Webhook sync delivery | Blocks domain transaction; async queue required |
| URL-only versioning | Insufficient granularity for Stripe-style incremental upgrades |

---

## Consequences

### Positive

- **Hybrid REST + GraphQL** optimizes for both integration partners and first-party UX
- **RFC 7807 errors** enable consistent client error handling and SDK generation
- **Cursor pagination** ensures stable, performant list endpoints at scale
- **Idempotency keys** prevent duplicate mutations from network retries
- **Gateway-centralized** rate limiting and auth validation reduce per-service duplication
- **OpenAPI 3.1** as source of truth enables automated SDK and documentation pipelines

### Negative

- **Dual protocol maintenance** — REST and GraphQL schemas must stay synchronized
- **Cursor complexity** — clients cannot jump to arbitrary pages
- **Gateway operational overhead** — Kong cluster management and plugin upgrades
- **Webhook at-least-once** — consumers must implement idempotent processing
- **SSE/WebSocket infrastructure** — separate from stateless REST scaling patterns

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| GraphQL N+1 queries | DataLoader batching; query complexity limits |
| Rate limit false positives | Burst allowances; enterprise overrides |
| Webhook endpoint downtime | Retry with backoff; delivery dashboard |
| API version sprawl | Automated sunset enforcement; deprecation headers |
| Gateway single point of failure | Multi-AZ deployment; health-check failover |

---

## Open Questions

| # | Question | Owner | Target Date |
|---|----------|-------|-------------|
| 1 | Kong vs AWS API Gateway for initial production deployment? | Infra Arch | Q3 2026 |
| 2 | GraphQL federation timeline — monolith schema duration? | Platform Eng | Q3 2026 |
| 3 | WebSocket sticky sessions vs fully distributed pub/sub? | Platform Eng | Q3 2026 |
| 4 | Public API key auth vs OAuth-only for integrations? | Product + Security | Q3 2026 |
| 5 | Maximum webhook payload size and event batching? | Integrations | Q4 2026 |
| 6 | protobuf support for internal service-to-service APIs? | Platform Eng | Q4 2026 |
| 7 | GraphQL persisted query allowlist enforcement in CI? | Platform Eng | Q3 2026 |
| 8 | API sandbox environment — shared or per-developer? | Product | Q4 2026 |

---

## References

- [RFC 7807 — Problem Details for HTTP APIs](https://datatracker.ietf.org/doc/html/rfc7807)
- [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/v3.1.0)
- [AsyncAPI 3.0](https://www.asyncapi.com/)
- [Stripe API Design (versioning reference)](https://stripe.com/docs/api/versioning)
- [GraphQL Cursor Connections Specification](https://relay.dev/graphql/connections.htm)
- Atlas: `05-database-architecture.md`, `07-authentication.md`, `08-authorization.md`, `11-integrations.md`