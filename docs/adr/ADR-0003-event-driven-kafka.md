# ADR-0003: Event-Driven Architecture with Kafka

**Status:** Accepted
**Date:** 2026-06-30
**Deciders:** Chief Software Architect, Platform Engineering Team
**Related:** [02-software-architecture.md](../architecture/phase-1/02-software-architecture.md), [13-messaging.md](../architecture/phase-1/13-messaging.md), [ADR-0001](./ADR-0001-modular-monolith-first.md)

## Context

Atlas BOS modules must communicate without tight coupling. Cross-module business flows — quote-to-cash, employee onboarding, lead-to-opportunity — involve multiple bounded contexts reacting to state changes in other contexts. The platform must support:

- **Loose coupling** between bounded contexts (no synchronous cross-module database joins)
- **Reliable delivery** of integration events (at-least-once with idempotent consumers)
- **Audit trail** of all business state changes for compliance and analytics
- **Read model projections** for CQRS query paths
- **AI context** — event stream provides rich business activity feed for Intelligence module
- **Future extraction** — event bus enables microservice communication without code changes

Messaging platform candidates:

| Platform | Strengths | Weaknesses |
|----------|-----------|------------|
| **Apache Kafka** | Durable log, high throughput, replay, ecosystem (Schema Registry, Connect, Streams) | Operational complexity, higher latency than pub/sub |
| **RabbitMQ** | Simple routing, low latency | No durable replay, weaker ordering guarantees at scale |
| **NATS** | Ultra-low latency, simple | Less durable, smaller ecosystem for enterprise patterns |
| **AWS SQS/SNS** | Managed, serverless | No replay, message size limits, vendor lock-in |
| **Redis Streams** | Simple, already in stack | Not designed for long-term event storage at scale |

Atlas requires durable event storage (replay for new consumers, audit compliance), per-aggregate ordering, and schema evolution — all strengths of Kafka.

## Decision

Atlas adopts **event-driven architecture** with **Apache Kafka** as the primary integration event bus:

### Event Types

| Type | Scope | Transport |
|------|-------|-----------|
| **Domain events** | Intra-module (in-process) | In-memory dispatch within transaction |
| **Integration events** | Inter-module (cross-context) | Kafka topics |
| **Audit events** | Compliance stream | Kafka → long-term storage |

### Integration Event Standards

- **Naming:** `{context}.{aggregate}.{action}.v{major}` — e.g., `commercial.order.confirmed.v1`
- **Schema:** JSON Schema registered in Confluent Schema Registry (Avro for high-volume topics in Phase 2)
- **Envelope:** `EventEnvelope<T>` from shared-kernel with `eventId`, `occurredAt`, `tenantId`, `organizationId`, `correlationId`, `causationId`, `payload`
- **Publishing:** Transactional outbox pattern — events written to PostgreSQL outbox table in same transaction as state change, relayed to Kafka by dedicated worker
- **Consumption:** Idempotent consumers with `processed_events` deduplication table
- **Partitioning:** By `aggregateId` to preserve causal ordering per aggregate
- **Delivery:** At-least-once; consumers must be idempotent

### Supporting Messaging

- **NATS** for low-latency internal fan-out (presence indicators, typing notifications, cache invalidation) — not for business events
- **Dead-letter queues** with exponential backoff and alerting for failed consumers

### Topic Organization

```
integration.{context}.{aggregate}.{action}.v{major}    # Business events
audit.{context}.{action}.v1                            # Audit stream
platform.{service}.{event}.v1                          # Platform events (health, config)
```

## Consequences

### Positive

- **Loose coupling** — modules react to events without knowing producers
- **Extraction-ready** — same event contracts work for in-process and inter-service communication
- **Audit compliance** — immutable event log provides complete business activity history
- **CQRS projections** — read models built asynchronously from event stream
- **AI context** — Intelligence module consumes event stream for business awareness
- **Replay capability** — new consumers can rebuild state from event history
- **Schema evolution** — Schema Registry enforces backward-compatible changes

### Negative

- **Eventual consistency** — cross-module views lag behind writes; UI must handle staleness
- **Operational complexity** — Kafka cluster management, Schema Registry, consumer group monitoring
- **Idempotency requirement** — all consumers must handle duplicate delivery
- **Outbox relay latency** — events not immediately visible to other modules (typically < 1s)
- **Debugging complexity** — distributed event flows harder to trace than synchronous calls

### Neutral

- NATS retained for ultra-low-latency non-business messaging
- CDC (Debezium) vs polling outbox relay decision deferred to Q2 2026 (see software architecture open questions)
- Event catalog to be fully documented in Phase 5 API contracts