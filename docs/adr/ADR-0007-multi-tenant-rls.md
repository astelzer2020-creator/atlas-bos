# ADR-0007: Multi-Tenant Isolation with RLS

**Status:** Accepted
**Date:** 2026-06-30
**Deciders:** Chief Software Architect, Security Team, Data Architecture Team
**Related:** [05-database-architecture.md](../architecture/phase-1/05-database-architecture.md), [ADR-0002](./ADR-0002-postgresql-primary-oltp.md), [ADR-0005](./ADR-0005-rbac-abac-opa.md)

## Context

Atlas BOS is a multi-tenant SaaS platform that must serve millions of organizations on shared infrastructure while guaranteeing **zero cross-tenant data leakage**. A single bug in application code, a misconfigured query, or a compromised API endpoint must never expose one tenant's data to another.

Multi-tenant isolation strategies:

| Strategy | Isolation Level | Cost | Complexity |
|----------|----------------|------|------------|
| **Database per tenant** | Highest | Very high at scale | Connection pool explosion, migration coordination |
| **Schema per tenant** | High | High at scale | Schema proliferation, migration overhead |
| **Shared schema + RLS** | Medium-High (with defense in depth) | Low | Requires disciplined RLS policies |
| **Application-level only** | Low | Low | Single bug = data breach |
| **Shared schema + discriminator column (no RLS)** | Low | Low | No database-level safety net |

Atlas must optimize for cost efficiency at scale (millions of small-to-medium tenants) while meeting enterprise isolation requirements (dedicated resources for large tenants).

Compliance requirements (SOC 2, GDPR, HIPAA) mandate defense-in-depth: application-level checks **plus** database-level enforcement.

## Decision

Atlas implements **multi-tenant isolation** using a **hybrid model** with **PostgreSQL Row-Level Security (RLS)** as the primary mechanism:

### Standard Tier: Shared Schema + RLS

- All standard and professional-tier tenants share PostgreSQL schema (`atlas_core` and per-module schemas)
- Every tenant-scoped table includes mandatory `tenant_id UUID NOT NULL` column
- **RLS policies** on every tenant-scoped table enforce `tenant_id = current_setting('app.tenant_id')::uuid`
- RLS is **forced** (`FORCE ROW LEVEL SECURITY`) — even table owners cannot bypass
- Application middleware sets `app.tenant_id` via `SET LOCAL` on every database connection
- All unique constraints include `tenant_id` (e.g., `UNIQUE (tenant_id, external_id)`)

### Enterprise Tier: Schema-per-Tenant or Dedicated Instance

- Enterprise customers may receive dedicated PostgreSQL schema or instance
- Same RLS policies applied as additional safety layer
- Data residency requirements met via regional dedicated instances

### Defense in Depth Layers

```
Layer 1: API Gateway     → JWT validation, tenant ID extraction
Layer 2: Application      → Tenant context middleware, query filtering
Layer 3: Authorization    → OPA policies include tenant_id attribute (ADR-0005)
Layer 4: Database (RLS)   → PostgreSQL enforces tenant_id on every query
Layer 5: Network          → VPC isolation, encryption in transit
```

### Session Context Injection

Every database connection executes immediately after acquisition:

```sql
SET LOCAL app.tenant_id = '{tenant_uuid}';
SET LOCAL app.user_id   = '{user_uuid}';
SET LOCAL app.request_id = '{correlation_id}';
```

### Platform Admin Bypass

- Dedicated role `atlas_platform_admin` bypasses RLS for migrations, support tooling, cross-tenant analytics (anonymized)
- This role is **never** exposed to application connection pools
- All platform admin queries logged and audited

### Sharding

- Citus extension partitions by `tenant_id` hash for horizontal scaling
- RLS policies compatible with Citus distributed tables

## Consequences

### Positive

- **Defense in depth** — even if application code has a bug, RLS prevents cross-tenant data access
- **Cost efficient** — shared infrastructure for millions of small tenants
- **Compliance ready** — database-level isolation satisfies SOC 2, GDPR audit requirements
- **Simple operations** — single database cluster, unified migrations, shared connection pools
- **Proven pattern** — used by Slack, Instacart, and other multi-tenant SaaS at scale
- **Testable** — RLS policies verified in integration tests with multiple tenant contexts

### Negative

- **Performance overhead** — RLS adds query planning overhead (~5-10% on complex queries)
- **Policy maintenance** — every new table requires RLS policy creation and testing
- **Debugging complexity** — queries returning empty results may be RLS filtering, not missing data
- **Migration risk** — forgetting RLS on a new table creates a security vulnerability
- **Enterprise tier complexity** — hybrid model requires routing logic for dedicated vs shared tenants

### Neutral

- CI check validates every tenant-scoped table has RLS enabled
- Integration test suite includes cross-tenant isolation tests on every PR
- `tenant_id` indexing strategy documented in database architecture
- Enterprise dedicated instance provisioning automated via Terraform