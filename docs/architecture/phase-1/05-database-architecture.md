---
title: Database Architecture
document_id: ATLAS-ARCH-05
version: 1.0.0
status: approved
phase: 1
last_updated: 2026-06-30
authors:
  - Atlas Platform Architecture Team
related_documents:
  - ATLAS-ARCH-02
  - ATLAS-ARCH-03
  - ATLAS-ARCH-06
  - ATLAS-ARCH-07
  - ATLAS-ARCH-08
  - ATLAS-ARCH-25
tags:
  - database
  - postgresql
  - multi-tenant
  - rls
  - citus
  - migrations
---

# Database Architecture

## Purpose

Define the canonical data persistence architecture for Atlas — a multi-tenant Business Operating System that must scale from startup tenants to enterprise deployments while maintaining strict data isolation, auditability, and operational reliability. This document establishes how PostgreSQL serves as the primary OLTP store, how tenant boundaries are enforced, how the system scales horizontally, and how data lifecycle concerns (migrations, retention, backup, archival) are handled.

## Scope

### In Scope

- Multi-tenant data isolation (shared schema with RLS, schema-per-tenant for enterprise)
- PostgreSQL cluster topology: primary, read replicas, connection pooling (PgBouncer)
- Horizontal sharding strategy using Citus (`tenant_id` hash partitioning)
- Schema design conventions: `tenant_id`, audit columns, soft delete, temporal tables
- Transactional outbox pattern for reliable event publishing
- Migration strategy (Flyway), zero-downtime deployment patterns
- Read/write splitting and query routing
- Data retention, archival to cold storage, and backup overview
- Schema versioning and compatibility rules
- Integration with Redis (cache/session), OpenSearch (search index), pgvector (embeddings)

### Out of Scope

- Per-module entity-relationship diagrams (Phase 3 — Database Design)
- Specific index definitions per table (Phase 3)
- Infrastructure provisioning details (see `03-infrastructure-architecture.md`)
- Application-level ORM configuration and repository patterns (see `02-software-architecture.md`)
- Disaster recovery runbooks (see `25-disaster-recovery.md`)

## Context

Atlas consolidates CRM, ERP, accounting, HR, project management, documents, messaging, AI, and dozens of other business domains into a single platform. All modules share a unified identity model, authorization layer, and event bus. The database layer must:

1. **Isolate tenants** — prevent cross-tenant data leakage under any query path
2. **Scale elastically** — support millions of organizations without per-tenant database sprawl for standard tiers
3. **Remain operable** — migrations, backups, and restores must not require downtime for routine changes
4. **Support compliance** — audit trails, data retention, right-to-erasure, and enterprise data residency
5. **Enable intelligence** — vector embeddings colocated with business data via pgvector

The platform stack specifies PostgreSQL as primary OLTP, Redis for cache/sessions, OpenSearch for full-text search, and pgvector for embeddings. TypeScript backend services connect through PgBouncer with explicit read/write routing.

### Design Principles

| Principle | Implementation |
|-----------|----------------|
| Tenant isolation by default | `tenant_id` on every tenant-scoped table + RLS policies |
| Defense in depth | Application middleware sets `app.tenant_id`; RLS enforces at DB layer |
| Single source of truth | PostgreSQL is authoritative; search/vector indexes are derived |
| Append-friendly history | Audit tables + temporal tables for point-in-time reconstruction |
| Safe schema evolution | Forward-only migrations, expand-contract pattern, versioned contracts |
| Observable data plane | Query metrics, slow-query logging, connection pool saturation alerts |

---

## Detailed Design

### 1. Multi-Tenant Data Isolation Strategy

Atlas uses a **hybrid tenancy model** optimized for cost efficiency at scale while meeting enterprise isolation requirements.

#### 1.1 Standard Tier: Shared Schema + Row-Level Security (RLS)

All standard and professional-tier tenants share a single PostgreSQL schema (`atlas_core`). Every tenant-scoped table includes a mandatory `tenant_id UUID NOT NULL` column, indexed and included in all unique constraints.

```sql
-- Example: contacts table (illustrative)
CREATE TABLE atlas_core.contacts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES atlas_core.tenants(id),
    external_id   TEXT,
    email         CITEXT,
    display_name  TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ,
    created_by    UUID,
    updated_by    UUID,
    version       INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT contacts_tenant_external_id_unique
        UNIQUE (tenant_id, external_id) WHERE external_id IS NOT NULL
);

CREATE INDEX idx_contacts_tenant_id ON atlas_core.contacts (tenant_id);
CREATE INDEX idx_contacts_tenant_email ON atlas_core.contacts (tenant_id, email)
    WHERE deleted_at IS NULL;
```

**RLS Policy Model:**

```sql
ALTER TABLE atlas_core.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas_core.contacts FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON atlas_core.contacts
    FOR SELECT
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_insert ON atlas_core.contacts
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_update ON atlas_core.contacts
    FOR UPDATE
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_delete ON atlas_core.contacts
    FOR DELETE
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

**Session Context Injection:**

Every database connection from application services executes a transaction-scoped context setter immediately after acquiring a connection:

```sql
SET LOCAL app.tenant_id = '550e8400-e29b-41d4-a716-446655440000';
SET LOCAL app.user_id   = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
SET LOCAL app.request_id = 'req_01HXYZ...';
```

A dedicated **platform admin role** (`atlas_platform_admin`) bypasses RLS only for internal operations (migrations, support tooling, cross-tenant analytics on anonymized aggregates). This role is never exposed to application connection pools.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Tenant Isolation — Defense in Depth              │
├─────────────────────────────────────────────────────────────────────┤
│  API Gateway          │  Validates JWT, extracts tenant_id claim   │
├───────────────────────┼─────────────────────────────────────────────┤
│  Application Layer    │  Repository queries always include tenant_id│
│  (TypeScript)         │  SET LOCAL app.tenant_id on every txn       │
├───────────────────────┼─────────────────────────────────────────────┤
│  PostgreSQL RLS       │  FORCE ROW LEVEL SECURITY on all tables     │
├───────────────────────┼─────────────────────────────────────────────┤
│  Citus Distribution   │  tenant_id as distribution key (shard col)  │
├───────────────────────┼─────────────────────────────────────────────┤
│  Integration Tests    │  Cross-tenant leakage test suite (CI gate)  │
└─────────────────────────────────────────────────────────────────────┘
```

#### 1.2 Enterprise Tier: Schema-Per-Tenant

Enterprise customers requiring contractual data isolation, dedicated encryption keys, or data residency receive a **dedicated PostgreSQL schema** (or dedicated database cluster for largest accounts):

| Isolation Level | Use Case | Implementation |
|-----------------|----------|----------------|
| `shared_rls` | Standard, Professional | Shared schema, RLS |
| `dedicated_schema` | Enterprise (default) | `tenant_<uuid>` schema, same cluster |
| `dedicated_cluster` | Enterprise Plus, regulated | Separate PostgreSQL instance per tenant |

**Schema-per-tenant provisioning flow:**

1. Tenant upgraded to Enterprise → provisioning job creates `tenant_<uuid>` schema
2. Flyway migrations run against tenant schema (same migration scripts, different schema target)
3. Connection router selects schema based on `tenants.isolation_tier` registry entry
4. RLS still enabled within dedicated schema as defense-in-depth for future table sharing

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Shared Cluster  │     │  Shared Cluster  │     │ Dedicated Cluster│
│  atlas_core      │     │ tenant_abc123    │     │ tenant_xyz789    │
│  (RLS, 99% tenants)│   │ (Enterprise)     │     │ (Enterprise Plus)│
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

#### 1.3 Global vs Tenant-Scoped Tables

| Category | Examples | `tenant_id` | RLS |
|----------|----------|-------------|-----|
| Global platform | `plans`, `feature_flags`, `system_config` | No | No (read-only for apps) |
| Tenant registry | `tenants`, `tenant_settings` | Self-referential | Platform admin only |
| Tenant-scoped | All business entities | Required | Required |
| Cross-tenant (internal) | `platform_audit_log`, `billing_aggregates` | Optional | Platform admin only |

---

### 2. Sharding Strategy (Citus)

When a single PostgreSQL primary approaches vertical scaling limits (~2–4 TB active data, >50K TPS), Atlas adopts **Citus** for horizontal sharding with `tenant_id` as the distribution column.

#### 2.1 Distribution Model

```sql
-- Citus setup (illustrative)
SELECT create_distributed_table('atlas_core.contacts', 'tenant_id');
SELECT create_distributed_table('atlas_core.invoices', 'tenant_id');
SELECT create_distributed_table('atlas_core.projects', 'tenant_id');
-- Reference tables (small, read-heavy, global)
SELECT create_reference_table('atlas_core.currencies');
SELECT create_reference_table('atlas_core.countries');
```

**Shard Key Selection Rules:**

- **Always `tenant_id`** for tenant-scoped tables — ensures all tenant data co-locates on one shard
- **No cross-shard joins** on hot paths — queries must filter by `tenant_id` first
- **Reference tables** for small global lookup data replicated to all workers
- **Avoid distributing** tables without `tenant_id` unless explicitly platform-global

#### 2.2 Shard Topology

```
                    ┌─────────────────┐
                    │  Citus Coordinator │
                    │  (Query Router)    │
                    └────────┬──────────┘
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │  Worker 1   │   │  Worker 2   │   │  Worker N   │
    │ Shards 1-32 │   │ Shards 33-64│   │ Shards ...  │
    │ tenant hash │   │ tenant hash │   │ tenant hash │
    └─────────────┘   └─────────────┘   └─────────────┘
```

**Tenant-to-Shard Mapping:**

- Citus uses consistent hashing on `tenant_id`
- Large enterprise tenants (dedicated cluster) are excluded from Citus pool
- Rebalancing triggered when shard size exceeds 80% capacity threshold

#### 2.3 Shard Migration & Tenant Rebalancing

| Operation | Trigger | Process |
|-----------|---------|---------|
| Add worker node | Shard utilization > 75% | Citus rebalance shards |
| Tenant hot-spot | Single tenant > 10% shard I/O | Evaluate dedicated cluster upgrade |
| Region expansion | Latency SLA breach | Deploy regional Citus coordinator + workers |

---

### 3. Read/Write Splitting and Connection Pooling

#### 3.1 Topology

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────────────┐
│ App Services│────▶│  PgBouncer  │────▶│  PostgreSQL Primary (RW)    │
│ (TypeScript)│     │  (Transaction│     └──────────────┬──────────────┘
└─────────────┘     │   Pool Mode) │                    │ streaming replication
                    └──────┬──────┘                    ▼
                           │              ┌─────────────────────────────┐
                           └─────────────▶│  Read Replicas (RO) × N      │
                                          │  (async, lag-monitored)      │
                                          └─────────────────────────────┘
```

#### 3.2 Connection Pooling (PgBouncer)

| Setting | Value | Rationale |
|---------|-------|-----------|
| Pool mode | `transaction` | Releases connection after each transaction; compatible with `SET LOCAL` |
| Default pool size | 20 per service per AZ | Prevents connection exhaustion |
| Max client connections | 10,000 | Supports high pod count |
| Server idle timeout | 600s | Reclaim unused backend connections |
| Query timeout | 30s (API), 300s (batch) | Prevent runaway queries |

**PgBouncer deployment:** One PgBouncer pool per availability zone, colocated with application pods. Separate pools for:

- `atlas_rw` — primary writes and strongly consistent reads
- `atlas_ro` — read replicas for eventually consistent queries
- `atlas_migration` — dedicated low-concurrency pool for Flyway (bypasses app pools)

#### 3.3 Read/Write Routing Rules

| Query Type | Target | Consistency |
|------------|--------|-------------|
| INSERT, UPDATE, DELETE | Primary | Strong |
| SELECT after write (same request) | Primary | Read-your-writes |
| List/search dashboards | Read replica | Eventual (≤5s lag SLA) |
| Reporting / analytics | Read replica or warehouse | Eventual |
| Background jobs (idempotent) | Read replica | Eventual |
| Financial transactions, invoicing | Primary only | Strong |

**Read-your-writes enforcement:** After any mutation in a request context, a request-scoped flag `force_primary_reads = true` routes subsequent SELECTs to primary for that HTTP request/session.

**Replica lag circuit breaker:** If replica lag exceeds 30 seconds, router automatically falls back to primary for read traffic and alerts on-call.

---

### 4. Migration Strategy

Atlas uses **Flyway** for versioned, forward-only SQL migrations with zero-downtime deployment patterns.

#### 4.1 Migration Repository Structure

```
db/
├── migrations/
│   ├── V001__create_tenants.sql
│   ├── V002__create_contacts.sql
│   ├── V003__add_contacts_rls.sql
│   └── ...
├── repeatable/
│   ├── R__refresh_materialized_views.sql
│   └── R__sync_reference_data.sql
├── callbacks/
│   ├── beforeMigrate.sql
│   └── afterMigrate.sql
└── enterprise/
    └── (schema-per-tenant migration orchestration)
```

#### 4.2 Zero-Downtime Migration Patterns (Expand-Contract)

| Phase | Action | Downtime |
|-------|--------|----------|
| **Expand** | Add new column/table (nullable or with default) | None |
| **Dual-write** | Application writes to old and new | None |
| **Backfill** | Background job populates new column | None |
| **Dual-read** | Application reads from new, falls back to old | None |
| **Contract** | Remove old column after verification | None |

**Prohibited in production migrations:**

- `DROP COLUMN` without prior expand-contract cycle
- `ALTER COLUMN ... TYPE` on large tables without new column approach
- Table rewrites without `CONCURRENTLY` index builds
- Long-running locks — all migrations must complete in < 5s lock hold time

#### 4.3 Migration Execution Pipeline

```
┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│ CI: Lint │───▶│ Staging Apply│───▶│ Canary Apply│───▶│ Production   │
│ + Dry Run│    │ + Integration│    │ (1 shard)   │    │ Rolling Apply│
└──────────┘    └──────────────┘    └─────────────┘    └──────────────┘
```

**Flyway configuration:**

- `flyway.validateOnMigrate=true`
- `flyway.outOfOrder=false`
- Checksum validation on every deploy
- Separate Flyway history table per schema (`flyway_schema_history`, `flyway_tenant_<uuid>_history`)

#### 4.4 Liquibase Evaluation

Liquibase was evaluated but Flyway was selected for Phase 1 (see Alternatives Considered). Migration files remain plain SQL for transparency and code review.

---

### 5. Audit Tables, Soft Delete, and Temporal Tables

#### 5.1 Standard Audit Columns

Every tenant-scoped mutable table includes:

| Column | Type | Purpose |
|--------|------|---------|
| `created_at` | `TIMESTAMPTZ` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | Last modification timestamp |
| `created_by` | `UUID` | Actor who created |
| `updated_by` | `UUID` | Actor who last modified |
| `deleted_at` | `TIMESTAMPTZ` | Soft delete marker (NULL = active) |
| `version` | `INTEGER` | Optimistic concurrency control |

**Soft delete policy:**

- Default deletion is soft: `UPDATE ... SET deleted_at = now(), updated_by = $user`
- All application queries include `WHERE deleted_at IS NULL` (enforced via repository layer + DB views)
- Hard delete only via GDPR erasure workflow or retention purge jobs
- Unique constraints use partial indexes: `WHERE deleted_at IS NULL`

#### 5.2 Audit Log Tables (Append-Only)

For compliance-sensitive entities (financial records, permissions, HR data, contracts), Atlas maintains append-only audit tables:

```sql
CREATE TABLE atlas_core.audit_log (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    entity_type     TEXT NOT NULL,        -- e.g., 'invoice', 'contact'
    entity_id       UUID NOT NULL,
    action          TEXT NOT NULL,        -- CREATE, UPDATE, DELETE, RESTORE
    actor_id        UUID,
    actor_type      TEXT NOT NULL,        -- user, system, api_key, agent
    changes         JSONB,                -- { field: { old, new } }
    metadata        JSONB,                -- IP, user_agent, request_id
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_tenant_entity
    ON atlas_core.audit_log (tenant_id, entity_type, entity_id, occurred_at DESC);
```

**Audit capture mechanisms:**

1. **Application-level audit interceptor** — primary method; captures semantic field-level changes
2. **Database triggers** — fallback for direct-DB access paths (support tooling only)
3. **Authorization decision log** — separate `authz_audit_log` (see `08-authorization.md`)

Audit logs are **immutable** — no UPDATE or DELETE permitted; retention managed by archival jobs.

#### 5.3 Temporal Tables (System-Versioned)

For entities requiring point-in-time reconstruction (contracts, pricing, org structure, tax configuration), Atlas uses PostgreSQL temporal tables:

```sql
CREATE TABLE atlas_core.contracts (
    id          UUID NOT NULL,
    tenant_id   UUID NOT NULL,
    terms       JSONB NOT NULL,
    valid_from  TIMESTAMPTZ NOT NULL,
    valid_to    TIMESTAMPTZ NOT NULL DEFAULT 'infinity',
    PRIMARY KEY (id, valid_from)
);

-- Query as-of timestamp
SELECT * FROM atlas_core.contracts
WHERE id = $1 AND tenant_id = $2
  AND valid_from <= $as_of AND valid_to > $as_of;
```

**Temporal table usage criteria:**

- Required for legal/financial configuration changes
- Required when "what did we know at time T?" is a compliance question
- Not applied to high-churn tables (messages, activity feeds) — use audit log instead

---

### 6. Event Outbox Pattern

Atlas uses the **transactional outbox** to guarantee at-least-once delivery of domain events without dual-write inconsistencies.

#### 6.1 Outbox Table Schema

```sql
CREATE TABLE atlas_core.event_outbox (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    aggregate_type  TEXT NOT NULL,
    aggregate_id    UUID NOT NULL,
    event_type      TEXT NOT NULL,
    event_version   INTEGER NOT NULL DEFAULT 1,
    payload         JSONB NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at    TIMESTAMPTZ,
    publish_attempts INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT
);

CREATE INDEX idx_outbox_unpublished
    ON atlas_core.event_outbox (created_at)
    WHERE published_at IS NULL;
```

#### 6.2 Outbox Flow

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Service    │    │  PostgreSQL      │    │  Outbox Relay   │
│  Business   │───▶│  BEGIN           │    │  (Debezium /    │
│  Logic      │    │  UPDATE entity   │    │   polling worker)│
│             │    │  INSERT outbox   │    └────────┬────────┘
│             │    │  COMMIT          │             │
└─────────────┘    └──────────────────┘             ▼
                                          ┌─────────────────┐
                                          │  Event Bus      │
                                          │  (Kafka/NATS)   │
                                          └────────┬────────┘
                                                   ▼
                                          ┌─────────────────┐
                                          │  Consumers:     │
                                          │  Search, Notify,│
                                          │  Webhooks, AI   │
                                          └─────────────────┘
```

**Relay implementation options (Phase 1 decision: polling worker; Debezium at scale):**

1. **Polling relay** — `SELECT ... WHERE published_at IS NULL ORDER BY created_at LIMIT 1000 FOR UPDATE SKIP LOCKED`
2. **Debezium CDC** — Change Data Capture from WAL for high-throughput (≥10K events/sec)

**Idempotency:** Consumers must handle duplicate events using `(tenant_id, event_id)` deduplication keys stored in Redis or a `processed_events` table.

---

### 7. Data Retention and Archival

#### 7.1 Retention Tiers

| Data Category | Hot (PostgreSQL) | Warm (PostgreSQL) | Cold (S3/Glacier) |
|---------------|------------------|-------------------|-------------------|
| Active business records | Indefinite | — | — |
| Soft-deleted records | 30 days | — | Purge |
| Audit logs | 2 years | 2–7 years | 7+ years |
| Session/activity logs | 90 days | — | Archive |
| Event outbox (published) | 7 days | — | Purge |
| AI conversation history | 1 year | 1–3 years | Per tenant policy |
| File metadata | Indefinite | — | Blob in S3 (see Storage doc) |

#### 7.2 Archival Pipeline

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Retention    │───▶│ Export to    │───▶│ Verify       │───▶│ Delete from  │
│ Policy Engine│    │ Parquet/JSON │    │ Checksum     │    │ PostgreSQL   │
│ (per tenant) │    │ → S3 bucket  │    │ + manifest   │    │ (hard delete)│
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

**Tenant-configurable retention:** Enterprise tenants may extend retention periods via `tenant_settings.data_retention_policy` JSON document. GDPR erasure requests override retention — cascade delete within 30-day SLA.

#### 7.3 Cold Storage Format

- **Format:** Apache Parquet with Snappy compression, partitioned by `tenant_id/year/month`
- **Encryption:** SSE-KMS with per-tenant or per-region keys
- **Retrieval:** Restore jobs rehydrate to a temporary PostgreSQL schema for legal discovery

---

### 8. Backup Strategy Overview

| Backup Type | Frequency | Retention | RTO Target | RPO Target |
|-------------|-----------|-----------|------------|------------|
| Continuous WAL archiving | Real-time | 30 days | — | < 1 min |
| Full base backup | Daily | 90 days | 4 hours | 24 hours |
| Snapshot (volume) | Hourly | 7 days | 1 hour | 1 hour |
| Cross-region replica | Continuous | N/A | 15 min | < 5 min |
| Logical export (per tenant) | Weekly | Per contract | 8 hours | 7 days |

**Backup architecture:**

```
┌─────────────────┐     WAL stream      ┌─────────────────┐
│  PostgreSQL     │────────────────────▶│  S3 WAL Archive │
│  Primary        │                     │  (encrypted)    │
└────────┬────────┘                     └─────────────────┘
         │ pg_basebackup (daily)
         ▼
┌─────────────────┐     cross-region    ┌─────────────────┐
│  S3 Full Backup │────────────────────▶│  DR Region S3   │
└─────────────────┘                     └─────────────────┘
```

**Backup verification:** Monthly automated restore to isolated environment with data integrity checks. Enterprise tenants may request backup restore drills.

Detailed runbooks: `25-disaster-recovery.md`.

---

### 9. Schema Versioning

#### 9.1 Versioning Model

| Layer | Version Identifier | Compatibility Rule |
|-------|-------------------|-------------------|
| Database schema | Flyway `V<NNN>__` prefix | Forward-only; no downgrade |
| Event payloads | `event_version` integer | N and N-1 supported |
| API contracts | URL version + header (see API doc) | 12-month deprecation window |
| Application code | Git SHA + migration version gate | Deploy blocked if migration pending |

#### 9.2 Schema Compatibility Contract

1. **Additive changes are safe** — new tables, nullable columns, new indexes (`CONCURRENTLY`)
2. **Breaking changes require expand-contract** — never drop/rename in a single release
3. **Feature flags gate new schema usage** — code deploys before schema, or vice versa, never ambiguous state
4. **Migration version gate** — application health check verifies `flyway_schema_history` max version ≥ required version

#### 9.3 Multi-Schema Version Sync

For enterprise schema-per-tenant deployments, a **migration orchestrator** tracks per-tenant schema versions:

```sql
CREATE TABLE atlas_core.tenant_schema_versions (
    tenant_id       UUID PRIMARY KEY,
    current_version INTEGER NOT NULL,
    target_version  INTEGER NOT NULL,
    last_migrated_at TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'current'  -- current, migrating, failed
);
```

Rolling migrations apply to enterprise schemas in batches of 50 tenants per hour to avoid cluster load spikes.

---

### 10. Auxiliary Data Stores Integration

#### 10.1 Redis (Cache & Sessions)

| Use Case | Pattern | TTL |
|----------|---------|-----|
| Query result cache | Cache-aside, key: `t:{tenant_id}:entity:{type}:{id}` | 5–60 min |
| Permission cache | Write-through on role change invalidation | 15 min |
| Session store | JWT refresh token family tracking | Per policy |
| Rate limit counters | Sliding window per tenant/API key | 1 min–1 hour |

**Cache invalidation:** Domain events (`entity.updated`, `permissions.changed`) trigger targeted Redis key eviction. Never cache data without `tenant_id` in key prefix.

#### 10.2 OpenSearch (Full-Text Search)

- PostgreSQL remains source of truth
- Outbox events trigger search index updates
- Index naming: `atlas-{tenant_id}-{entity_type}` (or shared index with `tenant_id` field for smaller tenants)
- Reindex jobs rebuild from PostgreSQL on schema changes

#### 10.3 pgvector (Embeddings)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE atlas_core.document_embeddings (
    id          UUID PRIMARY KEY,
    tenant_id   UUID NOT NULL,
    document_id UUID NOT NULL,
    chunk_index INTEGER NOT NULL,
    embedding   vector(1536) NOT NULL,
    model_version TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_embeddings_tenant_document
    ON atlas_core.document_embeddings (tenant_id, document_id);

-- HNSW index for similarity search (per-tenant queries always filter tenant_id first)
CREATE INDEX idx_embeddings_hnsw
    ON atlas_core.document_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
```

Vector search queries **always** include `WHERE tenant_id = $1` before similarity ordering — RLS enforced.

---

### 11. Entity Relationship Overview (High-Level)

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   tenants   │──────▶│    users    │──────▶│    roles    │
└──────┬──────┘       └─────────────┘       └─────────────┘
       │
       ├──────────▶ ┌─────────────┐       ┌─────────────┐
       │            │  workspaces │──────▶│   teams     │
       │            └─────────────┘       └─────────────┘
       │
       ├──────────▶ ┌─────────────┐       ┌─────────────┐
       │            │  contacts   │       │  invoices   │
       │            └─────────────┘       └─────────────┘
       │
       ├──────────▶ ┌─────────────┐       ┌─────────────┐
       │            │  projects   │       │  documents  │
       │            └─────────────┘       └──────┬──────┘
       │                                          │
       └──────────▶ ┌─────────────┐       ┌──────▼──────┐
                    │ event_outbox │       │ embeddings  │
                    └─────────────┘       └─────────────┘
```

Detailed ERDs per domain module are specified in Phase 3.

---

## Alternatives Considered

### A1: Database-Per-Tenant (All Tiers)

| Pros | Cons |
|------|------|
| Strongest isolation | Millions of databases — operational nightmare |
| Simple mental model | Connection pool explosion |
| Easy per-tenant backup | Migration coordination at scale impossible |

**Decision:** Rejected for standard tiers. Offered only as `dedicated_cluster` for Enterprise Plus.

### A2: Schema-Per-Tenant (All Tiers)

| Pros | Cons |
|------|------|
| Good isolation | 100K+ schemas degrades PostgreSQL catalog performance |
| Per-tenant migrations | Migration fleet complexity |
| | Poor connection pooling efficiency |

**Decision:** Rejected for standard tiers. Used for Enterprise tier only.

### A3: Discriminator Column Without RLS

| Pros | Cons |
|------|------|
| Simpler queries | Single application bug leaks all tenant data |
| No `SET LOCAL` overhead | No defense-in-depth |

**Decision:** Rejected. RLS is mandatory on all tenant-scoped tables.

### A4: Liquibase vs Flyway

| Tool | Assessment |
|------|------------|
| Liquibase | XML/YAML abstraction, rollback support, steeper learning curve |
| Flyway | Plain SQL, git-friendly, simpler CI integration, team familiarity |

**Decision:** Flyway selected. Rollbacks handled via forward corrective migrations (industry best practice for zero-downtime).

### A5: Dual-Write to Event Bus (No Outbox)

| Pros | Cons |
|------|------|
| Lower latency | Inconsistent state on partial failure |
| Simpler initial implementation | Cannot guarantee delivery |

**Decision:** Rejected. Transactional outbox is mandatory for domain events.

### A6: MongoDB for Flexible Modules

| Pros | Cons |
|------|------|
| Schema flexibility | Breaks unified query model |
| Document-native | Complicates multi-tenant joins with core entities |

**Decision:** Rejected. JSONB columns in PostgreSQL for semi-structured data; OpenSearch for search-optimized denormalization.

---

## Consequences

### Positive

- **Strong tenant isolation** via RLS provides defense-in-depth even when application code has bugs
- **Unified SQL model** across all business domains simplifies reporting, AI context assembly, and compliance
- **Citus sharding path** provides clear horizontal scaling without architectural rewrite
- **Transactional outbox** ensures reliable event-driven architecture for search, webhooks, and AI pipelines
- **Flyway + expand-contract** enables continuous deployment without maintenance windows
- **Audit + temporal tables** satisfy SOC 2, GDPR, and enterprise contractual requirements

### Negative / Trade-offs

- **RLS performance overhead** — estimated 2–5% query overhead; mitigated by proper indexing on `tenant_id`
- **`SET LOCAL` per transaction** — requires PgBouncer transaction pooling mode; incompatible with session-level features
- **Citus query constraints** — cross-shard joins and non-tenant queries require careful query design
- **Migration complexity at scale** — enterprise schema-per-tenant requires orchestrated migration fleet
- **Operational sophistication** — team must maintain expertise in PostgreSQL, Citus, PgBouncer, and Flyway

### Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| RLS policy misconfiguration | Low | Critical | CI integration tests, policy audit tooling |
| Replica lag causing stale reads | Medium | Medium | Lag circuit breaker, read-your-writes |
| Migration failure mid-deploy | Low | High | Canary migrations, automatic rollback playbook |
| Shard hot-spot | Medium | High | Tenant dedicated cluster upgrade path |
| Outbox relay failure | Low | Medium | Dead letter monitoring, replay tooling |

---

## Open Questions

| # | Question | Owner | Target Resolution |
|---|----------|-------|-------------------|
| OQ-05-01 | At what tenant count / data volume do we activate Citus? (Proposal: >500 GB or >10K TPS) | Platform Engineering | Phase 2 ADR |
| OQ-05-02 | Debezium CDC vs polling outbox relay — at what event throughput do we switch? | Platform Engineering | Load testing |
| OQ-05-03 | Should audit_log use PostgreSQL partitioning (by month) from day one or add when >100M rows? | DBA Team | Phase 3 |
| OQ-05-04 | Per-tenant encryption at rest (TDE with tenant-specific keys) — required for which tiers? | Security + Legal | Enterprise contract review |
| OQ-05-05 | Maximum JSONB document size before mandating external blob storage? | Architecture | Phase 3 |
| OQ-05-06 | Read replica count per region — static or auto-scaled based on read QPS? | Infrastructure | Phase 2 |
| OQ-05-07 | Cross-region active-active PostgreSQL vs primary-DR failover model? | Infrastructure | ADR-0012 |
| OQ-05-08 | pgvector index strategy per tenant size — shared HNSW vs per-tenant indexes? | AI Team | Phase 3 |

---

## References

- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Citus Documentation — Multi-Tenant Schema](https://docs.citusdata.com/en/stable/use_cases/multi_tenant.html)
- [Flyway Documentation](https://flywaydb.org/documentation/)
- [Transactional Outbox Pattern — Chris Richardson](https://microservices.io/patterns/data/transactional-outbox.html)
- Atlas: `02-software-architecture.md`, `03-infrastructure-architecture.md`, `06-api-architecture.md`
- Atlas: `25-disaster-recovery.md` (backup and restore runbooks)