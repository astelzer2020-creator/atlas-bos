# ADR-0002: PostgreSQL as Primary OLTP

**Status:** Accepted
**Date:** 2026-06-30
**Deciders:** Chief Software Architect, Data Architecture Team
**Related:** [05-database-architecture.md](../architecture/phase-1/05-database-architecture.md), [ADR-0007](./ADR-0007-multi-tenant-rls.md)

## Context

Atlas BOS requires a primary transactional database that serves as the single source of truth for all business data across dozens of bounded contexts. The database must support:

- **ACID transactions** for financial operations (invoicing, payments, ledger postings)
- **Multi-tenant isolation** at the row level for millions of organizations
- **Complex relational queries** across entities within a bounded context
- **Horizontal scaling** via sharding as tenant count grows
- **Rich data types** — JSONB, arrays, UUID, CITEXT, temporal tables, pgvector for embeddings
- **Transactional outbox** for reliable event publishing
- **Operational maturity** — proven backup, replication, point-in-time recovery, and monitoring tooling

Candidates evaluated:

| Database | Strengths | Weaknesses for Atlas |
|----------|-----------|---------------------|
| **PostgreSQL** | ACID, RLS, JSONB, pgvector, Citus sharding, mature ecosystem | Vertical scaling limits without Citus |
| **MySQL** | Wide adoption, good replication | Weaker JSON support, no RLS, no pgvector |
| **CockroachDB** | Distributed SQL, horizontal scaling native | Higher operational complexity, weaker extension ecosystem |
| **MongoDB** | Flexible schema, horizontal scaling | No ACID across documents (pre-4.0), weak relational joins |
| **DynamoDB** | Serverless scaling | No joins, no RLS, vendor lock-in, poor fit for relational ERP data |

Atlas data is inherently relational: invoices link to orders, orders link to customers, employees link to departments. Financial transactions require strict ACID guarantees. Multi-tenant RLS is a hard requirement.

## Decision

**PostgreSQL** is the primary OLTP database for Atlas BOS:

- **Version:** PostgreSQL 16+ with pgvector extension
- **Topology:** Primary + read replicas + PgBouncer connection pooling
- **Sharding:** Citus extension with `tenant_id` hash partitioning when single-node limits reached
- **Schema strategy:** Schema-per-module within shared cluster (e.g., `customer`, `ledger`, `commercial`)
- **Migrations:** Flyway with forward-only, expand-contract pattern
- **Read/write splitting:** Application-level routing — writes to primary, reads to replicas where eventual consistency acceptable
- **Extensions:** pgvector (embeddings), citext (case-insensitive text), pg_trgm (fuzzy search fallback)

Supporting data stores (not replacing PostgreSQL):

- **Redis** — Cache, sessions, idempotency keys, rate limiting
- **OpenSearch** — Full-text search (derived index, see ADR-0009)
- **S3** — Object storage for documents and media
- **Kafka** — Event streaming (not a data store)

## Consequences

### Positive

- **ACID guarantees** for financial transactions and multi-step business operations
- **Row-Level Security** native support for multi-tenant isolation (see ADR-0007)
- **pgvector** enables AI embeddings colocated with business data — no separate vector DB for Phase 1
- **Rich SQL** — complex joins, window functions, CTEs for reporting within bounded contexts
- **Transactional outbox** — reliable event publishing within same database transaction
- **Mature ecosystem** — Flyway, PgBouncer, Citus, Debezium CDC, extensive monitoring tooling
- **Team familiarity** — PostgreSQL is widely known; hiring and onboarding simplified

### Negative

- **Vertical scaling ceiling** — Single-node limits require Citus sharding investment
- **Schema-per-module coordination** — Migration ordering across modules on shared cluster
- **Operational expertise** — Requires DBA skills for performance tuning, replication management
- **Not optimal for all workloads** — Full-text search delegated to OpenSearch; high-throughput event processing to Go services

### Neutral

- Read replicas add eventual consistency for read paths — application must handle
- Enterprise tier may use dedicated PostgreSQL instances per tenant (hybrid model in database architecture doc)
- Quarterly review of Citus sharding timeline based on tenant growth metrics