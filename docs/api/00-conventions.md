---
title: API Conventions
document_id: ATLAS-API-00
version: 1.0.0
status: approved
phase: 5
last_updated: 2026-06-30
authors:
  - Atlas Platform Engineering Team
related_documents:
  - ../architecture/phase-1/06-api-architecture.md
  - ../architecture/phase-1/07-authentication.md
  - ../architecture/phase-1/08-authorization.md
  - ../database/00-conventions.md
  - ../database/02-platform-core.md
  - ../database/03-identity-auth.md
tags:
  - api
  - rest
  - openapi
  - conventions
---

# API Conventions

## Purpose

Define the canonical REST API conventions for Atlas BOS public and partner-facing APIs. All OpenAPI specifications, SDKs, and client implementations must conform to this document.

## Base URLs

| Surface | Base URL | Specification |
|---------|----------|---------------|
| **Public REST** | `https://api.atlas.example.com/v1` | OpenAPI 3.1 |
| **Authentication** | `https://auth.atlas.example.com` | [openapi/auth.yaml](openapi/auth.yaml) |
| **GraphQL** | `https://api.atlas.example.com/graphql` | GraphQL SDL (Phase 5) |
| **Real-time (SSE)** | `https://api.atlas.example.com/v1/stream` | Protocol docs |
| **WebSocket** | `wss://api.atlas.example.com/v1/ws` | Protocol docs |
| **Internal REST** | `https://internal.atlas.svc/internal/v1` | [internal/README.md](internal/README.md) |

## REST Resource Structure

```
/v1/{resource}                              # Collection
/v1/{resource}/{id}                         # Single resource
/v1/{resource}/{id}/{sub-resource}          # Nested resource
/v1/{resource}/bulk                         # Bulk operations
/v1/{resource}/search                       # Complex search (POST)
/v1/meta/...                                # Platform metadata
```

**HTTP method semantics:**

| Method | Usage | Idempotent | Body |
|--------|-------|------------|------|
| `GET` | Read resource(s) | Yes | No |
| `POST` | Create resource or action | No* | Yes |
| `PATCH` | Partial update | Yes† | Yes |
| `PUT` | Full replace (rare) | Yes | Yes |
| `DELETE` | Soft delete (default) | Yes | No |

\* POST requires `Idempotency-Key` for safe retries.  
† PATCH uses optimistic locking via `version` field.

**JSON field naming:** `snake_case` for all request and response bodies.

---

## Standard Headers

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Conditional | `Bearer {jwt}` for user/session tokens; `Atlas-Key {api_key}` for server integrations |
| `Atlas-Version` | Recommended | Date-based API version, e.g. `2026-06-30`. Defaults to current stable if omitted |
| `Atlas-Organization-Id` | Conditional | Explicit organization (tenant) context. Required when JWT does not carry active org or when switching orgs |
| `Idempotency-Key` | POST (mutating) | Client-generated UUID v4 for safe retries. TTL: 24 hours |
| `X-Request-Id` | Optional | Client-supplied correlation ID (UUID v4). Server generates if absent |
| `Accept` | Optional | `application/json` (default) or `application/problem+json` for errors |
| `Accept-Language` | Optional | Locale for localized error messages, e.g. `en-US`, `fr-FR` |
| `Content-Type` | Conditional | `application/json` for JSON bodies; `multipart/form-data` for uploads |
| `X-Atlas-Consistency` | Optional | `strong` — route reads to primary for read-your-writes |

### Response Headers

| Header | Description |
|--------|-------------|
| `X-Request-Id` | Echoed or generated correlation ID |
| `Atlas-Version` | Resolved API version for this response |
| `RateLimit-Limit` | Maximum requests in current window |
| `RateLimit-Remaining` | Remaining requests in current window |
| `RateLimit-Reset` | Unix timestamp when window resets |
| `X-RateLimit-Policy` | Policy descriptor, e.g. `tenant;w=60` |
| `Retry-After` | Seconds to wait (429, 503, idempotency conflicts) |
| `Deprecation` | `true` if endpoint is deprecated |
| `Sunset` | RFC 8594 sunset date for deprecated endpoints |

### Tenant Context

The **organization** (`organization_id`) is the RLS tenant boundary per [02-platform-core.md](../database/02-platform-core.md). The API resolves tenant context in this order:

1. `Atlas-Organization-Id` header (if present and caller has membership)
2. JWT `tid` claim (active organization from session)
3. API key default organization binding

Workspace-scoped operations (billing root) use `workspace_id` in path or body; organization-scoped operations require tenant context.

---

## Authentication

| Token Type | Header Format | Usage |
|------------|---------------|-------|
| Session JWT | `Authorization: Bearer {jwt}` | Web app (httpOnly cookie mirrored), mobile, integrations |
| API key | `Authorization: Atlas-Key atl_live_{prefix}` | Server-to-server integrations |
| Service JWT | `Authorization: Bearer {svc_jwt}` | Internal mesh only (mTLS required) |

See [07-authentication.md](../architecture/phase-1/07-authentication.md) and [openapi/auth.yaml](openapi/auth.yaml).

---

## OAuth Scopes

OAuth applications and API keys are authorized via **scopes** that map to RBAC permissions. Scope format:

```
{resource}:{action}
```

### Standard Scopes

| Scope | Permissions Granted | Tier |
|-------|-------------------|------|
| `openid` | Identity token claims | Standard |
| `profile` | User profile read | Standard |
| `email` | Email address read | Standard |
| `contacts:read` | `crm:contacts:read` | Standard |
| `contacts:write` | `crm:contacts:write` | Standard |
| `invoices:read` | `finance:invoices:read` | Standard |
| `invoices:write` | `finance:invoices:write` | Standard |
| `projects:read` | `projects:projects:read`, `projects:tasks:read` | Standard |
| `projects:write` | `projects:projects:write`, `projects:tasks:write` | Standard |
| `webhooks:manage` | `platform:webhooks:manage` | Standard |
| `admin:read` | All `:read` permissions | Elevated |
| `admin:write` | All `:write` permissions | Elevated |

Elevated scopes (`admin:*`) require organization admin approval during OAuth consent.

**Scope validation:** Requests return `403` with `insufficient_scope` when the token scope does not cover the required permission.

---

## Request/Response Envelopes

### Single Resource

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "object": "organization",
    "name": "Acme Corp",
    "created_at": "2026-06-30T12:00:00Z"
  },
  "meta": {
    "request_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
  }
}
```

### Collection (Cursor Pagination)

```json
{
  "data": [
    { "id": "...", "object": "team", "name": "Engineering" }
  ],
  "pagination": {
    "has_more": true,
    "next_cursor": "eyJpZCI6IjAxMjM...",
    "prev_cursor": null,
    "limit": 50
  },
  "meta": {
    "request_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "total_count": null
  }
}
```

| Field | Description |
|-------|-------------|
| `data` | Resource object or array |
| `data.object` | Resource type discriminator (`organization`, `team`, `member`, etc.) |
| `pagination` | Present on all collection responses |
| `meta.request_id` | Correlation ID for support and debugging |
| `meta.total_count` | Omitted by default; include via `?include=total_count` where supported |

### Action Responses

Non-CRUD actions (e.g., `POST /invitations/{id}/resend`) return the same envelope with the affected resource or an action result object in `data`.

---

## Pagination

Atlas uses **cursor-based (keyset) pagination** exclusively. Offset pagination is not supported.

### Request Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | `50` | Page size. Min: 1, Max: 100 |
| `cursor` | string | — | Opaque signed cursor from previous response |
| `sort` | string | `created_at` | Sort field(s). Prefix `-` for descending. Compound: `name,-created_at` |

### Example

```http
GET /v1/organizations/{organization_id}/members?limit=50&sort=-joined_at&cursor=eyJpZCI6...
```

### Cursor Properties

- Opaque, base64url-encoded, HMAC-SHA256 signed
- Includes `tenant_id` to prevent cross-tenant reuse
- TTL: 24 hours (stale cursors return `400` with suggestion to restart)
- Allowed sort fields are whitelisted per resource in OpenAPI specs

### GraphQL Equivalent

Relay-style connections: `edges { node cursor }`, `pageInfo { hasNextPage endCursor }`.

---

## Error Responses (RFC 7807)

All errors return `application/problem+json` per [RFC 7807](https://datatracker.ietf.org/doc/html/rfc7807).

### Standard Envelope

```json
{
  "type": "https://api.atlas.example.com/errors/validation-failed",
  "title": "Validation Failed",
  "status": 422,
  "detail": "One or more fields failed validation.",
  "instance": "/v1/organizations/org_abc/members",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "code": "platform_member_validation_failed",
  "errors": [
    {
      "field": "email",
      "code": "invalid_format",
      "message": "Must be a valid email address."
    }
  ]
}
```

### Standard Error Types

| HTTP Status | Type URI Suffix | `code` Pattern | Usage |
|-------------|-----------------|----------------|-------|
| 400 | `/bad-request` | `{domain}_bad_request` | Malformed request, invalid cursor |
| 401 | `/unauthorized` | `auth_unauthorized` | Missing or invalid authentication |
| 403 | `/forbidden` | `auth_forbidden` | Authenticated but not authorized |
| 404 | `/not-found` | `{entity}_not_found` | Resource not found (or not visible) |
| 409 | `/conflict` | `{entity}_conflict` | Version conflict, duplicate, idempotency mismatch |
| 422 | `/validation-failed` | `{entity}_validation_failed` | Semantic validation errors |
| 429 | `/rate-limited` | `platform_rate_limited` | Rate limit exceeded |
| 500 | `/internal-error` | `platform_internal_error` | Unexpected server error |
| 503 | `/service-unavailable` | `platform_unavailable` | Maintenance or overload |

### Error Code Convention

```
{domain}_{entity}_{reason}

Examples:
  auth_token_expired
  auth_insufficient_scope
  platform_invitation_expired
  platform_member_duplicate
  platform_organization_quota_exceeded
```

### Security Rules

- Return **404** (not 403) for resources the caller cannot see — prevents enumeration
- **500** responses never expose stack traces; log internally with `request_id`
- Validation errors do not leak internal field names for hidden attributes

---

## Idempotency

All `POST` mutating endpoints accept:

```http
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

| Scenario | Response |
|----------|----------|
| First request | Process normally; cache response (status + body) for 24h |
| Duplicate key, same payload | Return cached response |
| Duplicate key, different payload | `409 Conflict` — key reuse with different body |
| In-flight duplicate | `409` with `Retry-After` or block until complete |

**Scope:** Per organization + per endpoint pattern.  
**Required:** POST (create), action endpoints (`/resend`, `/revoke`, `/accept`).  
**Optional:** PATCH (idempotent with `version` optimistic locking).  
**N/A:** GET, DELETE (inherently idempotent).

---

## API Versioning

### Dual Versioning Strategy

| Method | Format | Usage |
|--------|--------|-------|
| **URL path** (primary) | `/v1/`, `/v2/` | External integrations, webhooks, public docs |
| **Header** (secondary) | `Atlas-Version: 2026-06-30` | Granular deprecation (Stripe-style) |

### Version Lifecycle

```
Preview → Stable → Deprecated (12 months) → Sunset (removed)
```

| Stage | Header Value | Support |
|-------|--------------|---------|
| Preview | `preview` | No SLA; breaking changes allowed |
| Stable | `2026-06-30` | Full SLA |
| Deprecated | Response `Deprecation: true` | Security fixes only |
| Sunset | `410 Gone` | Migration required |

### Breaking vs Non-Breaking

| Non-Breaking | Breaking (new version required) |
|--------------|--------------------------------|
| Add optional fields | Remove or rename fields |
| Add new endpoints | Change field types |
| Add enum values | Change authentication method |
| Add optional query params | Change pagination format |
| Add new error codes | Change URL structure |

---

## Rate Limiting

### Tier Definitions

| Tier | Audience | Requests/min | Burst | Concurrent |
|------|----------|--------------|-------|------------|
| **Anonymous** | Unauthenticated | 30 | 10 | 5 |
| **Free** | Free-plan workspaces | 300 | 50 | 20 |
| **Pro** | Pro-plan workspaces | 3,000 | 500 | 100 |
| **Business** | Business-plan workspaces | 10,000 | 2,000 | 500 |
| **Enterprise** | Contract-defined | Custom | Custom | Custom |
| **Internal** | Service-to-service | 50,000 | 10,000 | 2,000 |

### Rate Limit Key Dimensions

```
rate_limit_key = {
  organization_id,   # primary bucket (tenant)
  user_id,           # secondary (per-user within tenant)
  api_key_id,        # OAuth/integration apps
  ip_address,        # anonymous/unauthenticated
  endpoint_class     # optional per-endpoint overrides
}
```

### 429 Response

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/problem+json
RateLimit-Limit: 3000
RateLimit-Remaining: 0
RateLimit-Reset: 1719753600
Retry-After: 42

{
  "type": "https://api.atlas.example.com/errors/rate-limited",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "Request rate limit exceeded. Retry after 42 seconds.",
  "code": "platform_rate_limited",
  "request_id": "..."
}
```

---

## Data Type Conventions

### Identifiers

| Type | Format | Example |
|------|--------|---------|
| UUID | RFC 4122 v4 | `550e8400-e29b-41d4-a716-446655440000` |
| Slug | `^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$` | `acme-corp` |
| API key prefix | `atl_live_` or `atl_test_` | `atl_live_a1b2c3d4` |

### Timestamps

All timestamps are **ISO 8601 UTC** with `Z` suffix:

```
2026-06-30T12:00:00Z
2026-06-30T12:00:00.123Z
```

Never use Unix timestamps in JSON bodies. Use `date-time` format in OpenAPI.

### Money

Monetary amounts are **integer cents** (or smallest currency unit). Never use floats.

```json
{
  "amount_cents": 1999,
  "currency_code": "USD"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `amount_cents` | integer (int64) | Amount in smallest currency unit |
| `currency_code` | string (ISO 4217) | Three-letter code, e.g. `USD`, `EUR` |

For display formatting, clients use `Intl.NumberFormat` or equivalent. Server returns raw cents only.

### Enums

Enum values use `SCREAMING_SNAKE_CASE` matching database enums:

```
ACTIVE, SUSPENDED, PENDING_VERIFICATION, SHARED_RLS
```

### Null and Empty Values

- Empty strings are **not accepted** — use `null` or omit the field
- Omitted fields on PATCH are not updated
- Explicit `null` on PATCH clears nullable fields

### Optimistic Concurrency

Mutable resources include `version` (integer). PATCH requests should include `version`; mismatch returns `409 Conflict`.

---

## Resource Object Types

Platform resources align with [02-platform-core.md](../database/02-platform-core.md) and [03-identity-auth.md](../database/03-identity-auth.md):

| `object` Value | Database Table | Tenant Scoped |
|----------------|----------------|---------------|
| `workspace` | `atlas_core.workspaces` | Membership-based |
| `organization` | `atlas_core.organizations` | Yes (`organization_id`) |
| `team` | `atlas_core.teams` | Yes |
| `member` | `atlas_core.organization_members` | Yes |
| `workspace_member` | `atlas_core.workspace_members` | Workspace |
| `team_member` | `atlas_core.team_members` | Yes |
| `invitation` | `atlas_core.invitations` | Yes |
| `user` | `atlas_core.users` | Global identity |
| `session` | `atlas_core.sessions` | User-scoped |

---

## Content Negotiation

| Accept Header | Response |
|---------------|----------|
| `application/json` | JSON envelope (default) |
| `application/problem+json` | RFC 7807 errors only |
| `text/event-stream` | SSE streams (`/v1/stream/*`) |

File uploads use `multipart/form-data`. File downloads return `Content-Disposition` with presigned URL redirects where applicable.

---

## Webhooks (Outbound)

Webhook payloads follow the same JSON conventions. Signature verification:

```http
Atlas-Signature: t=1719753600,v1=abc123...
Atlas-Webhook-Id: wh_550e8400
```

See [06-api-architecture.md](../architecture/phase-1/06-api-architecture.md) §8.

---

## OpenAPI Requirements

Every REST endpoint in OpenAPI 3.1 specs must document:

- Stable `operationId`
- Request/response schemas with examples
- All error responses (4xx, 5xx) referencing `ProblemDetails`
- Required headers (`Idempotency-Key`, `Atlas-Version` where applicable)
- Rate limit tier annotation
- Required OAuth scopes
- Deprecation/sunset headers where applicable

---

## References

- [06-api-architecture.md](../architecture/phase-1/06-api-architecture.md)
- [07-authentication.md](../architecture/phase-1/07-authentication.md)
- [08-authorization.md](../architecture/phase-1/08-authorization.md)
- [openapi/platform.yaml](openapi/platform.yaml)
- [openapi/auth.yaml](openapi/auth.yaml)
- [RFC 7807 — Problem Details](https://datatracker.ietf.org/doc/html/rfc7807)
- [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/v3.1.0)

---

*Document owner: Platform API Team · Review cadence: Per API version release*