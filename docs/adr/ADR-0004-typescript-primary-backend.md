# ADR-0004: TypeScript as Primary Backend Language

**Status:** Accepted
**Date:** 2026-06-30
**Deciders:** Chief Software Architect, Engineering Leadership
**Related:** [02-software-architecture.md](../architecture/phase-1/02-software-architecture.md), [coding-standards.md](../standards/coding-standards.md), [ADR-0001](./ADR-0001-modular-monolith-first.md)

## Context

Atlas BOS requires a primary backend language for the modular monolith API, worker processes, gateway, and the majority of bounded context modules. The language choice affects:

- **Developer productivity** — hiring pool, onboarding speed, ecosystem maturity
- **Type safety** — critical for a platform with hundreds of API endpoints and complex domain models
- **Frontend alignment** — Next.js frontend is TypeScript; shared types reduce contract drift
- **Performance** — must handle billions of API requests with acceptable latency
- **Ecosystem** — ORM, messaging, auth, testing, observability library availability
- **Extraction path** — some services may need extraction to performance-optimized languages

Candidates evaluated:

| Language | Strengths | Weaknesses |
|----------|-----------|------------|
| **TypeScript (Node.js)** | Shared types with frontend, huge ecosystem, fast iteration, strict typing | Single-threaded, GC pauses, not ideal for CPU-bound workloads |
| **Go** | Excellent performance, concurrency, small binaries | Verbose error handling, smaller web framework ecosystem, no shared types with frontend |
| **Rust** | Maximum performance, memory safety | Steep learning curve, slow compilation, small hiring pool |
| **Java/Kotlin** | Enterprise maturity, JVM ecosystem | Heavier runtime, slower iteration, no frontend type sharing |
| **Python** | AI/ML ecosystem, rapid prototyping | GIL limits concurrency, weak typing, not ideal for API services at scale |

Atlas is a TypeScript-heavy organization building a Next.js frontend. The modular monolith contains primarily I/O-bound workloads (database queries, API calls, event publishing) where Node.js excels. Performance-critical paths can be extracted to Go.

## Decision

**TypeScript on Node.js 20 LTS** is the primary backend language for Atlas BOS:

### TypeScript Backend Scope

- **Modular monolith API** (`apps/api`) — all bounded context modules
- **Worker processes** (`apps/worker`) — Kafka consumers, scheduled jobs, outbox relay
- **API gateway** (`apps/gateway`) — routing, auth, rate limiting
- **Shared packages** — `shared-kernel`, `platform`, `contracts`, all `modules/*`
- **Frontend** (`apps/web`) — Next.js with React Server Components

### Go Extraction Scope

Go is used for **performance-critical services** extracted from the monolith:

- `services/search-indexer` — high-throughput OpenSearch indexing
- `services/event-processor` — high-throughput event fan-out and transformation
- Future: media transcoding, real-time analytics aggregation

### TypeScript Standards

- **Strict mode** enabled (`strict: true` in tsconfig)
- **No `any`** — enforced by ESLint (`@typescript-eslint/no-explicit-any: error`)
- **Runtime:** Node.js 20 LTS with ES modules
- **Framework:** Lightweight (Fastify or Hono) — no heavy framework magic
- **ORM:** Drizzle ORM or Kysely (type-safe query builder, no magic ORM)
- **Testing:** Vitest for unit/integration, Testcontainers for infrastructure tests
- **Package manager:** pnpm with workspace monorepo

### Shared Type Strategy

- `@atlas/contracts` package generates TypeScript types from OpenAPI specs and JSON Schema event definitions
- Frontend imports API types from `@atlas/contracts` — single source of truth
- Go services use generated types from same schemas (protoc or openapi-generator)

## Consequences

### Positive

- **End-to-end type safety** — API contracts shared between backend and Next.js frontend
- **Single language** for 90%+ of codebase — simplified hiring, onboarding, code review
- **Rapid iteration** — fast compile times, hot reload, rich npm ecosystem
- **Clean Architecture fit** — TypeScript interfaces map naturally to ports/adapters pattern
- **Large hiring pool** — TypeScript is the most popular language for web development
- **AI tooling** — excellent LLM code generation support for TypeScript

### Negative

- **Single-threaded bottleneck** — CPU-intensive operations block the event loop; must extract to Go
- **GC pauses** — unpredictable latency spikes under memory pressure; requires monitoring
- **Runtime overhead** — higher memory footprint than Go/Rust per request
- **Not ideal for system programming** — file system watchers, media processing, binary protocols need Go
- **Dependency risk** — npm supply chain attacks require vigilance (Snyk, Dependabot)

### Neutral

- Go services communicate via gRPC internally, REST/GraphQL externally
- Performance benchmarks required before any Go extraction decision
- Node.js 22 LTS evaluation planned for Q4 2026
- Python retained for ML model serving and data science tooling (not application backend)