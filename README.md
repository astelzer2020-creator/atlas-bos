# Atlas — Business Operating System

**Codename:** Atlas  
**Version:** 1.0.0  
**Status:** Production-ready — v1.0 release

---

## Vision

Atlas is the operating system for businesses. Instead of stitching together dozens of disconnected SaaS products (CRM, ERP, accounting, project management, HR, support, documents, messaging, AI, and more), everything lives in one unified platform where AI understands every part of the business and can act on it.

## What's in v1.0

| Area | Highlights |
|------|------------|
| **Platform** | Monorepo (pnpm + Turbo), 11 domain modules, Fastify API, Next.js 15 web, background worker |
| **Identity** | JWT auth, RBAC, RLS, MFA challenge UI, org/workspace onboarding wizard |
| **Product UI** | CRM account details, members, audit log, approvals, notifications bell, toast system |
| **Infrastructure** | Docker images, `docker-compose.prod.yml`, Kubernetes manifests, Prometheus + Grafana |
| **Quality** | CI/CD pipeline, integration tests, Playwright E2E smoke tests, `pnpm validate` |

## Quick Start

### Prerequisites

- Node.js ≥ 20, pnpm ≥ 9
- Docker Desktop (PostgreSQL, Redis, Redpanda, observability stack)

### 1. Clone and configure

```bash
git clone <repository-url> atlas-bos
cd atlas-bos
cp .env.example .env
```

Validate environment variables:

```bash
pnpm env:validate
```

### 2. Start infrastructure

```bash
docker compose up -d
```

### 3. Install, migrate, and run

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev:all
```

| Service | URL |
|---------|-----|
| Web | http://localhost:3000 |
| API health | http://localhost:3001/health |
| API ready | http://localhost:3001/ready |
| Worker health | http://localhost:3002/health |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3003 |

### Production-like local stack

```bash
# Linux/macOS
JWT_SECRET="$(openssl rand -hex 32)" docker compose -f docker-compose.prod.yml up -d --build

# Windows PowerShell
$env:JWT_SECRET = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
docker compose -f docker-compose.prod.yml up -d --build
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full production deployment.

## Validation

Run the full Windows-safe validation suite (lint, build, typecheck, unit tests, integration tests, E2E):

```bash
pnpm validate
```

Individual test targets:

```bash
pnpm test              # All unit tests via Turbo
pnpm test:integration  # Cross-service integration tests
pnpm test:e2e          # Playwright smoke tests
pnpm env:validate      # Required environment variables
```

## Architecture Documentation

| Document | Description |
|----------|-------------|
| [FINAL_ARCHITECTURE.md](FINAL_ARCHITECTURE.md) | System overview, request flow, module boundaries, deployment topology |
| [docs/architecture/INDEX.md](docs/architecture/INDEX.md) | Phase 1–5 architecture index (25+ design documents) |
| [docs/implementation/phase-6/README.md](docs/implementation/phase-6/README.md) | Platform foundations — modules, API, database |
| [docs/implementation/phase-7-production/README.md](docs/implementation/phase-7-production/README.md) | Production infrastructure — worker, event bus, Docker, K8s |
| [docs/FOUNDATION_AUDIT.md](docs/FOUNDATION_AUDIT.md) | Milestone 1 foundation audit and security posture |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deployment guide |
| [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) | Pre-deploy checklist |
| [RELEASE_NOTES.md](RELEASE_NOTES.md) | v1.0 release highlights |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

## Monorepo Layout

```
atlas-bos/
├── apps/
│   ├── api/                 # Fastify REST API
│   ├── web/                 # Next.js 15 frontend
│   ├── worker/              # Background processors
│   ├── integration-tests/   # Cross-service tests
│   ├── e2e-tests/           # Playwright smoke tests
│   └── performance-tests/   # Benchmarks
├── packages/
│   ├── shared-kernel/       # Domain primitives, IDs, errors
│   ├── platform/            # Auth, logging, metrics, HTTP utilities
│   ├── database/            # Prisma client, SQL migrations (V001–V012)
│   ├── ui/                  # Design system components
│   ├── event-bus/           # Kafka + Redis CloudEvents
│   ├── queue/               # BullMQ job queues + DLQ
│   └── modules/             # 11 domain modules
├── infra/
│   ├── docker/              # Multi-stage Dockerfiles
│   ├── k8s/                 # Kubernetes manifests
│   ├── prometheus/          # Scrape config
│   └── grafana/             # Dashboard provisioning
├── docker-compose.yml       # Dev infrastructure
└── docker-compose.prod.yml  # Full production stack
```

## Engineering Principles

- Clean Architecture + DDD + Hexagonal boundaries
- API-first, event-driven, microservice-ready
- CQRS where read/write paths diverge
- Strict type safety, zero duplicated business logic
- Security and observability by default

## Scale Targets

| Dimension | Target |
|-----------|--------|
| Organizations | Millions |
| Users | Hundreds of millions |
| API requests | Billions/month |
| Deployment | Global, multi-region |
| Tenancy | Multi-tenant with enterprise isolation |
| Compliance | SOC 2, GDPR, HIPAA-ready, ISO 27001 |

## License

Proprietary — All rights reserved.