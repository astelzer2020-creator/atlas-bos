# ADR-0006: REST + GraphQL Hybrid API

**Status:** Accepted
**Date:** 2026-06-30
**Deciders:** Chief Software Architect, API Team
**Related:** [06-api-architecture.md](../architecture/phase-1/06-api-architecture.md), [ADR-0004](./ADR-0004-typescript-primary-backend.md)

## Context

Atlas BOS must expose all business capabilities through APIs consumed by diverse clients:

1. **Next.js web application** — composite dashboard queries, list+detail views, real-time updates
2. **Future mobile apps** — bandwidth-constrained, need flexible field selection
3. **Third-party integrations** — OAuth apps, marketplace partners, webhook ecosystems
4. **AI agent runtime** — deterministic, auditable tool invocations
5. **Internal services** — service-to-service communication

Each client type has different API consumption patterns:

- Web dashboards need **multiple resources in one request** (customer + recent orders + open invoices)
- Partner integrations expect **stable, well-documented REST endpoints** with SDK generation
- AI agents need **deterministic, idempotent endpoints** with clear input/output schemas
- Webhooks require **stable JSON event payloads** with versioning

API style candidates:

| Style | Strengths | Weaknesses |
|-------|-----------|------------|
| **REST only** | Simple, cacheable, universal tooling, OpenAPI ecosystem | Over-fetching, multiple round-trips for composite views |
| **GraphQL only** | Flexible queries, single endpoint, strong typing | Complex caching, harder partner integration, N+1 risk |
| **REST + GraphQL** | Right tool per use case | Dual maintenance burden |
| **gRPC only** | High performance, strong typing | Poor browser support, no partner ecosystem |

## Decision

Atlas exposes a **REST + GraphQL hybrid API** with clear protocol selection criteria:

### REST API

- **Base URL:** `https://api.atlas.example.com/v1/`
- **Documentation:** OpenAPI 3.1 specification as source of truth
- **Use cases:**
  - CRUD operations on single resources
  - Third-party partner integrations
  - Webhook payload schemas
  - File upload/download (multipart, presigned URLs)
  - AI agent tool invocations
  - Bulk operations with job polling
  - Public API and SDK generation

### GraphQL API

- **Endpoint:** `https://api.atlas.example.com/graphql`
- **Use cases:**
  - Web application composite queries (dashboard views)
  - Mobile app list + detail prefetch
  - Admin reporting with complex filters
  - Reducing over-fetching for bandwidth-constrained clients

### Protocol Selection Matrix

| Use Case | Protocol |
|----------|----------|
| CRUD on single resources | REST |
| Third-party integrations | REST |
| Webhook payloads | REST (JSON) |
| File upload/download | REST |
| Dashboard composite views | GraphQL |
| Mobile list + detail | GraphQL |
| AI agent tool calls | REST |
| Bulk operations | REST |
| Real-time updates | SSE / WebSocket (not GraphQL subscriptions in Phase 1) |

### Shared Standards (Both Protocols)

- **Authentication:** JWT Bearer tokens (OAuth 2.0 / OIDC)
- **Tenant context:** `X-Atlas-Tenant-Id`, `X-Atlas-Org-Id` headers
- **Errors:** RFC 7807 Problem Details format
- **Idempotency:** `Idempotency-Key` header on all mutating operations
- **Pagination:** Cursor-based (`after`, `before`, `first`, `last`)
- **Versioning:** URL path (`/v1/`) with `Accept-Version` header negotiation
- **Rate limiting:** Per-workspace tier, enforced at gateway
- **Correlation:** `X-Correlation-Id` propagated through all layers

### API Gateway

Both REST and GraphQL traffic routes through the Atlas API Gateway (`apps/gateway`):

- TLS termination, authentication, rate limiting, tenant injection
- REST routes proxied to modular monolith API
- GraphQL endpoint served by monolith with per-module resolvers
- GraphQL federation deferred to Phase 2 (monolith serves all resolvers in Phase 1)

## Consequences

### Positive

- **Right protocol per job** — REST for integrations and CRUD; GraphQL for composite UI queries
- **Partner ecosystem** — REST + OpenAPI enables SDK generation (TypeScript, Python, Ruby, Go)
- **Web performance** — GraphQL reduces round-trips for dashboard views
- **AI safety** — REST endpoints are deterministic and auditable for agent tool calls
- **Industry alignment** — Stripe (REST), Shopify (REST + GraphQL), GitHub (REST + GraphQL) use same pattern

### Negative

- **Dual maintenance** — every capability may need both REST controller and GraphQL resolver
- **Consistency risk** — REST and GraphQL responses must stay in sync
- **GraphQL complexity** — N+1 query risk, resolver performance monitoring, query depth limiting required
- **Caching differences** — REST benefits from HTTP caching; GraphQL requires client-side cache (TanStack Query)
- **Larger API surface** — more endpoints and schemas to document, test, and version

### Neutral

- GraphQL subscriptions not supported in Phase 1 — real-time via WebSocket/SSE
- GraphQL federation timeline decision deferred to Q3 2026
- Code generation pipeline to minimize dual-maintenance burden (shared application layer, separate presentation)
- API versioning deprecation policy: minimum 12-month sunset for breaking changes