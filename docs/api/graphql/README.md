# Atlas BOS GraphQL API — Conventions & Implementation Guide

**Document ID:** ATLAS-API-GQL-001  
**Phase:** 5  
**Version:** 1.0.0  
**Last Updated:** 2026-06-30  
**Schema:** [schema.graphql](./schema.graphql)

---

## Overview

Atlas exposes a **GraphQL endpoint** at `https://api.atlas.example.com/graphql` for composite reads, dashboard views, and mobile clients. GraphQL complements REST (see [ADR-0006](../../adr/ADR-0006-rest-graphql-hybrid.md)); both protocols share authentication, tenancy, error formats, and the application layer.

| Concern | GraphQL | REST |
|---------|---------|------|
| Dashboard composite queries | ✅ Primary | Secondary |
| Third-party integrations | Secondary | ✅ Primary |
| AI agent tool calls | ❌ | ✅ Primary |
| File upload/download | ❌ (use REST presigned URLs) | ✅ Primary |
| Real-time updates | Subscriptions (Phase 5+) | SSE / WebSocket |

---

## Endpoint & Transport

```
POST https://api.atlas.example.com/graphql
Content-Type: application/json
Authorization: Bearer <jwt>
X-Atlas-Org-Id: <organization-uuid>        # Required for tenant-scoped operations
X-Correlation-Id: <ulid>                   # Recommended
Idempotency-Key: <uuid>                      # Required on mutations
```

### WebSocket Subscriptions

```
wss://api.atlas.example.com/graphql
Connection init payload:
{
  "type": "connection_init",
  "payload": {
    "Authorization": "Bearer <jwt>",
    "X-Atlas-Org-Id": "<organization-uuid>"
  }
}
```

Subscriptions use the [graphql-ws](https://github.com/enisdenjo/graphql-ws) protocol. Clients must re-authenticate on token refresh via `connection_init` re-send.

---

## Naming Conventions

Per [naming-standards.md](../../standards/naming-standards.md):

| Artifact | Convention | Example |
|----------|------------|---------|
| Types | `PascalCase` singular | `Contact`, `SalesOrder` |
| Input types | `{Action}{Entity}Input` | `CreateContactInput` |
| Queries | `camelCase` | `contact`, `contacts`, `invoiceByNumber` |
| Mutations | `{verb}{Entity}` | `createContact`, `confirmSalesOrder` |
| Fields | `camelCase` | `displayName`, `createdAt`, `lineItems` |
| Enums | `PascalCase` name, `SCREAMING_SNAKE` values | `DealStatus.OPEN` |
| Interfaces | `PascalCase` | `Node`, `TenantScoped` |
| Connections | `{Entity}Connection` | `ContactConnection` |

### ID Format

All `ID` scalars are **UUID v4** (or ULID where noted). The global `node(id:)` query resolves any `Node` implementor within the current organization context.

---

## Pagination (Relay Connection Pattern)

All list fields use cursor-based Relay connections:

```graphql
query ContactsPage {
  contacts(first: 25, after: "eyJpZCI6IjAxSkFCQy4uLiJ9", filter: { status: "active" }) {
    edges {
      cursor
      node {
        id
        displayName
        email
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
```

| Rule | Value |
|------|-------|
| Default `first` | 25 |
| Maximum `first` / `last` | 100 |
| Cursor encoding | Base64 JSON `{"id":"<uuid>","sort":"<value>"}` |
| Sort stability | Ties broken by `id ASC` |
| `totalCount` | Exact up to 10,000 rows; approximate above (cached 60s) |

**Do not** use offset pagination. Offset arguments are rejected with `BAD_USER_INPUT`.

---

## Filtering & Sorting

Filter inputs are entity-specific (`ContactFilter`, `DealFilter`, etc.). Global rules:

- String `search` fields use OpenSearch-backed full-text when `search` length ≥ 2
- Enum filters are exact match
- Date ranges are inclusive start, exclusive end (UTC)
- All filters are AND-combined; OR requires explicit `or` input (future)

Default sort: `createdAt DESC` unless documented otherwise on the field.

---

## N+1 Prevention (DataLoader)

GraphQL resolvers **must** use request-scoped DataLoaders. Direct per-row database queries in field resolvers are prohibited.

### Architecture

```
Request → GraphQL Context
            ├── organizationId (from JWT + header)
            ├── userId
            ├── correlationId
            └── loaders: DataLoaderRegistry
                  ├── contactById: DataLoader<ID, Contact>
                  ├── accountById: DataLoader<ID, Account>
                  ├── userById: DataLoader<ID, User>
                  ├── dealsByContactId: DataLoader<ID, Deal[]>
                  └── ...
```

### Implementation Pattern

```typescript
// apps/api/src/graphql/context/create-context.ts
export function createGraphQLContext(req: FastifyRequest): GraphQLContext {
  const loaders = createLoaderRegistry({
    organizationId: req.organizationId,
    prisma: req.prisma,
  });

  return {
    organizationId: req.organizationId,
    userId: req.userId,
    correlationId: req.correlationId,
    loaders,
    prisma: req.prisma,
  };
}

// apps/api/src/graphql/loaders/contact.loader.ts
export function createContactLoader(ctx: LoaderContext) {
  return new DataLoader<string, ContactDto | null>(async (ids) => {
    const contacts = await ctx.prisma.contact.findMany({
      where: {
        organizationId: ctx.organizationId,
        id: { in: [...ids] },
        deletedAt: null,
      },
    });
    const map = new Map(contacts.map((c) => [c.id, c]));
    return ids.map((id) => map.get(id) ?? null);
  }, { maxBatchSize: 100 });
}
```

### DataLoader Rules

| Rule | Description |
|------|-------------|
| **DL-01** | One DataLoader instance per entity per request — never global |
| **DL-02** | Batch size capped at 100 IDs; split larger batches |
| **DL-03** | Loaders enforce `organizationId` in every query |
| **DL-04** | Nullable relations return `null`; lists return `[]` |
| **DL-05** | Connection `totalCount` uses separate `COUNT(*)` — not loader |
| **DL-06** | Loader cache cleared between requests; no cross-request caching |
| **DL-07** | Prisma `include` in loaders only when field always requested (use lookahead) |

### Query Lookahead

For expensive nested fields (`Deal.lineItems`, `Project.tasks`), resolvers use `graphql-parse-resolve-info` to conditionally join:

```typescript
@ResolveField(() => [DealLineItem])
async lineItems(
  @Parent() deal: Deal,
  @Context() ctx: GraphQLContext,
  @Info() info: GraphQLResolveInfo,
) {
  return ctx.loaders.dealLineItemsByDealId.load(deal.id);
}
```

---

## Query Complexity & Depth Limits

GraphQL is vulnerable to expensive queries. Atlas enforces limits at the gateway and API layer.

### Limits (per request)

| Limit | Default | Enterprise override |
|-------|---------|---------------------|
| Max depth | 10 | 15 |
| Max complexity score | 1,000 | 5,000 |
| Max aliases | 10 | 25 |
| Max concurrent resolvers | 50 | 100 |
| Timeout | 30s | 60s |
| Introspection | Disabled in production | Enabled with `graphql:introspect` scope |

### Complexity Cost Table

| Field type | Cost |
|------------|------|
| Scalar / enum leaf | 1 |
| Object field | 2 |
| Connection field | 10 + (5 × `first`) |
| `globalSearch` | 50 |
| `dashboardMetrics` | 30 |
| Subscription field | N/A (separate limits) |

### Example Rejection

```json
{
  "errors": [{
    "message": "Query complexity 1247 exceeds maximum 1000",
    "extensions": {
      "code": "QUERY_TOO_COMPLEX",
      "complexity": 1247,
      "maxComplexity": 1000
    }
  }]
}
```

### Persisted Queries (APQ)

Production clients should use **Automatic Persisted Queries**:

1. Client sends `extensions.persistedQuery.sha256Hash` only
2. Server returns full query on cache miss (`PERSISTED_QUERY_NOT_FOUND`)
3. Client resends with full query body once

This reduces payload size and blocks ad-hoc query injection.

---

## Authentication & Authorization

### Authentication

| Method | Support | Notes |
|--------|---------|-------|
| JWT Bearer | ✅ | Primary; OIDC via Atlas Auth |
| API Key | ✅ | Scoped; no subscriptions |
| Session cookie | ✅ | Web app only; SameSite strict |

JWT claims used by resolvers:

```json
{
  "sub": "user-uuid",
  "oid": "organization-uuid",
  "wid": "workspace-uuid",
  "permissions": ["crm:contacts:read", "crm:deals:write"],
  "scp": ["openid", "profile"]
}
```

### Authorization

Every resolver invokes the shared authorization service (OPA-backed):

```typescript
@Query(() => Contact)
@RequirePermission('crm:contacts:read')
async contact(@Args('id') id: string, @Context() ctx: GraphQLContext) {
  return ctx.loaders.contactById.load(id);
}
```

| Rule | Description |
|------|-------------|
| **AZ-01** | Organization context mandatory on all `TenantScoped` types |
| **AZ-02** | Field-level auth on sensitive fields (`Employee.compensation`) |
| **AZ-03** | Subscriptions filtered server-side by `organizationId` + permissions |
| **AZ-04** | Cross-org access returns `null` (not 403) on single-entity queries |
| **AZ-05** | List queries return empty connection when permission denied |

### ABAC / Resource Grants

Resource-scoped permissions (e.g., deal owner-only) are evaluated in the application layer after DataLoader fetch. Denied resources are omitted from connections.

---

## Mutations

### Optimistic Concurrency

All update/delete mutations require `version` (maps to DB `version` column):

```graphql
mutation UpdateDeal {
  updateDeal(input: {
    id: "550e8400-e29b-41d4-a716-446655440000"
    version: 3
    stage: NEGOTIATION
  }) {
    id
    stage
    version
  }
}
```

Version mismatch → `extensions.code: VERSION_MISMATCH` (HTTP 409).

### Idempotency

Mutations honor `Idempotency-Key` header (24h TTL). Replayed responses include `X-Idempotent-Replayed: true`.

### Error Format

```json
{
  "data": {
    "createContact": {
      "contact": null,
      "errors": [{
        "code": "VALIDATION_ERROR",
        "message": "Email already exists",
        "details": [{ "field": "email", "code": "DUPLICATE", "message": "..." }]
      }]
    }
  }
}
```

Top-level errors use RFC 7807 Problem Details in `extensions`:

```json
{
  "errors": [{
    "message": "Unauthorized",
    "extensions": {
      "type": "https://api.atlas.example.com/problems/unauthorized",
      "status": 401,
      "code": "UNAUTHORIZED",
      "correlationId": "01JABC..."
    }
  }]
}
```

---

## Subscriptions

| Subscription | Filter args | Transport |
|--------------|-------------|-----------|
| `dealUpdated` | `organizationId`, `pipelineId?` | WebSocket |
| `taskUpdated` | `organizationId`, `projectId?` | WebSocket |
| `notificationReceived` | `userId` | WebSocket |
| `aiMessageStream` | `conversationId` | WebSocket (streaming) |

### Authorization

- Client may only subscribe to resources within their `organizationId`
- `userId` subscription args must match authenticated user (or admin)
- Events are filtered at publish time — not client-side

### Scaling

Subscription fan-out uses Redis Pub/Sub (single-region) with Kafka bridge for cross-region. See [13-messaging.md](../../architecture/phase-1/13-messaging.md).

---

## Caching

| Layer | Strategy |
|-------|----------|
| HTTP | `POST` only — no CDN caching |
| DataLoader | Request-scoped memoization |
| Apollo Client / TanStack Query | Client-side normalized cache |
| `dashboardMetrics` | Server 60s TTL per org |
| `totalCount` | Server 60s TTL per query hash |

Entity `version` field enables client cache invalidation on mutation success.

---

## Rate Limiting

GraphQL rate limits are **cost-weighted**:

```
effective_cost = base_cost + (complexity / 100)
```

| Tier | Points/min | Burst |
|------|------------|-------|
| Free | 300 | 500 |
| Starter | 1,500 | 2,500 |
| Growth | 5,000 | 8,000 |
| Business | 25,000 | 40,000 |
| Enterprise | Custom | Custom |

Exceeded limits return `429` with `Retry-After` header.

---

## Observability

| Signal | Implementation |
|--------|----------------|
| Tracing | OpenTelemetry spans per resolver (`graphql.resolve.{fieldName}`) |
| Metrics | `atlas_graphql_request_duration_seconds`, `atlas_graphql_complexity_score` |
| Logging | Structured JSON; no query bodies in production logs |
| Slow query alert | p99 > 2s or complexity > 800 |

Correlation ID (`X-Correlation-Id`) is attached to all resolver spans and error extensions.

---

## Code Generation

```bash
# Generate TypeScript types from SDL
pnpm --filter @atlas/api graphql:codegen

# Outputs:
# packages/api-contracts/src/graphql/generated.ts
# apps/api/src/graphql/resolvers/*.generated.ts (stubs)
```

Resolvers implement generated interfaces; business logic stays in the shared application layer (`packages/modules/*`).

---

## Testing

| Test type | Location | Purpose |
|-----------|----------|---------|
| Schema snapshot | `schema.graphql` diff in CI | Breaking change detection |
| Resolver unit | `*.resolver.spec.ts` | Loader batching, auth |
| Integration | `*.graphql.integration.spec.ts` | End-to-end with test DB |
| Complexity | `graphql-complexity.spec.ts` | Limit enforcement |
| Contract | `*.contract.spec.ts` | SDL ↔ OpenAPI field parity |

---

## Versioning & Deprecation

- Schema changes follow **expand-contract** pattern
- Deprecated fields annotated with `@deprecated(reason: "...")` — minimum 12-month sunset
- Breaking changes require new URL version (`/v2/graphql`) or date-stamped schema (`@specifiedBy`)
- [schema.graphql](./schema.graphql) is the authoritative SDL; checked into CI

---

## Cross-References

| Document | Relationship |
|----------|--------------|
| [schema.graphql](./schema.graphql) | Canonical SDL |
| [ADR-0006](../../adr/ADR-0006-rest-graphql-hybrid.md) | Protocol selection |
| [naming-standards.md](../../standards/naming-standards.md) | Naming rules |
| [events/catalog.md](../events/catalog.md) | Domain events feeding subscriptions |
| [06-api-architecture.md](../../architecture/phase-1/06-api-architecture.md) | Gateway architecture |

---

*Document owner: API Platform Team · Review cadence: Per release*