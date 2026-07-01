---
title: Database Conventions
document_id: ATLAS-DB-00
version: 1.0.0
status: approved
phase: 3
last_updated: 2026-06-30
authors:
  - Atlas Platform Engineering Team
related_documents:
  - ATLAS-ARCH-05
  - ATLAS-STD-002
  - 02-platform-core.md
  - 03-identity-auth.md
  - 04-authorization.md
tags:
  - database
  - postgresql
  - conventions
  - rls
  - prisma
---

# Database Conventions

## Purpose

Establish the canonical schema design rules for Atlas BOS Phase 3 database design. Every table, index, constraint, RLS policy, trigger, enum, and Prisma model in the platform must conform to these conventions unless an approved ADR explicitly documents an exception.

This document bridges Phase 1 database architecture (`05-database-architecture.md`) and Phase 3 entity specifications. It defines **how** tables are built; domain documents define **what** entities exist.

## Scope

### In Scope

- PostgreSQL 16 configuration and extensions
- Schema layout (`atlas_core`, module schemas, `atlas_audit`)
- Standard column templates (identity, tenancy, audit, concurrency)
- Soft delete semantics and query patterns
- Optimistic locking (`version` column)
- Audit trigger templates and immutability rules
- RLS policy templates and session context variables
- Enum naming and PostgreSQL type definitions
- Money representation (bigint cents)
- JSONB metadata patterns
- Prisma ORM mapping conventions

### Out of Scope

- Per-domain entity DDL (see `02-*` through `18-*` domain documents)
- Flyway migration orchestration (see `99-migration-strategy.md`)
- Citus shard provisioning runbooks

---

## PostgreSQL Foundation

Atlas uses **PostgreSQL 16** as the authoritative OLTP store. All application services connect through PgBouncer in transaction pooling mode.

### Required Extensions

```sql
-- Bootstrap script: db/migrations/V000__bootstrap_extensions.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";        -- case-insensitive email/text
CREATE EXTENSION IF NOT EXISTS "btree_gist";    -- exclusion constraints, temporal ranges
CREATE EXTENSION IF NOT EXISTS "vector";        -- pgvector for AI embeddings
```

### Schema Layout

| Schema | Purpose | RLS Default |
|--------|---------|-------------|
| `atlas_core` | Platform tables: organizations, users, roles, sessions, billing registry | Mixed (see table classification) |
| `atlas_audit` | Immutable append-only audit tables | Platform admin only |
| `customer` | CRM bounded context | `organization_id` RLS |
| `commercial` | Sales / quotes / orders | `organization_id` RLS |
| `ledger` | Finance / GL / invoices | `organization_id` RLS |
| `workforce` | HR / employees | `organization_id` RLS |
| `delivery` | Projects / tasks | `organization_id` RLS |
| `service` | Support / tickets | `organization_id` RLS |
| `content` | Documents / files | `organization_id` RLS |
| `communication` | Messaging / channels | `organization_id` RLS |
| `campaign` | Marketing | `organization_id` RLS |
| `stock` | Inventory | `organization_id` RLS |
| `obligation` | Legal / contracts | `organization_id` RLS |
| `insight` | Analytics projections | `organization_id` RLS |
| `orchestration` | Workflows / automation | `organization_id` RLS |
| `intelligence` | AI memory / embeddings | `organization_id` RLS |

**Rule:** Platform identity and authorization tables live in `atlas_core`. Business domain tables live in their bounded-context schema. Cross-schema foreign keys are permitted when referencing stable platform identifiers (`organizations`, `users`).

### Tenancy Terminology

Atlas uses a three-level business hierarchy (Workspace → Organization → Team). For **data isolation and RLS**, the tenant key is **`organization_id`**:

| Concept | Column | RLS Boundary |
|---------|--------|--------------|
| Billing / commercial root | `workspace_id` | No RLS on workspace tables |
| Data isolation (tenant) | `organization_id` | **Mandatory RLS** on all business data |
| Permission scope | `team_id` | Authorization layer; not RLS key |

The JWT `tid` claim and HTTP header `X-Atlas-Org-Id` map to `organization_id`. Session context variable `app.organization_id` is set on every transaction.

> **Migration note:** Phase 1 architecture documents reference `tenant_id`. Phase 3 standardizes on `organization_id` to align with business terminology. Application code and events use `organizationId`; legacy `tenantId` aliases are deprecated.

---

## Standard Columns

Every **organization-scoped** mutable table includes the following columns in this order (after domain-specific columns, standard audit block is always last):

```sql
-- Standard column block (organization-scoped tables)
id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
organization_id   UUID NOT NULL REFERENCES atlas_core.organizations(id),
-- ... domain columns ...
created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
deleted_at        TIMESTAMPTZ,                    -- NULL = active row
created_by_id     UUID REFERENCES atlas_core.users(id),
updated_by_id     UUID REFERENCES atlas_core.users(id),
version           INTEGER NOT NULL DEFAULT 1
```

### Column Reference

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| `id` | `UUID` | NO | Surrogate primary key; never exposed as sequential integer |
| `organization_id` | `UUID` | NO | Tenant isolation key; included in all unique constraints |
| `created_at` | `TIMESTAMPTZ` | NO | Immutable creation timestamp (UTC) |
| `updated_at` | `TIMESTAMPTZ` | NO | Last modification; maintained by trigger |
| `deleted_at` | `TIMESTAMPTZ` | YES | Soft delete marker; NULL means active |
| `created_by_id` | `UUID` | YES | Acting user at insert; NULL for system jobs |
| `updated_by_id` | `UUID` | YES | Acting user at last update |
| `version` | `INTEGER` | NO | Optimistic concurrency counter |

### Table Classification

| Category | `organization_id` | Standard Audit Block | RLS |
|----------|-------------------|---------------------|-----|
| Global platform | No | Partial (`created_at` only) | No |
| Workspace-scoped | No (`workspace_id` instead) | Full block | Workspace policies |
| Organization-scoped (tenant) | **Required** | Full block | **Required** |
| Global user identity | No | Partial | User-self policies |
| Append-only audit | Yes | `occurred_at` only | Insert-only |

### Global Platform Table Template

```sql
CREATE TABLE atlas_core.plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    tier            atlas_core.subscription_tier NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_plans_code UNIQUE (code)
);
```

---

## Soft Delete Rules

Atlas defaults to **soft delete** for all organization-scoped business entities. Hard delete is restricted to GDPR erasure workflows and retention purge jobs.

### Deletion Semantics

```sql
-- Application-level soft delete (preferred)
UPDATE customer.contacts
SET
    deleted_at    = now(),
    updated_at    = now(),
    updated_by_id = current_setting('app.user_id', true)::uuid,
    version       = version + 1
WHERE id = $1
  AND organization_id = current_setting('app.organization_id', true)::uuid
  AND deleted_at IS NULL
  AND version = $expected_version;
```

| Rule | Description |
|------|-------------|
| **SD-01** | `DELETE` SQL statements are prohibited in application code for tenant data |
| **SD-02** | All list/search queries include `deleted_at IS NULL` unless `include_deleted` admin flag |
| **SD-03** | Unique constraints use partial indexes: `WHERE deleted_at IS NULL` |
| **SD-04** | FK references do not cascade hard-delete; child soft-delete follows parent via application |
| **SD-05** | Restore sets `deleted_at = NULL`, increments `version`, writes audit `RESTORE` event |
| **SD-06** | Soft-deleted rows retained 30 days (hot), then hard-purged by retention job |
| **SD-07** | Financial/legal records may prohibit soft delete; use status `voided` / `archived` instead |

### Partial Unique Index Pattern

```sql
CREATE UNIQUE INDEX uq_contacts_org_email_active
    ON customer.contacts (organization_id, email)
    WHERE deleted_at IS NULL AND email IS NOT NULL;
```

### Active-Only View Pattern

```sql
CREATE VIEW customer.contacts_active AS
SELECT *
FROM customer.contacts
WHERE deleted_at IS NULL;

-- RLS inherits from base table when security_invoker = true (PG15+)
ALTER VIEW customer.contacts_active SET (security_invoker = true);
```

---

## Optimistic Locking

The `version` column prevents lost updates in concurrent modification scenarios.

### Update Contract

```sql
UPDATE ledger.invoices
SET
    status        = 'posted',
    posted_at     = now(),
    updated_at    = now(),
    updated_by_id = $user_id,
    version       = version + 1
WHERE id = $invoice_id
  AND organization_id = $org_id
  AND version = $client_version      -- client must send current version
  AND deleted_at IS NULL
RETURNING version;                     -- new version returned to client
```

| Rule | Description |
|------|-------------|
| **OL-01** | Every `UPDATE` on mutable entities increments `version` by 1 |
| **OL-02** | API PATCH/PUT requires `version` (or `If-Match` header with version) |
| **OL-03** | Zero rows updated → `409 Conflict` (`VERSION_MISMATCH`) |
| **OL-04** | Bulk updates use row-level locking (`FOR UPDATE`) when version not tracked per row |
| **OL-05** | `version` starts at 1 on insert; never reset |

### Prisma Mapping

```prisma
version Int @default(1)

// Optimistic concurrency in update:
// where: { id, organizationId, version: clientVersion }
// data: { ...fields, version: { increment: 1 } }
```

---

## Audit Triggers and Timestamps

### Updated_at Trigger (Standard)

```sql
CREATE OR REPLACE FUNCTION atlas_core.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to every mutable table:
CREATE TRIGGER trg_contacts_set_updated_at
    BEFORE UPDATE ON customer.contacts
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.set_updated_at();
```

### Row-Level Audit Trigger (Compliance Entities)

For entities requiring immutable change history (permissions, financial postings, HR compensation):

```sql
CREATE OR REPLACE FUNCTION atlas_core.audit_row_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_action TEXT;
    v_changes JSONB;
    v_org_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'CREATE';
        v_changes := to_jsonb(NEW);
        v_org_id := NEW.organization_id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'UPDATE';
        v_changes := atlas_core.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW));
        v_org_id := NEW.organization_id;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'DELETE';
        v_changes := to_jsonb(OLD);
        v_org_id := OLD.organization_id;
    END IF;

    INSERT INTO atlas_audit.entity_change_log (
        organization_id,
        schema_name,
        table_name,
        entity_id,
        action,
        actor_id,
        changes,
        occurred_at
    ) VALUES (
        v_org_id,
        TG_TABLE_SCHEMA,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        v_action,
        NULLIF(current_setting('app.user_id', true), '')::uuid,
        v_changes,
        now()
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_role_permissions_audit
    AFTER INSERT OR UPDATE OR DELETE ON atlas_core.role_permissions
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.audit_row_changes();
```

### Audit Table Immutability

```sql
CREATE TABLE atlas_audit.entity_change_log (
    id              BIGSERIAL PRIMARY KEY,
    organization_id UUID NOT NULL,
    schema_name     TEXT NOT NULL,
    table_name      TEXT NOT NULL,
    entity_id       UUID NOT NULL,
    action          TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'RESTORE')),
    actor_id        UUID,
    changes         JSONB,
    metadata        JSONB NOT NULL DEFAULT '{}',
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent mutation of audit records
CREATE RULE entity_change_log_no_update AS ON UPDATE TO atlas_audit.entity_change_log DO INSTEAD NOTHING;
CREATE RULE entity_change_log_no_delete AS ON DELETE TO atlas_audit.entity_change_log DO INSTEAD NOTHING;
```

**Primary audit path:** Application-level semantic audit interceptor (field-level `{ old, new }` diffs). Database triggers are **defense-in-depth** for support tooling and direct-DB access paths.

---

## Row-Level Security (RLS)

RLS is **mandatory** on all organization-scoped tables. Policies use `FORCE ROW LEVEL SECURITY` so even table owners cannot bypass isolation.

### Session Context Variables

Set at the start of every transaction (via repository middleware):

```sql
SET LOCAL app.organization_id = '550e8400-e29b-41d4-a716-446655440000';
SET LOCAL app.user_id           = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
SET LOCAL app.workspace_id      = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
SET LOCAL app.request_id        = 'req_01HXYZ...';
SET LOCAL app.is_platform_admin = 'false';
```

### Standard Tenant Isolation Policies

```sql
ALTER TABLE customer.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer.contacts FORCE ROW LEVEL SECURITY;

-- SELECT: read own organization rows (including soft-deleted for admin restore)
CREATE POLICY contacts_select ON customer.contacts
    FOR SELECT
    USING (
        organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
        OR current_setting('app.is_platform_admin', true) = 'true'
    );

-- INSERT: may only insert into current organization
CREATE POLICY contacts_insert ON customer.contacts
    FOR INSERT
    WITH CHECK (
        organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
    );

-- UPDATE: may only update own organization rows
CREATE POLICY contacts_update ON customer.contacts
    FOR UPDATE
    USING (
        organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
    )
    WITH CHECK (
        organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
    );

-- DELETE: blocked for application role (soft delete via UPDATE)
CREATE POLICY contacts_delete ON customer.contacts
    FOR DELETE
    USING (
        current_setting('app.is_platform_admin', true) = 'true'
        AND organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
    );
```

### Policy Generator Function

```sql
CREATE OR REPLACE FUNCTION atlas_core.apply_standard_rls(
    p_schema TEXT,
    p_table  TEXT
) RETURNS VOID AS $$
BEGIN
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', p_schema, p_table);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', p_schema, p_table);

    EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR SELECT USING (
            organization_id = NULLIF(current_setting(''app.organization_id'', true), '''')::uuid
            OR current_setting(''app.is_platform_admin'', true) = ''true''
        )',
        p_table || '_select', p_schema, p_table
    );
    -- insert, update, delete policies follow same pattern
END;
$$ LANGUAGE plpgsql;
```

### Database Roles

| Role | RLS Bypass | Usage |
|------|------------|-------|
| `atlas_app` | No | Application connection pool (default) |
| `atlas_readonly` | No | Analytics read replica queries |
| `atlas_migration` | Yes | Flyway migrations only |
| `atlas_platform_admin` | Yes | Internal support tooling; never in app pool |

---

## Enum Naming

PostgreSQL enums use **snake_case** type names scoped to schema. Enum values use **SCREAMING_SNAKE_CASE**.

### Naming Rules

| Rule | Convention | Example |
|------|------------|---------|
| Type name | `{schema}.{entity}_{attribute}` or `{schema}.{concept}` | `atlas_core.organization_status` |
| Values | `SCREAMING_SNAKE_CASE` | `ACTIVE`, `PENDING_VERIFICATION` |
| Prisma enum | `PascalCase` name, `SCREAMING_SNAKE` values | `OrganizationStatus.ACTIVE` |
| Adding values | `ALTER TYPE ... ADD VALUE` (never reorder) | Forward-only migration |

### Standard Platform Enums

```sql
CREATE TYPE atlas_core.organization_status AS ENUM (
    'PROVISIONING',
    'ACTIVE',
    'SUSPENDED',
    'ARCHIVED'
);

CREATE TYPE atlas_core.isolation_tier AS ENUM (
    'SHARED_RLS',
    'DEDICATED_SCHEMA',
    'DEDICATED_CLUSTER'
);

CREATE TYPE atlas_core.principal_type AS ENUM (
    'USER',
    'SERVICE_ACCOUNT',
    'API_KEY',
    'AGENT',
    'OAUTH_APP'
);

CREATE TYPE atlas_core.scope_type AS ENUM (
    'ORGANIZATION',
    'WORKSPACE',
    'TEAM',
    'RESOURCE'
);

CREATE TYPE atlas_core.invitation_status AS ENUM (
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'EXPIRED',
    'REVOKED'
);
```

### Enum vs Lookup Table

| Use Enum When | Use Lookup Table When |
|---------------|----------------------|
| Values are fixed at deploy time | Tenant-customizable values |
| < 20 values, rarely changes | Requires metadata per value |
| No per-tenant variation | Needs soft delete of individual values |

---

## Money (Bigint Cents)

Atlas stores monetary amounts as **`BIGINT` cents** (or smallest currency unit) to avoid floating-point errors.

```sql
-- Column definition
total_amount_cents    BIGINT NOT NULL DEFAULT 0,
currency_code         CHAR(3) NOT NULL DEFAULT 'USD',

CONSTRAINT chk_invoices_amount_non_negative
    CHECK (total_amount_cents >= 0),
CONSTRAINT chk_invoices_currency_valid
    CHECK (currency_code ~ '^[A-Z]{3}$')
```

| Rule | Description |
|------|-------------|
| **M-01** | Column suffix `_cents` or `_amount_cents` mandatory |
| **M-02** | Always pair amount with `currency_code` (ISO 4217) |
| **M-03** | Application `Money` value object: `{ amountCents: bigint, currencyCode: string }` |
| **M-04** | Multi-currency conversion rates stored separately; never float |
| **M-05** | Display formatting happens in presentation layer only |
| **M-06** | `NUMERIC(19,4)` permitted only for FX rates and tax percentages |

### Multi-Currency Line Item Example

```sql
CREATE TABLE commercial.order_line_items (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID NOT NULL,
    order_id              UUID NOT NULL,
    unit_price_cents      BIGINT NOT NULL,
    quantity              NUMERIC(19,6) NOT NULL DEFAULT 1,
    line_total_cents      BIGINT NOT NULL,
    currency_code         CHAR(3) NOT NULL,
    -- audit block ...
    CONSTRAINT chk_line_items_qty_positive CHECK (quantity > 0)
);
```

---

## JSONB Metadata Patterns

JSONB columns store semi-structured, tenant-extensible data. They are **not** a substitute for queryable domain attributes.

### Naming

| Column | Use Case |
|--------|----------|
| `metadata` | Generic extension fields, integration tags |
| `settings` | User/tenant-configurable options |
| `settings_data` | Module-specific configuration blob |
| `attributes` | ABAC / custom field values |
| `payload` | Event/outbox message body |

### Schema Contract

```sql
metadata JSONB NOT NULL DEFAULT '{}',
CONSTRAINT chk_contacts_metadata_is_object
    CHECK (jsonb_typeof(metadata) = 'object'),
CONSTRAINT chk_contacts_metadata_size
    CHECK (octet_length(metadata::text) <= 65536)  -- 64 KB limit
```

### Indexed Metadata (Selective)

```sql
-- GIN index for containment queries (@>, ?)
CREATE INDEX idx_contacts_metadata_gin
    ON customer.contacts USING gin (metadata jsonb_path_ops);

-- Expression index for hot path
CREATE INDEX idx_contacts_metadata_lead_source
    ON customer.contacts ((metadata->>'lead_source'))
    WHERE deleted_at IS NULL;
```

| Rule | Description |
|------|-------------|
| **J-01** | Default `'{}'`; never NULL |
| **J-02** | Max 64 KB per row (configurable per entity); larger blobs → object storage |
| **J-03** | Document expected keys in domain spec; validate at application layer |
| **J-04** | No PII in `metadata` without classification tag |
| **J-05** | Use `jsonb_diff()` helper for audit change tracking |

---

## Prisma Mapping Conventions

Atlas uses Prisma 5.x with PostgreSQL 16. Schema is split across files using `prismaSchemaFolder`.

### Root Schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions", "prismaSchemaFolder"]
}

datasource db {
  provider   = "postgresql"
  url        = env("ATLAS_DATABASE_URL")
  extensions = [pgcrypto, citext, vector]
  schemas    = ["atlas_core", "atlas_audit", "customer", "commercial", "ledger"]
}
```

### Model Conventions

| SQL | Prisma |
|-----|--------|
| `snake_case` table | `PascalCase` model with `@@map("snake_case")` |
| `snake_case` column | `camelCase` field with `@map("snake_case")` |
| `organization_id` | `organizationId` with `@map("organization_id")` |
| PostgreSQL enum | Prisma `enum` with `@@schema("atlas_core")` |
| UUID PK | `String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` |
| TIMESTAMPTZ | `DateTime @db.Timestamptz(6)` |
| BIGINT cents | `BigInt @map("total_amount_cents")` |
| JSONB | `Json @default("{}")` |
| Soft delete | `deletedAt DateTime? @map("deleted_at")` |
| CITEXT | `String @db.Citext` |

### Tenant Model Template

```prisma
model Contact {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String    @map("organization_id") @db.Uuid
  email          String?   @db.Citext
  displayName    String    @map("display_name")
  metadata       Json      @default("{}")
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt      DateTime? @map("deleted_at") @db.Timestamptz(6)
  createdById    String?   @map("created_by_id") @db.Uuid
  updatedById    String?   @map("updated_by_id") @db.Uuid
  version        Int       @default(1)

  organization Organization @relation(fields: [organizationId], references: [id])
  createdBy    User?        @relation("ContactCreatedBy", fields: [createdById], references: [id])
  updatedBy    User?        @relation("ContactUpdatedBy", fields: [updatedById], references: [id])

  @@index([organizationId], map: "idx_contacts_organization_id")
  @@index([organizationId, email], map: "idx_contacts_org_email_active")
  @@map("contacts")
  @@schema("customer")
}
```

### Prisma Rules

| Rule | Description |
|------|-------------|
| **P-01** | Every organization-scoped model has `organizationId` + index |
| **P-02** | Use `@@map` and `@map` for all snake_case alignment |
| **P-03** | RLS is enforced at DB layer; Prisma middleware sets `SET LOCAL` per transaction |
| **P-04** | Do not use `prisma.$executeRaw` without organization context setter |
| **P-05** | Soft delete: `where: { deletedAt: null }` in all default queries |
| **P-06** | Multi-file imports: domain files in `prisma/models/*.prisma` |
| **P-07** | Relation names disambiguate multiple FKs to same table (`CreatedBy`, `UpdatedBy`) |

### Middleware: Organization Context

```typescript
// packages/shared-kernel/src/database/prisma-tenant.middleware.ts
prisma.$use(async (params, next) => {
  if (tenantContext.organizationId) {
    await prisma.$executeRawUnsafe(
      `SET LOCAL app.organization_id = '${tenantContext.organizationId}'`
    );
    await prisma.$executeRawUnsafe(
      `SET LOCAL app.user_id = '${tenantContext.userId ?? ""}'`
    );
  }
  return next(params);
});
```

---

## Index and Constraint Naming

Per `naming-standards.md`:

| Type | Pattern | Example |
|------|---------|---------|
| Index | `idx_{table}_{columns}` | `idx_contacts_organization_id` |
| Unique | `uq_{table}_{columns}` | `uq_contacts_org_email_active` |
| FK | `fk_{table}_{referenced}` | `fk_contacts_organization` |
| Check | `chk_{table}_{description}` | `chk_invoices_amount_non_negative` |
| PK | `{table}_pkey` | `contacts_pkey` |

**Mandatory indexes on organization-scoped tables:**

1. `(organization_id)` — RLS filter
2. `(organization_id, id)` — point lookups
3. Partial unique indexes with `WHERE deleted_at IS NULL`

---

## Cross-References

| Document | Relationship |
|----------|--------------|
| [05-database-architecture.md](../architecture/phase-1/05-database-architecture.md) | Cluster topology, Citus, outbox |
| [naming-standards.md](../standards/naming-standards.md) | Naming conventions |
| [02-platform-core.md](02-platform-core.md) | Organizations, workspaces, teams DDL |
| [03-identity-auth.md](03-identity-auth.md) | Users, sessions, MFA DDL |
| [04-authorization.md](04-authorization.md) | Roles, permissions, policies DDL |
| [prisma/schema.prisma](../../prisma/schema.prisma) | ORM schema entry point |

---

*Document owner: Platform DBA · Review cadence: Per release*