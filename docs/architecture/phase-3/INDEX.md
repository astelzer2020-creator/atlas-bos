# Phase 3 — Database Design Index

**Status:** Complete  
**Last Updated:** 2026-06-30

## Summary

| Metric | Count |
|--------|-------|
| Documentation files | 22 |
| PostgreSQL schemas | 17 |
| Prisma model files | 16 |
| Prisma models | ~133 |
| Entity tables documented | 140+ |

## Deliverables

All documentation: [`docs/database/`](../../database/)

Prisma schema: [`prisma/schema.prisma`](../../../prisma/schema.prisma) + [`prisma/models/`](../../../prisma/models/)

## Key Artifacts

- **[01-erd-overview.md](../../database/01-erd-overview.md)** — Complete platform ERD
- **[00-conventions.md](../../database/00-conventions.md)** — Multi-tenant, audit, soft delete, versioning
- **[99-migration-strategy.md](../../database/99-migration-strategy.md)** — Flyway, zero-downtime migrations

## Next: Phase 5

API contracts (OpenAPI, GraphQL, events) → [`docs/api/`](../../api/)