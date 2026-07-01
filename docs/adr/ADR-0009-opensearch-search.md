# ADR-0009: OpenSearch for Full-Text Search

**Status:** Accepted
**Date:** 2026-06-30
**Deciders:** Chief Software Architect, Platform Engineering Team
**Related:** [14-search.md](../architecture/phase-1/14-search.md), [ADR-0002](./ADR-0002-postgresql-primary-oltp.md), [ADR-0003](./ADR-0003-event-driven-kafka.md)

## Context

Atlas BOS users need to search across all business data — contacts, invoices, projects, documents, messages, employees, and more — with:

- **Full-text search** with relevance ranking, fuzzy matching, and typo tolerance
- **Faceted filtering** — filter by date, status, assignee, department, tags
- **Autocomplete** — typeahead suggestions as users type
- **Cross-entity search** — unified search bar finding results across all modules
- **Near-real-time indexing** — new records searchable within seconds
- **Multi-tenant isolation** — search results scoped to tenant
- **Scale** — billions of documents across millions of tenants

PostgreSQL full-text search (`tsvector`, `pg_trgm`) can handle simple search within a single table but cannot scale to unified cross-entity search with relevance ranking, faceting, and analytics at Atlas's projected volume.

Search engine candidates:

| Engine | Strengths | Weaknesses |
|--------|-----------|------------|
| **OpenSearch** | Open source, AWS managed option, full-text + analytics, fork of Elasticsearch | Operational complexity self-hosted |
| **Elasticsearch** | Mature, largest ecosystem | License changes (SSPL), vendor lock-in |
| **Algolia** | Excellent DX, hosted, fast | Expensive at scale, limited analytics |
| **Meilisearch** | Simple, fast, typo-tolerant | Less mature, limited faceting/analytics |
| **PostgreSQL FTS** | No additional infrastructure | Poor cross-entity search, limited relevance tuning |
| **Typesense** | Fast, open source | Smaller ecosystem, less analytics |

Atlas already uses OpenSearch in the infrastructure architecture for log aggregation. Consolidating search and observability on the same technology reduces operational overhead.

## Decision

**OpenSearch** is the full-text search engine for Atlas BOS:

### Search Architecture

```
Module writes data to PostgreSQL
    → Domain event raised
    → Outbox → Kafka → Search Indexer (Go service)
    → OpenSearch index updated
    → User queries via API → OpenSearch → ranked results
```

- **Indexing:** Async via Kafka events consumed by `services/search-indexer` (Go for throughput)
- **Query:** REST API endpoint `POST /v1/search` queries OpenSearch with tenant filter
- **Consistency:** Eventual — new records searchable within 1-5 seconds of creation
- **Source of truth:** PostgreSQL remains authoritative; OpenSearch is a derived index

### Index Organization

| Index Pattern | Content | Tenant Isolation |
|---------------|---------|------------------|
| `atlas-{tenant_id}-contacts` | CRM contacts, leads | Per-tenant index |
| `atlas-{tenant_id}-invoices` | Financial documents | Per-tenant index |
| `atlas-{tenant_id}-projects` | PM projects, tasks | Per-tenant index |
| `atlas-{tenant_id}-documents` | Content documents | Per-tenant index |
| `atlas-{tenant_id}-messages` | Communication messages | Per-tenant index |
| `atlas-{tenant_id}-unified` | Cross-entity unified search | Per-tenant index |

### Indexing Standards

- **Document ID:** `{tenant_id}:{module}:{entity_id}` — globally unique
- **Tenant filter:** Every query includes `tenant_id` term filter (defense in depth beyond per-tenant indices)
- **Mapping:** Strict mappings defined per entity type; dynamic mapping disabled
- **Analyzers:** Standard analyzer default; custom analyzers for names (edge n-gram), codes (keyword)
- **Refresh interval:** 1 second (near-real-time)
- **Reindexing:** Blue/green index aliases for zero-downtime mapping changes

### Search API

- **Unified search:** `POST /v1/search` — cross-entity with type filtering
- **Entity search:** `POST /v1/{resource}/search` — module-specific with facets
- **Autocomplete:** `GET /v1/search/suggest?q={prefix}` — edge n-gram matching
- **GraphQL:** `search` query on GraphQL endpoint for web app integration

### Fallback

- PostgreSQL `pg_trgm` used as fallback for simple single-table lookups when OpenSearch unavailable
- Search degradation mode: return PostgreSQL results with warning header `X-Search-Degraded: true`

## Consequences

### Positive

- **Purpose-built search** — relevance ranking, fuzzy matching, faceting, autocomplete out of the box
- **Cross-entity search** — unified search bar across all business data
- **Scalable** — horizontal scaling via sharding; handles billions of documents
- **Operational consolidation** — same technology as log aggregation infrastructure
- **Open source** — no vendor license risk (Apache 2.0)
- **Analytics** — OpenSearch aggregations power Insight module dashboards
- **AI integration** — search results feed Intelligence module context retrieval

### Negative

- **Additional infrastructure** — OpenSearch cluster to operate (or AWS OpenSearch Service cost)
- **Eventual consistency** — 1-5 second indexing lag; users may not find just-created records immediately
- **Index management** — mapping changes, reindexing, per-tenant index lifecycle
- **Data duplication** — business data exists in both PostgreSQL and OpenSearch
- **Go service dependency** — search indexer is an extracted Go service adding operational surface

### Neutral

- Per-tenant indices may transition to shared indices with routing as tenant count grows
- Vector search (kNN) for AI semantic search uses pgvector in PostgreSQL for Phase 1; OpenSearch kNN evaluated for Phase 2
- Search analytics (popular queries, zero-result queries) logged for product insights
- Index size monitoring and ILM (Index Lifecycle Management) policies for data retention