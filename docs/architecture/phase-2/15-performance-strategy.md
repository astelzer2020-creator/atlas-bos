---
title: Performance Strategy
document_id: STRAT-15
version: 1.0.0
status: draft
phase: 2
last_updated: 2026-06-30
authors:
  - Atlas Architecture Team
related_documents:
  - ARCH-23
  - ARCH-05
  - ARCH-06
  - ARCH-19
  - ARCH-22
  - ARCH-24
  - STRAT-10
  - STRAT-11
  - STRAT-12
  - STRAT-14
tags:
  - performance
  - latency
  - throughput
  - caching
  - load-testing
  - regression-detection
---

# Performance Strategy — Phase 2

## Executive Summary

Atlas BOS Phase 2 establishes a **comprehensive performance engineering program** that ensures the platform meets latency, throughput, and scalability targets as it grows from thousands to **millions of organizations** and **billions of API requests per month**. This strategy operationalizes [ARCH-23](../phase-1/23-scaling.md) into measurable latency budgets per endpoint tier, throughput targets, a multi-layer caching strategy, load testing cadence, and automated regression detection integrated with CI/CD and SLO monitoring.

Performance is a **feature**, not an afterthought. The 99.99% availability SLO and P99 < 500ms latency SLO (ARCH-19) are business commitments that require proactive capacity planning, continuous benchmarking, and performance-as-code discipline.

**Key outcomes:**

| Outcome | Target |
|---------|--------|
| API P99 latency (platform) | < 500ms |
| API P99 latency (Tier 0 services) | < 300ms |
| Peak RPS handling (Year 1) | 50K global |
| Load test regression tolerance | < 10% degradation |
| Cache hit rate (Redis hot paths) | ≥ 85% |
| Performance regression detection | < 24h from introduction |
| Capacity headroom at peak | 40% utilization max |
| Performance-related incidents | < 5% of total incidents |

---

## Principles

1. **Latency budgets are contracts** — Every endpoint tier has an allocated budget; exceed only with architect approval.
2. **Measure in production** — Synthetic and real traffic metrics; not just lab benchmarks.
3. **Design for 10×** — Architecture handles an order of magnitude growth without redesign.
4. **Cache strategically** — Cache hot reads; never cache auth decisions on TTL alone.
5. **Async by default for heavy work** — Reports, exports, embeddings return 202 + job ID.
6. **Noisy neighbor isolation** — Per-tenant rate limits and fair queuing.
7. **Performance is everyone's job** — Feature teams own their service latency; SRE owns platform capacity.
8. **Regression prevention over remediation** — CI gates catch degradation before production.

---

## Implementation Approach

### 1. Latency Budgets

#### End-to-End Budget Model

Total user-facing latency is decomposed into allocatable segments:

```
Total P99 Budget (500ms) =
    Edge/CDN (20ms)
  + API Gateway (30ms)
  + Auth/AuthZ (40ms)
  + Service Logic (200ms)
  + Data Access (150ms)
  + Serialization (20ms)
  + Buffer (40ms)
```

#### Endpoint Tier Classification

| Tier | Description | P50 Target | P95 Target | P99 Target | Examples |
|------|-------------|------------|------------|------------|----------|
| **T0 — Interactive Critical** | User-blocking UI paths | < 50ms | < 150ms | < 300ms | Auth token, session, navigation |
| **T1 — Interactive Standard** | CRUD operations | < 100ms | < 300ms | < 500ms | Get contact, list invoices, create task |
| **T2 — Interactive Heavy** | Complex queries | < 200ms | < 500ms | < 1000ms | Search, dashboard aggregates, reports (sync) |
| **T3 — Async Job** | Background processing | N/A | < 5s (submit) | < 30s (P95 completion) | Export, bulk import, embedding |
| **T4 — AI Interactive** | Agent copilot | < 2s (first token) | < 10s | < 30s | Agent query, analysis |
| **T5 — AI Background** | Scheduled agents | N/A | N/A | < 60s (P95) | Anomaly detection, pipeline analysis |
| **T6 — Webhook** | Outbound delivery | < 5s (P95) | < 30s | < 60s (SLO) | Event webhooks |

#### Per-Service Latency Budgets

| Service | Tier | P99 Budget | Allocation Notes |
|---------|------|------------|------------------|
| api-gateway | T0 | 30ms | Routing, rate limit, TLS |
| auth-service | T0 | 40ms | Token validation, session |
| crm-api | T1 | 200ms | 100ms logic + 100ms DB |
| finance-api | T1 | 200ms | Stricter audit logging |
| search-api | T2 | 800ms | OpenSearch query allowance |
| workflow-runtime | T1 | 250ms | State machine transition |
| agent-orchestrator | T4 | 30s | Includes LLM call |
| notification-worker | T6 | 60s | Delivery SLA |
| embedding-worker | T5 | 60s | Batch processing |

#### Budget Enforcement

| Mechanism | Detail |
|-----------|--------|
| OpenTelemetry spans | Each segment tagged; budget exceeded → span event |
| CI perf gate | Critical services must pass k6 thresholds |
| Code review | New endpoints declare tier in OpenAPI spec |
| Architecture review | T2+ endpoints require justification |
| Production alerts | P99 > budget for 15m → P2 alert |

#### OpenAPI Tier Annotation

```yaml
paths:
  /v1/contacts/{id}:
    get:
      x-atlas-performance-tier: T1
      x-atlas-latency-budget-p99-ms: 500
```

### 2. Throughput Targets

#### Platform Scale Targets

| Dimension | Year 1 | Year 3 | Year 5 |
|-----------|--------|--------|--------|
| Organizations | 100K | 5M | 20M |
| Active users | 1M | 50M | 200M |
| API requests/month | 500M | 10B | 50B |
| Peak RPS (global) | 50K | 500K | 2M |
| Kafka messages/day | 100M | 5B | 20B |
| Concurrent agent runs | 5K | 50K | 200K |

#### Per-Service Throughput Targets (Year 1 Design Point)

| Service | Sustained RPS | Peak RPS | Min Replicas | Max Replicas |
|---------|---------------|----------|--------------|--------------|
| api-gateway | 10K | 30K | 10 | 500 |
| auth-service | 5K | 15K | 5 | 100 |
| crm-api | 3K | 10K | 3 | 100 |
| finance-api | 2K | 8K | 3 | 100 |
| search-api | 2K | 6K | 3 | 50 |
| workflow-runtime | 1K | 5K | 5 | 200 |
| automation-executor | 5K jobs/min | 20K jobs/min | 10 | 500 |
| agent-worker | 500 runs/min | 2K runs/min | 5 | 300 |

#### Per-Tenant Fairness

| Control | Limit (Growth tier) | Limit (Enterprise) |
|---------|---------------------|-------------------|
| API RPS | 100 | Configurable (default 1000) |
| Concurrent agent runs | 5 | Configurable (default 50) |
| Background jobs | 50 concurrent | Configurable |
| Webhook deliveries | 100/min | Configurable |
| Export size | 100K rows | Configurable |

#### Throughput Testing Requirements

| Test | Target | Environment |
|------|--------|-------------|
| Sustained load | 100% of Year 1 peak for 1h | Staging |
| Burst load | 3× peak for 15 min | Staging |
| Recovery | < 5 min to normal after burst | Staging |
| Tenant isolation | Noisy tenant doesn't affect neighbors | Staging |

### 3. Caching Strategy

#### Multi-Layer Cache Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: CDN (CloudFront/Fastly) — Static assets, branding  │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Edge (future) — OAuth discovery, public status     │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Redis Cluster — Sessions, permissions, hot entities  │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: Application Cache — Config, workflow defs (in-pod)   │
├─────────────────────────────────────────────────────────────┤
│ Layer 5: Database — Read replicas, materialized views         │
├─────────────────────────────────────────────────────────────┤
│ Layer 6: AI Query Cache — Redis (org+query hash, 1h TTL)    │
└─────────────────────────────────────────────────────────────┘
```

#### Layer 1: CDN

| Content | TTL | Invalidation | Cache Hit Target |
|---------|-----|--------------|------------------|
| Static assets (JS/CSS, hashed) | 1 year | Deploy | > 99% |
| Public marketing pages | 1 hour | API purge | > 90% |
| Tenant branding assets | 24 hours | Update event | > 85% |
| API responses (authenticated) | **None** | — | — |

#### Layer 2: Redis Cluster

| Use Case | Pattern | TTL | Invalidation | Hit Rate Target |
|----------|---------|-----|--------------|-----------------|
| Session store | Hash | 24h | Logout event | > 99% |
| Permission cache | String (JSON) | 5 min | Role change event | > 90% |
| Rate limiting | Sliding window | 1h | N/A | N/A |
| Hot entity reads | String (JSON) | 5 min | Entity update event | > 85% |
| Workflow definitions | String | 15 min | Publish event | > 95% |
| Idempotency keys | String | 24h | N/A | N/A |
| AI query cache | String | 1h | Entity update event | > 60% |
| STM (agent memory) | List | 24h | Session end | > 90% |

**Cache key format:** `{tenant_id}:{service}:{entity}:{id}`

**Invalidation rules:**

- Event-driven via Kafka (`cache.invalidate` topic)
- **Never** pure TTL for auth/permission data
- Cascade invalidation for related entities (contact → deals)

#### Layer 3: Application Cache (In-Process)

| Content | Max Size | TTL | Scope |
|---------|----------|-----|-------|
| Feature flags (evaluated) | 5 MB | 60s | Per pod |
| Module config | 5 MB | 60s | Per pod |
| Published schemas | 5 MB | 300s | Per pod |

Implementation: Caffeine (JVM) / LRU (Go). Tenant-scoped entries only.

#### Layer 4: Database Optimizations

| Technique | Use Case |
|-----------|----------|
| Read replicas | 90% of OLTP reads |
| Connection pooling (PgBouncer) | All services; 20 per pod |
| Materialized views | Dashboard aggregates (async refresh) |
| Partial indexes | Tenant-scoped queries |
| Cursor pagination | All list endpoints (no OFFSET) |

#### Cache-Aside Pattern (Standard)

```python
def get_entity(tenant_id, entity_id):
    key = f"{tenant_id}:entity:{entity_id}"
    cached = redis.get(key)
    if cached:
        metrics.cache_hit(key)
        return cached
    entity = db.query(tenant_id, entity_id)
    redis.setex(key, 300, entity)
    metrics.cache_miss(key)
    return entity
```

#### Cache Stampede Prevention

| Technique | Application |
|-----------|-------------|
| Request coalescing | Hot key reads (single-flight) |
| Jittered TTL | ±10% randomization |
| Probabilistic early refresh | High-traffic keys |
| Circuit breaker | Redis unavailable → DB fallback |

#### Caching Governance

| Rule | Enforcement |
|------|-------------|
| New cache requires PR justification | Architecture review |
| Auth data event-invalidated | CI lint |
| Cache metrics required | `atlas_cache_hits_total`, `atlas_cache_misses_total` |
| Hit rate dashboards | Per-service Grafana panel |

### 4. Load Testing Cadence

#### Test Schedule

| Test Type | Tool | Frequency | Environment | Duration |
|-----------|------|-----------|-------------|----------|
| **Baseline** | k6 | Weekly | Staging | 50 min |
| **Peak simulation** | k6/Gatling | Monthly | Staging (isolated) | 2h |
| **Soak test** | k6 | Quarterly | Staging | 72h |
| **Spike test** | k6 | Monthly | Staging | 30 min |
| **Chaos + load** | Litmus + k6 | Quarterly | Staging | 4h |
| **Tenant isolation** | Custom | Monthly | Staging | 1h |
| **AI load** | k6 + eval | Monthly | Staging | 1h |
| **PR regression** | k6 | Per PR (critical) | CI | 5 min |

#### Load Test Scenarios

| Scenario | Mix | Target |
|----------|-----|--------|
| **Mixed API** | 70% read, 25% write, 5% search | P99 < 500ms at 5K VU |
| **Auth storm** | 100% auth endpoints | P99 < 300ms at 10K VU |
| **CRM burst** | Create/read contacts, deals | P99 < 500ms at 3K VU |
| **Finance close** | Invoice list, payment record | P99 < 500ms at 2K VU |
| **Workflow peak** | Start/complete instances | P99 < 1s at 1K VU |
| **Agent concurrent** | 500 parallel agent queries | P99 < 30s |
| **Webhook flood** | 10K deliveries/min | 99.9% within 60s |
| **Noisy neighbor** | 1 tenant at 10× fair share | Others within SLO |

#### k6 Threshold Configuration

```javascript
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
    'http_req_duration{tier:T0}': ['p(99)<300'],
    'http_req_duration{tier:T1}': ['p(99)<500'],
  },
};
```

#### Load Test Environment

| Requirement | Detail |
|-------------|--------|
| Isolation | Dedicated window; no other tests |
| Parity | 20% production scale; same topology |
| Data | Anonymized prod snapshot |
| Monitoring | Full observability stack active |
| Cleanup | Reset state post-test |

**Production load testing:** Synthetic traffic only (STRAT-11); never unannounced prod load.

### 5. Regression Detection

#### Detection Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: CI Performance Gate (PR) — k6 mini, 5 min         │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Staging Weekly Baseline — compare to stored baseline│
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Production Continuous — SLO burn rate alerts         │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: APM Profiling — Pyroscope flame graphs (Phase 2)   │
└─────────────────────────────────────────────────────────────┘
```

#### CI Regression Gate (Critical Services)

Triggered when PR touches: `api-gateway`, `auth-service`, database queries, cache layer.

| Metric | Baseline Comparison | Gate |
|--------|---------------------|------|
| P99 latency | Stored baseline | Block if > 10% degradation |
| Error rate | Stored baseline | Block if > 0.1% absolute increase |
| Throughput | Stored baseline | Block if > 10% decrease |

```yaml
# CI performance gate
thresholds:
  http_req_duration:
    - 'p(99)<500'
  http_req_failed:
    - 'rate<0.001'
regression:
  p99_max_degradation_percent: 10
  baseline_ref: main@staging-baseline-2026-06-30
```

#### Weekly Baseline Comparison

| Step | Action |
|------|--------|
| 1 | Run full baseline suite (Wednesday 02:00 UTC) |
| 2 | Compare to stored baseline (4-week rolling median) |
| 3 | Generate regression report |
| 4 | > 5% degradation → Jira ticket auto-created |
| 5 | > 10% degradation → P3 alert to service owner |

#### Production Regression Detection

| Signal | Detection | Alert |
|--------|-----------|-------|
| P99 latency increase | 15% over 1h vs 7d median | P2 |
| Error rate increase | 0.1% absolute over 15m | P1/P2 by tier |
| Throughput decrease | 20% under expected for time-of-day | P3 |
| Cache hit rate drop | > 10% decrease | P3 |
| DB query latency | p95 > 100ms sustained | P2 |

#### Regression Response Process

1. **Identify** — Correlate with deploy, config change, traffic pattern
2. **Triage** — Service owner + SRE within 1h (P2)
3. **Mitigate** — Rollback, scale, cache warm, query kill
4. **Root cause** — Query plan, N+1, cache invalidation, resource limit
5. **Prevent** — Add perf test, fix baseline, update budget

### 6. Capacity Planning

#### Methodology

```
1. Forecast demand (tenant growth × usage per tenant)
2. Load test to establish per-unit capacity (RPS per pod)
3. Calculate headroom: target 40% peak utilization
4. Plan quarterly infrastructure purchases
5. Validate in game day
```

#### Capacity Model (Year 1)

| Resource | Per 10K RPS | Headroom Factor | Year 1 Provision |
|----------|-------------|-----------------|------------------|
| API pods (1K RPS each) | 10 pods | 2.5× | 125 pods peak |
| PostgreSQL IOPS | 50K | 2× | 500K IOPS |
| Redis memory | 32 GB | 1.5× | 256 GB cluster |
| Kafka brokers | 3 | 2× | 6 brokers |
| OpenSearch nodes | 3 | 2× | 6 nodes |

#### Auto-Scaling Configuration

| Service | Min | Max | Primary Metric | Scale-Up | Scale-Down |
|---------|-----|-----|----------------|----------|------------|
| api-gateway | 10 | 500 | RPS + CPU | 60s / 100% | 300s / 10% |
| auth-service | 5 | 100 | RPS + latency | 60s / 100% | 300s / 10% |
| finance-api | 3 | 100 | RPS | 60s / 50% | 300s / 10% |
| workflow-runtime | 5 | 200 | Queue depth | 120s / 50% | 600s / 10% |
| automation-executor | 10 | 500 | Kafka lag | 60s / 100% | 300s / 10% |
| agent-worker | 5 | 300 | Queue depth + cost | 120s / 50% | 600s / 10% |

#### Capacity Triggers

| Metric | Action |
|--------|--------|
| CPU > 70% sustained (1h) | HPA (automatic) |
| DB connections > 80% | Add PgBouncer capacity |
| Disk > 75% | Expand storage / archive |
| Kafka disk > 70% | Retention tiering |
| Redis memory > 80% | Scale cluster; review TTLs |
| Cache hit rate < 70% | Review caching strategy |

### 7. Performance Optimization Process

#### Query Performance

| Rule | Enforcement |
|------|-------------|
| `EXPLAIN ANALYZE` for queries > 50ms | Code review |
| No N+1 queries | ORM lint; integration test |
| Cursor pagination only | API lint |
| Index per tenant-scoped query pattern | Schema review |

#### Async Processing

| Operation | Sync Threshold | Async Pattern |
|-----------|----------------|---------------|
| Report generation | < 3s | 202 + job ID |
| Bulk import | > 100 rows | 202 + job ID |
| Document embedding | Always | Kafka queue |
| Email send | Always | Kafka queue |
| Webhook delivery | Always | Kafka queue with retry |

---

## Tooling

| Category | Tool | Purpose |
|----------|------|---------|
| Load testing | k6, Gatling | Performance benchmarks |
| CI perf gates | k6 in GitHub Actions | PR regression detection |
| APM | OpenTelemetry + Grafana | Latency tracing |
| Profiling | Pyroscope | Continuous profiling (Phase 2) |
| Caching | Redis Cluster, CloudFront | Multi-layer cache |
| DB pooling | PgBouncer, RDS Proxy | Connection multiplexing |
| Auto-scaling | HPA, Karpenter | Dynamic capacity |
| Metrics | Prometheus | Performance metrics |
| Dashboards | Grafana | Latency, throughput, cache |
| Query analysis | pg_stat_statements, EXPLAIN | DB optimization |
| Chaos | Litmus | Performance under failure |

---

## Processes

### Performance Review Cadence

| Activity | Frequency | Participants |
|----------|-----------|--------------|
| Weekly baseline test | Weekly | SRE |
| Baseline comparison report | Weekly | SRE + service owners |
| Monthly peak simulation | Monthly | SRE + feature teams |
| Quarterly soak test | Quarterly | SRE |
| Quarterly capacity review | Quarterly | SRE + FinOps + Leadership |
| Performance regression triage | As needed | Service owner + SRE |

### New Endpoint Performance Checklist

- [ ] Tier classification assigned (T0–T6)
- [ ] Latency budget documented in OpenAPI
- [ ] Caching strategy defined (if applicable)
- [ ] Query plans reviewed (if DB access)
- [ ] k6 scenario added (if T0/T1)
- [ ] Grafana panel added to service dashboard
- [ ] Load test included in monthly suite (if high-traffic)

### Performance Incident Process

1. Alert or report of degradation
2. Correlate with deploys, traffic, dependencies
3. Mitigate (scale, rollback, cache, query kill)
4. Root cause analysis within 48h
5. Add regression test if test gap identified
6. Update baseline if permanent change

---

## Metrics

### Performance Program KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| API P99 latency (platform) | < 500ms | Prometheus |
| API P99 latency (Tier 0) | < 300ms | Prometheus |
| Throughput at peak (Year 1) | 50K RPS | Load test + prod |
| Load test pass rate | 100% weekly | k6 results |
| Regression detection time | < 24h | CI + weekly compare |
| Cache hit rate (Redis hot paths) | ≥ 85% | Prometheus |
| Capacity headroom at peak | ≤ 40% utilization | HPA metrics |
| Performance-related incidents | < 5% of total | Incident log |
| Query p95 (database) | < 50ms | pg_stat_statements |
| Async job P95 completion | < 30s (T3) | Worker metrics |

### Service-Level Metrics

| Metric | Alert Threshold |
|--------|-----------------|
| `http_request_duration_seconds` p99 | > tier budget for 15m |
| `atlas_cache_hit_ratio` | < 70% for 1h |
| `pg_stat_activity_count` | > 80% max connections |
| `kafka_consumer_lag` | > 50K for 30m |
| `container_cpu_usage` | > 80% for 30m |
| `redis_memory_used_bytes` | > 85% maxmemory |

### Cost-Performance Metrics

| Metric | Purpose |
|--------|---------|
| Cost per API request | Efficiency tracking |
| Cost per cache GB | Redis ROI |
| Cost per RPS capacity | Scaling efficiency |
| DB IOPS per request | Query optimization ROI |

---

## Responsibilities (RACI)

| Activity | Feature Team | SRE/Platform | Data Platform | FinOps | Architect | Product |
|----------|:------------:|:------------:|:-------------:|:------:|:---------:|:-------:|
| Latency budget assignment | R | C | C | I | A | C |
| Service-level optimization | R/A | C | C | I | C | I |
| Caching implementation | R/A | C | I | I | C | I |
| Load test authoring | C | R/A | C | I | C | I |
| Weekly baseline execution | I | R/A | I | I | I | I |
| CI perf gate configuration | C | R/A | I | I | C | I |
| Regression triage | R | R/A | C | I | C | I |
| Capacity planning | C | R/A | C | C | C | I |
| HPA configuration | C | R/A | I | I | C | I |
| DB query optimization | C | C | R/A | I | C | I |
| Performance incident response | R | R/A | C | I | C | I |
| Async pattern adoption | R/A | C | I | I | C | C |
| Tenant rate limits | C | R/A | I | I | C | C |
| AI performance (latency) | C | C | I | C | C | R/A |

**Legend:** R = Responsible, A = Accountable, C = Consulted, I = Informed

---

## Maturity Roadmap

### Level 1 — Baseline Measurement (M1–M2)

| Capability | Required |
|------------|----------|
| OpenTelemetry instrumentation (Tier 0/1) | ✓ |
| Prometheus latency histograms | ✓ |
| Service dashboards (RED metrics) | ✓ |
| Weekly k6 baseline (5 scenarios) | ✓ |
| Redis caching (sessions, permissions) | ✓ |
| HPA on api-gateway, auth | ✓ |
| Latency tier documented (OpenAPI) | ✓ |

**Exit criteria:** P99 measurable on all Tier 0/1; weekly baseline running.

### Level 2 — Regression Prevention (M3–M4)

| Capability | Required |
|------------|----------|
| CI perf gate (critical services) | ✓ |
| Weekly baseline comparison automated | ✓ |
| Cache hit rate dashboards | ✓ |
| PgBouncer on all services | ✓ |
| Latency budgets enforced (alerts) | ✓ |
| Monthly peak simulation | ✓ |
| Tenant rate limiting | ✓ |
| Read replica routing | ✓ |

**Exit criteria:** Zero undetected > 10% regressions for 3 months.

### Level 3 — Proactive Performance (M5–M8)

| Capability | Required |
|------------|----------|
| Full load test suite (all scenarios) | ✓ |
| Quarterly 72h soak test | ✓ |
| Pyroscope profiling (pilot) | ✓ |
| Event-driven cache invalidation | ✓ |
| Materialized views (dashboards) | ✓ |
| AI load testing | ✓ |
| Capacity planning automated | ✓ |
| Noisy neighbor testing monthly | ✓ |

**Exit criteria:** P99 < 500ms at Year 1 peak; cache hit > 85%.

### Level 4 — Performance Excellence (M9–M12)

| Capability | Target |
|------------|--------|
| Continuous profiling (all Tier 0/1) | ✓ |
| ML-based anomaly detection (latency) | ✓ |
| Auto-scaling PostgreSQL (Aurora Serverless v2) | Pilot |
| Edge caching (auth validation) | Evaluate |
| Performance SLOs per endpoint | ✓ |
| Cost-per-request optimization automated | ✓ |
| Tenant shard routing (hot tenant isolation) | ✓ |
| Performance chaos game days | ✓ |

**Exit criteria:** P99 < 300ms Tier 0; < 5% performance incidents; 40% headroom at peak.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Cache stampede | Single-flight; jittered TTL |
| HPA thrashing | Stabilization windows; proper metrics |
| Connection pool exhaustion | PgBouncer; per-service limits |
| Load test environment drift | Weekly data refresh; parity audits |
| Performance regression undetected | CI gate + weekly baseline + prod alerts |
| Noisy neighbor | Per-tenant limits; fair queuing; circuit breaker |
| AI latency spikes | Model routing; queue; timeout; streaming |

---

## Open Questions

| ID | Question | Owner | Target |
|----|----------|-------|--------|
| OQ-STRAT-15-01 | Dedicated perf environment vs shared staging? | SRE | M3 (shared with isolation) |
| OQ-STRAT-15-02 | Aurora Serverless v2 pilot scope? | Data Platform | M6 |
| OQ-STRAT-15-03 | Edge auth caching (Lambda@Edge)? | Platform | M10 |
| OQ-STRAT-15-04 | Shard count 32 vs 64 at Phase 2? | Data Platform | M8 |
| OQ-STRAT-15-05 | Per-endpoint SLOs in customer contracts? | Product | M9 |

---

## References

- [ARCH-23 Scaling](../phase-1/23-scaling.md)
- [ARCH-05 Database Architecture](../phase-1/05-database-architecture.md)
- [ARCH-06 API Architecture](../phase-1/06-api-architecture.md)
- [ARCH-19 Monitoring](../phase-1/19-monitoring.md)
- [ARCH-24 Testing](../phase-1/24-testing.md)
- [STRAT-10 Deployment Strategy](10-deployment-strategy.md)
- [STRAT-11 Monitoring Strategy](11-monitoring-strategy.md)
- [STRAT-12 Testing Strategy](12-testing-strategy.md)
- [STRAT-14 AI Strategy](14-ai-strategy.md)

---

*Document owner: Site Reliability Engineering · Review cadence: Quarterly*