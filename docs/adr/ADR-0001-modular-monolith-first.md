# ADR-0001: Modular Monolith First

**Status:** Accepted
**Date:** 2026-06-30
**Deciders:** Chief Software Architect, Platform Engineering Team
**Related:** [02-software-architecture.md](../architecture/phase-1/02-software-architecture.md), [06-folder-structure.md](../architecture/phase-2/06-folder-structure.md)

## Context

Atlas BOS is a comprehensive Business Operating System consolidating CRM, ERP, accounting, HR, project management, documents, messaging, AI, and dozens of other business domains into a single platform. The engineering team must choose an initial deployment architecture that balances:

- **Speed of delivery** — Phase 1 must ship core capabilities without operational overhead
- **Scalability** — The platform must eventually support millions of organizations and billions of API requests
- **Maintainability** — Dozens of bounded contexts must coexist without becoming an unmaintainable ball of mud
- **Extractability** — Individual domains (e.g., Ledger, Intelligence) may need independent scaling, deployment cadence, or fault isolation in the future

Three primary options were evaluated:

1. **Distributed microservices from day one** — Each bounded context as an independent deployable service
2. **Traditional monolith** — Single codebase with no module boundaries
3. **Modular monolith** — Single deployable unit with strict bounded context modules, event-driven integration, and extraction-ready facades

The team has experience with microservices at scale (Stripe, Shopify patterns) and understands the operational cost: distributed tracing, deployment coordination, network latency, data consistency complexity, and service mesh overhead.

## Decision

Atlas will adopt a **modular monolith first** architecture:

- All bounded context modules live in a single repository (`atlas-bos`) under `packages/modules/`
- Each module follows Clean Architecture with four layers (presentation, application, domain, infrastructure)
- Modules communicate via **integration events** (Kafka) for cross-context writes and **facade query services** for cross-context reads
- Each module exposes a narrow **public facade** (`module.ts`) — no direct imports of internal layers
- Modules own dedicated **PostgreSQL schemas** within a shared cluster
- A single API process (`apps/api`) composes all modules; a worker process (`apps/worker`) handles async consumers
- **Extraction to microservices** occurs at bounded context boundaries when independent scaling, deployment cadence, or fault isolation demands it — not before

Dependency rules enforced by CI (`dependency-cruiser`):

- Modules depend only on `shared-kernel` and `platform`
- No cross-module imports of `domain/`, `infrastructure/`, or `application/`
- Circular dependencies forbidden

## Consequences

### Positive

- **Faster Phase 1 delivery** — No distributed system operational overhead (service mesh, inter-service auth, deployment coordination)
- **Simpler debugging** — Single process, shared debugger, no network hops for in-process module calls
- **Clean extraction path** — Modules with facades, events, and schemas map 1:1 to future microservices
- **Team scalability** — Teams own bounded context folders with minimal merge conflicts
- **Transactional consistency** — In-process module facades avoid distributed transaction complexity for critical paths
- **Lower infrastructure cost** — Single deployment unit for Phase 1

### Negative

- **Single deployment unit** — All modules deploy together; a bug in one module can affect the entire API process
- **Scaling granularity** — Cannot independently scale individual modules until extracted
- **Facade discipline required** — Developers may circumvent boundaries with direct imports without lint enforcement
- **Resource contention** — High-throughput modules (search indexing, event processing) may need early extraction to Go services
- **Eventual consistency UX** — Cross-module views require careful UI design for staleness

### Neutral

- Go services (`services/search-indexer`, `services/event-processor`) extracted early for performance-critical paths — this is compatible with modular monolith
- Module extraction playbook to be documented when first extraction occurs
- Quarterly architecture review to assess extraction candidates based on scaling metrics