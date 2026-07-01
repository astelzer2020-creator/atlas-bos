# Phase 7 — Production Infrastructure

**Started:** 2026-06-30  
**Status:** Production Runtime Complete

Phase 7 adds background processing, event infrastructure, observability, container deployment, and integration test coverage on top of the Phase 6 platform foundations.

**Previous phase:** [Phase 6 — Platform Foundations](../phase-6/README.md)

---

## Milestones

| # | Milestone | Package / App | Tests | Status |
|---|-----------|---------------|-------|--------|
| 1 | Event Bus | `@atlas/event-bus` | 7+ unit | Complete |
| 2 | Job Queue | `@atlas/queue` | 4+ unit | Complete |
| 3 | Background Worker | `@atlas/worker` | 2+ unit | Complete |
| 4 | Docker Images | `infra/docker/` | — | Complete |
| 5 | Kubernetes Manifests | `infra/k8s/` | — | Complete |
| 6 | Observability Stack | Prometheus + Grafana | — | Complete |
| 7 | Integration Tests | `@atlas/integration-tests` | 20 (11 mock + 9 live*) | Complete |
| 8 | Cron Schedule Engine | `@atlas/module-automation` | 4 unit | Complete |
| 9 | Hybrid Semantic Search | `@atlas/module-ai-memory` | 4 unit | Complete |
| 10 | AI Tool Registry | `@atlas/module-ai` | 3 unit | Complete |
| 11 | E2E Tests | `@atlas/e2e-tests` | Playwright smoke | Complete |
| 12 | Performance Tests | `@atlas/performance-tests` | 3 benchmarks | Complete |
| 13 | Knowledge Base UI | `@atlas/web` `/ai/knowledge` | build | Complete |

\*Live suites skip gracefully when services are unavailable.

---

## Worker Architecture

`@atlas/worker` is a standalone Node process that hosts BullMQ processors, Kafka consumers, and a lightweight HTTP health server.

### Process layout

```
apps/worker/
├── src/
│   ├── main.ts              # Bootstrap, graceful shutdown
│   ├── health.ts            # GET /health, /ready, /metrics
│   ├── config.ts            # Worker-specific env (Kafka, poll intervals)
│   ├── di/container.ts        # Wires Prisma, queue, event bus, modules
│   └── workers/
│       ├── outbox-publisher.worker.ts
│       ├── workflow-runtime.worker.ts
│       ├── automation-matcher.worker.ts
│       ├── ai-executor.worker.ts
│       ├── notification-delivery.worker.ts
│       └── scheduled-jobs.worker.ts
```

### Worker processors

| Worker | Queue / Trigger | Responsibility |
|--------|-----------------|----------------|
| **Outbox Publisher** | DB poll interval | Reads `atlas_audit.outbox`, publishes CloudEvents to Kafka + Redis fan-out |
| **Workflow Runtime** | `default` queue | Advances workflow instances, approval steps |
| **Automation Matcher** | Kafka consumer | Matches domain events to automation rules |
| **AI Executor** | `ai` queue | Executes agent runs (stub executor in dev; pluggable for LLM providers) |
| **Notification Delivery** | `email` queue | Delivers in-app and email notifications |
| **Scheduled Jobs** | Interval timer | Evaluates cron triggers, executes due automation rules with Redis dedup |

### Health endpoints

| Endpoint | Port (default) | Purpose |
|----------|------------------|---------|
| `GET /health` | 3002 | Liveness — process is up |
| `GET /ready` | 3002 | Readiness — database reachable |
| `GET /metrics` | 3002 | Prometheus scrape (when `PROMETHEUS_ENABLED=true`) |

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_PORT` | `3002` | Health server port |
| `WORKER_HOST` | `0.0.0.0` | Health server bind address |
| `KAFKA_BROKERS` | `localhost:9092` | Redpanda/Kafka brokers |
| `KAFKA_MOCK` | `false` (auto `true` in dev/test) | Use no-op Kafka producer |
| `OUTBOX_POLL_INTERVAL_MS` | `5000` | Outbox polling cadence |
| `SCHEDULED_JOBS_INTERVAL_MS` | `60000` | Scheduled job tick interval |
| `REDIS_URL` | `redis://localhost:6379` | BullMQ + Redis pub/sub |

---

## Event Bus (Kafka / Redis)

`@atlas/event-bus` implements a hybrid event distribution model:

- **Kafka (Redpanda locally)** — durable, partitioned event log for cross-service consumption
- **Redis pub/sub** — low-latency local fan-out for development and co-located subscribers

### CloudEvents envelope

All domain events use [CloudEvents 1.0](https://cloudevents.io/) with Atlas extensions:

```typescript
import { buildCloudEvent, parseCloudEvent } from '@atlas/event-bus';

const event = buildCloudEvent({
  source: 'atlas://customer-service',
  type: 'customer.contact.created.v1',
  subject: contactId,
  organizationId,
  workspaceId,
  correlationId,
  causationId,
  actor: { type: 'user', id: userId },
  aggregate: { type: 'contact', id: contactId, version: 1 },
  payload: { contactId, displayName, email },
});
```

### Topic naming

Event types map to Kafka topics via `eventTypeToTopic()`:

```
customer.contact.created.v1  →  atlas.customer.contact.created.v1
```

Failed consumer messages route to DLQ topics via `consumerDlqTopic()`.

### AtlasEventBus facade

```typescript
const eventBus = new AtlasEventBus(kafkaProducer, redisPubSub, { localFanout: true });
await eventBus.connect();
await eventBus.publish(cloudEvent);
```

In development, `KAFKA_MOCK=true` (or `NODE_ENV=development`) uses `NoOpKafkaProducer` while Redis fan-out remains active.

---

## Queue System (BullMQ / DLQ)

`@atlas/queue` wraps BullMQ with Atlas conventions: typed job envelopes, per-queue retry policies, timeouts, and DLQ handling.

### Queue catalog

| Queue | Attempts | Timeout | Use case |
|-------|----------|---------|----------|
| `critical` | 7 | 60s | Payments, webhooks |
| `default` | 5 | 120s | General async work |
| `bulk` | 3 | 1h | Batch imports/exports |
| `scheduled` | 5 | 5m | Cron-style jobs |
| `email` | 7 | 30s | Notification delivery |
| `ai` | 3 | 5m | Agent run execution |
| `webhook` | 7 | 35s | Outbound webhook delivery |

### Job envelope

Every job carries a validated envelope:

```typescript
import { buildJobEnvelope, validateJobEnvelope } from '@atlas/queue';

const envelope = buildJobEnvelope({
  queue: 'email',
  jobName: 'send-welcome-email',
  payload: { userId },
  organizationId,
  correlationId,
});
```

### DLQ

When `attemptsMade >= maxAttempts`, `moveFailedJobToDlq()` archives the job. Operators can list and replay DLQ entries via `listDlqJobs()` / `replayDlqJob()`.

---

## Docker / Kubernetes Deployment

### Local infrastructure (`docker compose up -d`)

| Service | Image | Port |
|---------|-------|------|
| PostgreSQL (pgvector) | `pgvector/pgvector:pg16` | 5432 |
| Redis | `redis:7-alpine` | 6379 |
| Redpanda (Kafka) | `redpandadata/redpanda` | 9092 |
| Prometheus | `prom/prometheus` | 9090 |
| Grafana | `grafana/grafana` | 3003 |

### Production compose (`docker compose -f docker-compose.prod.yml up -d`)

Builds and runs `api`, `worker`, and `web` images alongside infrastructure. Requires `JWT_SECRET` in environment.

### Dockerfiles

| Image | Dockerfile | Base |
|-------|------------|------|
| API | `infra/docker/Dockerfile.api` | Node 20 Alpine, multi-stage |
| Worker | `infra/docker/Dockerfile.worker` | Node 20 Alpine, multi-stage |
| Web | `infra/docker/Dockerfile.web` | Node 20 Alpine, Next.js standalone |

### Kubernetes (`infra/k8s/`)

| Manifest | Purpose |
|----------|---------|
| `namespace.yaml` | `atlas` namespace |
| `configmap.yaml` | Non-secret configuration |
| `secret.yaml.example` | Template for secrets |
| `api-deployment.yaml` / `api-service.yaml` | API replicas + ClusterIP |
| `worker-deployment.yaml` / `worker-service.yaml` | Worker replicas + health port |
| `web-deployment.yaml` | Next.js frontend |
| `ingress.yaml` | External routing |
| `hpa-api.yaml` | API horizontal pod autoscaling |

Readiness/liveness probes target `/ready` and `/health`. Prometheus annotations scrape `/metrics` on ports 3001 (API) and 3002 (worker).

---

## Frontend Routes

`@atlas/web` (Next.js 15 App Router) provides the authenticated shell:

| Route | Layout | Description |
|-------|--------|-------------|
| `/` | Root | Landing / redirect |
| `/login` | `(auth)` | Sign-in |
| `/register` | `(auth)` | Registration |
| `/dashboard` | `(app)` | Authenticated dashboard shell |

The `(app)` layout includes sidebar navigation placeholders for CRM, Finance, Projects, and Settings. Full Phase 4 UI screens are wired incrementally.

Environment: `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`).

---

## AI Memory / RAG

### Current implementation (Phase 7)

- **Agent definitions** store `memoryConfig` JSON on `ai_agents.agent_definitions`.
- **Agent runs** execute via the `ai-executor` worker on the `ai` BullMQ queue.
- **Pluggable executor** — `StubAgentExecutor` completes runs locally; swap for LLM providers in production.
- **Tool registry** — built-in `get_current_time` and `echo` tools with `AgentToolRegistry.invoke()`.
- **Hybrid retrieval** — keyword + deterministic local embeddings (64-dim) via `rankByHybridSearch()`.
- **Knowledge base UI** — `/ai/knowledge` for document upload, chunking, and semantic search.

Embeddings are stored as `FLOAT8[]` on `memory_chunks` and `knowledge_chunks`. Replace `generateLocalEmbedding()` with provider-backed vectors when API keys are available.

See [`docs/database/11-ai-memory.md`](../../database/11-ai-memory.md) for the full ERD.

---

## Run Full Stack Locally

### 1. Infrastructure

```bash
cp .env.example .env
docker compose up -d
```

### 2. Install and migrate

```bash
pnpm install
pnpm db:generate
pnpm db:migrate   # or pnpm db:push for dev
```

### 3. Start all application processes

```bash
# Parallel API + worker + web (recommended)
pnpm dev:all

# Or individually:
pnpm --filter @atlas/api dev
pnpm --filter @atlas/worker dev
pnpm --filter @atlas/web dev
```

### 4. Verify

| Service | URL |
|---------|-----|
| Web | http://localhost:3000 |
| API health | http://localhost:3001/health |
| API ready | http://localhost:3001/ready |
| Worker health | http://localhost:3002/health |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3003 (admin/admin) |

### 5. Production-like stack

```bash
JWT_SECRET="$(openssl rand -hex 32)" docker compose -f docker-compose.prod.yml up -d --build
```

---

## Test Commands

### Unit tests (all packages)

```bash
pnpm test
pnpm test:unit
```

### Integration tests

```bash
# Mock fallbacks always run; live probes run when services are up
pnpm test:integration

# With full stack running:
docker compose up -d
pnpm dev:all   # separate terminal
pnpm test:integration
```

### E2E tests (Playwright)

```bash
pnpm test:e2e
# Or with an existing dev server:
E2E_SKIP_WEB_SERVER=true pnpm test:e2e
```

Smoke tests cover landing, login, register, and mobile viewport. Suites skip gracefully when the web server is unavailable.

### Performance tests

```bash
pnpm test:performance
```

Benchmarks hybrid search (2000 chunks < 500ms) and queue/event envelope throughput (10k ops).

Integration tests probe `API_BASE_URL`, `WORKER_BASE_URL`, and `REDIS_URL`. Live suites are **skipped gracefully** when services are unavailable.

| Suite | Mock tests | Live tests (when available) |
|-------|------------|----------------------------|
| `api-health` | In-process Fastify `/health`, `/ready`, `/metrics` | Running API endpoints |
| `queue-envelope` | Envelope build/validate | BullMQ enqueue + idempotency |
| `event-bus-cloudevents` | CloudEvents round-trip | Redis pub/sub delivery |
| `worker-health` | In-process health server | Running worker endpoints |

Optional: set `INTEGRATION_USE_TESTCONTAINERS=true` and install `@testcontainers/redis` to spin ephemeral Redis when Docker is available.

### Per-package tests

```bash
pnpm --filter @atlas/event-bus test
pnpm --filter @atlas/queue test
pnpm --filter @atlas/worker test
pnpm --filter @atlas/api test
pnpm --filter @atlas/integration-tests test
```

---

## Monorepo Additions (Phase 7)

```
atlas-bos/
├── apps/
│   ├── api/
│   ├── web/
│   ├── worker/                 # NEW — background processors
│   └── integration-tests/      # NEW — cross-service tests
├── packages/
│   ├── event-bus/              # NEW — Kafka + Redis + CloudEvents
│   └── queue/                  # NEW — BullMQ + DLQ
├── infra/
│   ├── docker/                 # Dockerfiles
│   ├── k8s/                    # Kubernetes manifests
│   ├── prometheus/
│   └── grafana/
├── docker-compose.yml          # Dev infrastructure
└── docker-compose.prod.yml     # Full production stack
```

---

## Next Steps (Beyond Phase 7)

- Full Phase 4 UI screen implementation (208-screen spec)
- Provider-backed embeddings (OpenAI, Anthropic, etc.) with pgvector index
- HR, ERP, Marketing, Analytics domains
- Multi-region deployment and secrets management (Vault / External Secrets)
- Live E2E flows with authenticated test fixtures