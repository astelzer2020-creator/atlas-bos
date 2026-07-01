---
title: Scaling
document_id: ARCH-23
version: 1.0.0
status: approved
phase: 1
last_updated: 2026-06-30
authors:
  - Atlas Architecture Team
related_documents:
  - ARCH-03
  - ARCH-05
  - ARCH-19
  - ARCH-22
  - ARCH-24
  - ARCH-25
tags:
  - scaling
  - performance
  - hpa
  - caching
  - sharding
  - capacity
---

# Scaling

## Purpose

Define the architecture for **Scaling Atlas** — the strategies, patterns, and infrastructure that enable the platform to grow from thousands to **millions of organizations**, **hundreds of millions of users**, and **billions of API requests per month** while maintaining latency, availability, and cost efficiency targets.

## Scope

### In Scope

- Horizontal Pod Autoscaling (HPA) and cluster autoscaling
- Database read replicas and connection pooling
- Caching layers (Redis, CDN, application cache)
- CDN for static assets and edge caching
- Queue-based load leveling (Kafka)
- Tenant-based sharding strategy
- Capacity planning methodology
- Load testing strategy
- Per-tier scaling policies
- Cost-performance tradeoffs

### Out of Scope

- Multi-region disaster recovery (ARCH-25)
- Detailed database schema partitioning (ARCH-05)
- Vendor-specific pricing negotiations

---

## Context

Atlas is designed for global scale from day one. Scaling is not an afterthought retrofit — it is embedded in service design, data modeling, and infrastructure choices. The platform must:

- Handle 10× traffic spikes without manual intervention
- Isolate noisy tenants from affecting others
- Scale cost sub-linearly with usage where possible
- Maintain P99 API latency < 500ms under normal load

### Scale Targets (Phase 1 Design Point)

| Dimension | Year 1 | Year 3 | Year 5 |
|-----------|--------|--------|--------|
| Organizations | 100K | 5M | 20M |
| Active users | 1M | 50M | 200M |
| API requests/month | 500M | 10B | 50B |
| Peak RPS (global) | 50K | 500K | 2M |
| Storage (total) | 50 TB | 2 PB | 10 PB |
| Kafka messages/day | 100M | 5B | 20B |

---

## Detailed Design

### 1. Scaling Architecture Overview

```
                         ┌─────────────┐
                         │     CDN     │ (static, edge cache)
                         └──────┬──────┘
                                │
┌──────────────┐         ┌──────▼──────┐         ┌──────────────┐
│   Clients    │────────►│ API Gateway │────────►│  Services    │
└──────────────┘         │  (HPA)      │         │  (HPA)       │
                         └──────┬──────┘         └──────┬───────┘
                                │                       │
                    ┌───────────┼───────────────────────┤
                    ▼           ▼                       ▼
              ┌─────────┐ ┌─────────┐           ┌─────────┐
              │  Redis  │ │  Kafka  │           │PostgreSQL│
              │ Cluster │ │ Cluster │           │ Primary  │
              └─────────┘ └────┬────┘           └────┬────┘
                               │                     │
                               ▼               ┌──────▼──────┐
                         ┌─────────┐           │   Read      │
                         │ Workers │           │  Replicas   │
                         │ (HPA)   │           └─────────────┘
                         └─────────┘
```

### 2. Horizontal Pod Autoscaling (HPA)

#### Default HPA Configuration

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: finance-api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: finance-api
  minReplicas: 3
  maxReplicas: 100
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "1000"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
```

#### Service-Specific Scaling Profiles

| Service | Min | Max | Primary Metric |
|---------|-----|-----|----------------|
| api-gateway | 10 | 500 | RPS + CPU |
| auth-service | 5 | 100 | RPS + latency |
| finance-api | 3 | 100 | RPS |
| workflow-runtime | 5 | 200 | Queue depth |
| automation-executor | 10 | 500 | Kafka lag |
| agent-worker | 5 | 300 | Queue depth + cost budget |
| embedding-worker | 2 | 50 | Queue depth |

#### Cluster Autoscaling

- Karpenter (or Cluster Autoscaler) adds nodes when pending pods
- Node pools: general, compute-optimized (AI), memory-optimized (cache)
- Scale-to-zero for dev; minimum 3 nodes per prod AZ

#### Custom Metrics

Prometheus Adapter exposes:

- `kafka_consumer_lag`
- `atlas_workflow_runnable_instances`
- `atlas_automation_queue_depth`
- `atlas_agent_pending_runs`

### 3. Database Scaling

#### Read Replicas

```
                    ┌─────────────┐
   Writes ─────────►│   Primary   │
                    │ (us-east-1) │
                    └──────┬──────┘
                           │ streaming replication
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  Replica 1  │ │  Replica 2  │ │  Replica 3  │
    │   (reads)   │ │   (reads)   │ │  (reports)  │
    └─────────────┘ └─────────────┘ └─────────────┘
```

| Workload | Target |
|----------|--------|
| OLTP reads (90%) | Replicas via connection pooler |
| Analytics/reports | Dedicated replica (lag-tolerant) |
| Search indexing | CDC replica |
| Writes | Primary only |

**Read-after-write consistency:** Session flag `read_your_writes` routes to primary for 5s after write.

#### Connection Pooling

| Layer | Tool | Pool Size |
|-------|------|-----------|
| Sidecar (per pod) | PgBouncer (transaction mode) | 20 per pod |
| Regional aggregator | PgBouncer (transaction mode) | 500 per service |
| Serverless bursts | RDS Proxy / Odyssey | Dynamic |

**Rule:** `max_connections` on PostgreSQL = 5000; application pods never connect directly.

```
App Pod (pool 20) → PgBouncer → PostgreSQL
Total app connections: 10,000 pods × 20 = would exceed limit
With PgBouncer: 10,000 → multiplexed to ~2,000 actual PG connections
```

#### Query Optimization

- Mandatory `EXPLAIN` review for queries > 50ms
- Partial indexes for tenant-scoped queries
- Cursor-based pagination (no OFFSET on large tables)
- Materialized views for dashboards (refreshed async)

### 4. Caching Layers

#### Layer 1: CDN (CloudFront / Fastly)

| Content | TTL | Invalidation |
|---------|-----|--------------|
| Static assets (JS/CSS) | 1 year (hashed filenames) | Deploy |
| Public marketing | 1 hour | API |
| API responses (GET, public) | None default | — |
| Tenant branding assets | 24 hours | On update event |

#### Layer 2: Redis Cluster

| Use Case | Pattern | TTL |
|----------|---------|-----|
| Session store | Hash | 24h |
| Permission cache | String (JSON) | 5 min |
| Rate limiting | Sliding window | 1h |
| Published workflow defs | String | 15 min |
| STM (ARCH-18) | List | 24h |
| Idempotency keys | String | 24h |

**Cache key format:** `{tenant_id}:{service}:{entity}:{id}`

**Invalidation:** Event-driven via Kafka (`cache.invalidate`); never pure TTL for auth data.

#### Layer 3: Application Cache (In-Process)

- Caffeine (JVM) / LRU (Go) for hot read-only config
- Max 10MB per pod; 60s TTL
- Tenant-scoped entries only

#### Cache-Aside Pattern

```python
def get_entity(tenant_id, entity_id):
    key = f"{tenant_id}:entity:{entity_id}"
    cached = redis.get(key)
    if cached:
        return cached
    entity = db.query(tenant_id, entity_id)
    redis.setex(key, 300, entity)
    return entity
```

### 5. Queue-Based Load Leveling

Absorb traffic spikes via asynchronous processing.

| Queue | Technology | Producers | Consumers |
|-------|------------|-----------|-----------|
| Domain events | Kafka | All services | Projections, automation, search |
| Background jobs | Kafka + internal | APIs | Workers (HPA on lag) |
| Automation | Redis Streams | Trigger consumer | Executor pool |
| AI agent runs | Kafka | Agent API | Agent workers |
| Email/notifications | Kafka | Services | Notification workers |

**Backpressure:**

- Kafka: consumer lag alert at 50K; HPA scales consumers
- API: 429 when downstream lag > threshold (protect DB)
- Per-tenant fair queuing in automation executor

```
Peak API Traffic → Accept sync requests (CRUD)
                → Defer heavy work to queue (reports, exports, embeddings)
                → Return 202 Accepted with job ID
```

### 6. Tenant-Based Sharding

#### Sharding Strategy

| Phase | Strategy | Trigger |
|-------|----------|---------|
| Phase 1 | Shared DB, `tenant_id` on all rows + RLS | < 100K tenants |
| Phase 2 | **Shard by tenant_id hash** (32 shards) | DB > 2TB or hot tenants |
| Phase 3 | Dedicated DB for enterprise tenants | Contractual isolation |

```
tenant_id → shard = hash(tenant_id) % 32

Shard 0  ──► PostgreSQL Cluster 0 (primary + replicas)
Shard 1  ──► PostgreSQL Cluster 1
...
Shard 31 ──► PostgreSQL Cluster 31
```

#### Shard Routing

| Component | Responsibility |
|-----------|----------------|
| Shard router library | `get_shard(tenant_id)` in all data access |
| Connection pool per shard | PgBouncer per cluster |
| Cross-shard queries | Forbidden in OLTP; analytics via warehouse |
| Tenant migration | Online move tool for enterprise upgrades |

#### Hot Tenant Isolation

Tenants exceeding 5% of shard load:

- Alert tenant success team
- Offer dedicated shard (enterprise)
- Per-tenant rate limits
- Noisy neighbor circuit breaker

### 7. Service-Specific Scaling Patterns

| Service | Pattern |
|---------|---------|
| API Gateway | Stateless HPA; rate limit per tenant |
| Search (ARCH-14) | OpenSearch horizontal scaling; per-tenant indices at scale |
| Storage (ARCH-09) | S3 unlimited; CloudFront for delivery |
| Vector DB (ARCH-18) | pgvector → dedicated cluster; partition by tenant |
| Workflow | Worker pool HPA; partition instances by tenant hash |
| AI/LLM | Request queuing; model routing to balance cost/latency |

### 8. CDN and Edge

| Capability | Implementation |
|------------|----------------|
| Static assets | S3 + CloudFront |
| Edge auth (future) | Lambda@Edge for JWT validation |
| Geo routing | Route 53 latency-based |
| DDoS | AWS Shield Advanced / Cloudflare |

API responses generally **not CDN-cached** (dynamic, auth-required). Exceptions: public status pages, OAuth discovery documents.

### 9. Capacity Planning

#### Methodology

```
1. Forecast demand (tenant growth × usage per tenant)
2. Load test to establish per-unit capacity (RPS per pod)
3. Calculate headroom: target 40% peak utilization
4. Plan quarterly infrastructure purchases
5. Game day validation
```

#### Capacity Model (Example)

| Resource | Per 10K RPS | Headroom Factor |
|----------|-------------|-----------------|
| API pods (1K RPS each) | 10 pods | 2.5× |
| PostgreSQL IOPS | 50K | 2× |
| Redis memory | 32 GB | 1.5× |
| Kafka brokers | 3 | 2× |

#### Monitoring Triggers (ARCH-19)

| Metric | Scale Action |
|--------|--------------|
| CPU > 70% sustained | HPA (automatic) |
| DB connections > 80% | Add pooler capacity |
| Disk > 75% | Expand storage / archive |
| Kafka disk > 70% | Add retention tiering |

### 10. Load Testing Strategy

| Test Type | Tool | Frequency | Environment |
|-----------|------|-----------|-------------|
| Baseline | k6 | Weekly | Staging |
| Peak simulation | k6/Gatling | Monthly | Staging (isolated) |
| Soak test | k6 | Quarterly | Staging (72h) |
| Chaos + load | Litmus + k6 | Quarterly | Staging |
| Tenant isolation | Custom | Monthly | Verify noisy neighbor controls |

#### Load Test Scenarios

```javascript
// k6 scenario: mixed API workload
export const options = {
  scenarios: {
    api_read: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10m', target: 5000 },
        { duration: '30m', target: 5000 },
        { duration: '10m', target: 0 },
      ],
    },
    api_write: {
      executor: 'constant-arrival-rate',
      rate: 1000,
      timeUnit: '1s',
      duration: '50m',
    },
  },
  thresholds: {
    http_req_duration: ['p(99)<500'],
    http_req_failed: ['rate<0.001'],
  },
};
```

**Production load testing:** Synthetic traffic only (ARCH-19); never unannounced prod load.

### 11. Cost-Performance Tradeoffs

| Decision | Cost Impact | Performance Impact |
|----------|-------------|------------------|
| Aggressive caching | Lower DB cost | Stale data risk (mitigated) |
| Read replicas | +30% DB cost | 5× read capacity |
| Kafka retention 7d | Storage cost | Replay capability |
| AI model routing (small vs large) | -60% LLM cost | Slight quality variance |
| Spot instances for workers | -70% compute | Acceptable for async |

**Unit economics tracking:** Cost per API request, per tenant, per agent run (ARCH-19).

### 12. Scaling Runbooks

| Scenario | Response |
|----------|----------|
| Traffic spike (viral tenant) | HPA auto; enable tenant rate limit; CSM contact |
| DB CPU saturation | Route reads to replicas; kill expensive queries; scale up instance |
| Kafka lag | Scale consumers; increase partitions (planned) |
| Redis memory | Evict LRU; scale cluster; alert cache miss rate |
| Regional overload | Route 10% traffic to adjacent region (ARCH-25) |

---

## Alternatives Considered

### Alternative 1: Vertical Scaling Only

**Rejected:** Ceiling at single-node limits; no fault isolation; poor cost curve.

### Alternative 2: Database-per-Tenant from Day 1

**Rejected:** Operational nightmare at millions of tenants; connection overhead.

**Hybrid:** Shared with dedicated for enterprise (chosen).

### Alternative 3: Serverless-Only (Lambda)

**Rejected:** Cold starts unacceptable for API P99; vendor lock-in; debugging complexity.

**Hybrid:** Workers/async on K8s; API on long-running pods.

### Alternative 4: No Caching (Database-Only)

**Rejected:** Cannot achieve latency/cost targets at billions of requests.

### Alternative 5: Synchronous Everything

**Rejected:** Spikes overwhelm DB; poor UX for long operations.

---

## Consequences

### Positive

- Platform grows with customer base without architectural rewrites
- Noisy tenant isolation protects shared infrastructure
- Cost scales sub-linearly via caching and async processing
- HPA eliminates manual capacity management for most services
- Load testing provides confidence before peak events

### Negative

- Sharding adds application complexity (router, no cross-shard joins)
- Cache invalidation complexity
- Multi-layer scaling harder to debug
- Load test environment cost

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Shard rebalancing pain | Consistent hashing; plan migrations |
| Cache stampede | Request coalescing; jittered TTL |
| HPA thrashing | Stabilization windows; proper metrics |
| Connection pool exhaustion | PgBouncer; connection limits per service |

---

## Open Questions

| ID | Question | Owner | Target |
|----|----------|-------|--------|
| OQ-23-01 | Shard count 32 vs. 64 at Phase 2? | Data Platform | 32 initial |
| OQ-23-02 | CockroachDB vs. PostgreSQL sharding long-term? | Data Platform | Year 3 eval |
| OQ-23-03 | Edge compute for API auth caching? | Platform | Phase 3 |
| OQ-23-04 | Auto-scale PostgreSQL (Aurora Serverless v2)? | Infra | Phase 2 pilot |
| OQ-23-05 | Per-tenant resource quotas enforcement layer? | Platform | Phase 2 |

---

## References

- ARCH-03 Infrastructure Architecture
- ARCH-05 Database Architecture
- ARCH-19 Monitoring
- ARCH-22 Deployment
- ARCH-24 Testing
- ARCH-25 Disaster Recovery