# Atlas BOS — Deployment Guide

**Version:** 1.0.0  
**Last updated:** 2026-06-30

This guide covers deploying Atlas BOS to production using Docker Compose or Kubernetes.

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| Docker | ≥ 24 |
| Docker Compose | v2 |
| kubectl | ≥ 1.28 (K8s only) |

For Kubernetes deployments, you also need:

- A running cluster with nginx ingress controller
- Managed or self-hosted PostgreSQL 16 (pgvector), Redis 7, and Redpanda/Kafka
- TLS certificates (cert-manager or manual)
- Container registry for built images

---

## Pre-Deployment

### 1. Validate environment

```bash
cp .env.example .env
# Edit .env with production values
pnpm env:validate
```

### 2. Run validation suite (staging)

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate
pnpm validate
```

### 3. Review checklist

Complete [PRODUCTION_CHECKLIST.md](../PRODUCTION_CHECKLIST.md) before proceeding.

---

## Docker Compose Production

`docker-compose.prod.yml` deploys the full stack on a single host: application services, data stores, and observability.

### Services

| Service | Image / Build | Port | Purpose |
|---------|---------------|------|---------|
| `postgres` | `pgvector/pgvector:pg16` | 5432 (internal) | Primary database |
| `redis` | `redis:7-alpine` | 6379 (internal) | Queues + pub/sub |
| `redpanda` | `redpandadata/redpanda` | 9092 | Kafka-compatible event bus |
| `api` | `infra/docker/Dockerfile.api` | 3001 | REST API |
| `worker` | `infra/docker/Dockerfile.worker` | 3002 | Background processors |
| `web` | `infra/docker/Dockerfile.web` | 3000 | Next.js frontend |
| `prometheus` | `prom/prometheus:v2.55.1` | 9090 | Metrics |
| `grafana` | `grafana/grafana:11.4.0` | 3003 | Dashboards |

### Required Environment Variables

Create a `.env` file or export variables before running compose:

```bash
# Required
JWT_SECRET=<64+ character random string>
POSTGRES_PASSWORD=<strong password>

# Recommended
CORS_ORIGINS=https://app.yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=<strong password>
```

`JWT_SECRET` is enforced via compose variable substitution: `${JWT_SECRET:?JWT_SECRET is required}`.

### Deploy

```bash
# Validate compose configuration
docker compose -f docker-compose.prod.yml config

# Build and start all services
JWT_SECRET="$(openssl rand -hex 32)" \
POSTGRES_PASSWORD="$(openssl rand -hex 16)" \
CORS_ORIGINS="https://app.yourdomain.com" \
NEXT_PUBLIC_API_URL="https://api.yourdomain.com" \
docker compose -f docker-compose.prod.yml up -d --build
```

**Windows PowerShell:**

```powershell
$env:JWT_SECRET = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
$env:POSTGRES_PASSWORD = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
$env:CORS_ORIGINS = "https://app.yourdomain.com"
$env:NEXT_PUBLIC_API_URL = "https://api.yourdomain.com"
docker compose -f docker-compose.prod.yml up -d --build
```

### Apply Database Migrations

Migrations are not run automatically by compose. Apply them before or after first boot:

```bash
# With local pnpm (DATABASE_URL pointing to compose Postgres)
DATABASE_URL="postgresql://atlas:<password>@localhost:5432/atlas?schema=public" \
pnpm db:generate && pnpm db:migrate

# Or exec into API container after first boot
docker compose -f docker-compose.prod.yml exec api node -e "console.log('Run migrations via pnpm db:migrate against DATABASE_URL')"
```

Recommended: run migrations from CI/CD or an init job before routing traffic.

### Verify Deployment

```bash
# Service health
docker compose -f docker-compose.prod.yml ps

# API endpoints
curl -f http://localhost:3001/health
curl -f http://localhost:3001/ready

# Worker endpoints
curl -f http://localhost:3002/health
curl -f http://localhost:3002/ready

# Web
curl -f http://localhost:3000/
```

### Reverse Proxy (Production)

Place nginx, Caddy, or Traefik in front of the compose stack for TLS termination:

| Backend | Upstream |
|---------|----------|
| `api.yourdomain.com` | `localhost:3001` |
| `app.yourdomain.com` | `localhost:3000` |

Do not expose Postgres (5432), Redis (6379), or Redpanda (9092) publicly.

### Updates

```bash
# Pull latest code, rebuild, restart
git pull
docker compose -f docker-compose.prod.yml up -d --build

# View logs
docker compose -f docker-compose.prod.yml logs -f api worker
```

### Teardown

```bash
# Stop services (preserve volumes)
docker compose -f docker-compose.prod.yml down

# Stop and remove volumes (destructive)
docker compose -f docker-compose.prod.yml down -v
```

---

## Kubernetes Deployment

Manifests live in `infra/k8s/`. They assume external Postgres, Redis, and Kafka services reachable from the cluster.

### Architecture

```
                    ┌─────────────────┐
                    │  Ingress (TLS)  │
                    │  nginx          │
                    └────────┬────────┘
              ┌──────────────┼──────────────┐
              │              │              │
     app.example.com   api.example.com      │
              │              │              │
       ┌──────▼──────┐ ┌────▼─────┐         │
       │ atlas-web   │ │atlas-api │         │
       │ 2 replicas  │ │2 replicas│         │
       └─────────────┘ └────┬─────┘         │
                            │                │
                     ┌──────▼─────┐   ┌──────▼──────┐
                     │atlas-worker│   │  Postgres   │
                     │ 1 replica  │   │  Redis      │
                     └────────────┘   │  Kafka      │
                                      └─────────────┘
```

### Step 1: Build and Push Images

```bash
# API
docker build -f infra/docker/Dockerfile.api -t <registry>/atlas-bos/api:1.0.0 .
docker push <registry>/atlas-bos/api:1.0.0

# Worker
docker build -f infra/docker/Dockerfile.worker -t <registry>/atlas-bos/worker:1.0.0 .
docker push <registry>/atlas-bos/worker:1.0.0

# Web (NEXT_PUBLIC_API_URL baked at build time)
docker build -f infra/docker/Dockerfile.web \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com \
  -t <registry>/atlas-bos/web:1.0.0 .
docker push <registry>/atlas-bos/web:1.0.0
```

Update image references in deployment manifests from `atlas-bos/api:latest` to your registry tag.

### Step 2: Configure Secrets and ConfigMap

Edit `infra/k8s/configmap.yaml`:

```yaml
data:
  CORS_ORIGINS: https://app.yourdomain.com
  NEXT_PUBLIC_API_URL: https://api.yourdomain.com
  KAFKA_BROKERS: redpanda.yourdomain.com:9092
  REDIS_URL: redis://redis.yourdomain.com:6379
  DATABASE_URL: postgresql://atlas@postgres.yourdomain.com:5432/atlas?schema=public
```

Create secrets from the template:

```bash
cp infra/k8s/secret.yaml.example infra/k8s/secret.yaml
# Edit secret.yaml with real values — DO NOT commit
```

Required secret keys:

| Key | Description |
|-----|-------------|
| `JWT_SECRET` | ≥ 64 random characters |
| `POSTGRES_PASSWORD` | Database password |
| `DATABASE_URL` | Full connection string with password |
| `GRAFANA_ADMIN_PASSWORD` | Grafana admin password |

### Step 3: Apply Manifests

```bash
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/configmap.yaml
kubectl apply -f infra/k8s/secret.yaml

kubectl apply -f infra/k8s/api-deployment.yaml
kubectl apply -f infra/k8s/api-service.yaml
kubectl apply -f infra/k8s/worker-deployment.yaml
kubectl apply -f infra/k8s/worker-service.yaml
kubectl apply -f infra/k8s/web-deployment.yaml
kubectl apply -f infra/k8s/ingress.yaml
kubectl apply -f infra/k8s/hpa-api.yaml
```

### Step 4: Configure Ingress

Edit `infra/k8s/ingress.yaml` with your domains and TLS secret:

```yaml
spec:
  tls:
    - hosts:
        - api.yourdomain.com
        - app.yourdomain.com
      secretName: atlas-tls
  rules:
    - host: api.yourdomain.com
      # ...
    - host: app.yourdomain.com
      # ...
```

### Step 5: Run Migrations

Execute as a one-off job or from CI/CD:

```bash
# Example: run from a machine with DATABASE_URL access
DATABASE_URL="postgresql://atlas:<password>@postgres.yourdomain.com:5432/atlas" \
pnpm db:generate && pnpm db:migrate
```

### Step 6: Verify

```bash
# Pod status
kubectl -n atlas get pods

# API health (via ingress)
curl -f https://api.yourdomain.com/health
curl -f https://api.yourdomain.com/ready

# Worker health (port-forward for internal check)
kubectl -n atlas port-forward svc/atlas-worker 3002:3002
curl -f http://localhost:3002/health

# Logs
kubectl -n atlas logs -l app.kubernetes.io/name=atlas-api --tail=50
kubectl -n atlas logs -l app.kubernetes.io/name=atlas-worker --tail=50
```

### Scaling

API horizontal scaling is configured via `hpa-api.yaml`. Manual scaling:

```bash
kubectl -n atlas scale deployment atlas-api --replicas=4
kubectl -n atlas scale deployment atlas-web --replicas=3
```

Worker scaling: increase replicas only if queue consumers are idempotent and partition-aware. Default is 1 replica.

### Rolling Updates

```bash
# Update image tag
kubectl -n atlas set image deployment/atlas-api api=<registry>/atlas-bos/api:1.0.1
kubectl -n atlas rollout status deployment/atlas-api

# Rollback
kubectl -n atlas rollout undo deployment/atlas-api
```

---

## Observability

### Prometheus

Scrape targets configured in `infra/prometheus/prometheus.yml`:

| Job | Target | Path |
|-----|--------|------|
| `atlas-api` | `api:3001` | `/metrics` |
| `atlas-worker` | `worker:3002` | `/metrics` |

Enable metrics: `PROMETHEUS_ENABLED=true` on API and worker.

### Grafana

- **Compose:** http://localhost:3003 (default `admin`/`admin` — change in production)
- **Provisioning:** `infra/grafana/provisioning/` (datasources + dashboards)

Restrict Grafana to internal/VPN access in production.

---

## Environment Variable Reference

See `.env.example` for the complete list. Run `pnpm env:validate` to check required variables.

| Category | Key Variables |
|----------|---------------|
| Database | `DATABASE_URL` |
| Auth | `JWT_SECRET`, `JWT_ACCESS_TTL_SECONDS`, `JWT_REFRESH_TTL_SECONDS`, `BCRYPT_ROUNDS` |
| API | `API_HOST`, `API_PORT`, `API_BASE_URL`, `CORS_ORIGINS` |
| Worker | `WORKER_HOST`, `WORKER_PORT`, `KAFKA_BROKERS`, `REDIS_URL` |
| Web | `NEXT_PUBLIC_API_URL` |
| Storage | `ATLAS_STORAGE_PROVIDER`, `ATLAS_STORAGE_LOCAL_ROOT`, `ATLAS_STORAGE_KMS_KEY_ID` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` |
| Observability | `PROMETHEUS_ENABLED` |

---

## Troubleshooting

### API `/ready` returns 503

- Check `DATABASE_URL` connectivity from API pod/container
- Verify Postgres is running and accepting connections
- Check migration status: all V001–V012 applied

### Worker not processing jobs

- Verify `REDIS_URL` is reachable
- Check worker logs: `kubectl -n atlas logs -l app.kubernetes.io/name=atlas-worker`
- Confirm `KAFKA_BROKERS` is reachable (or `KAFKA_MOCK` is not set in production)

### Web cannot reach API

- Verify `NEXT_PUBLIC_API_URL` matches the public API URL (rebuild web image if changed)
- Check CORS: `CORS_ORIGINS` must include the web origin
- Check ingress routing for `api.yourdomain.com`

### JWT errors after deploy

- Ensure `JWT_SECRET` is identical across API and worker
- Secret must be ≥ 64 characters and not the `.env.example` placeholder

---

## Related Documentation

- [PRODUCTION_CHECKLIST.md](../PRODUCTION_CHECKLIST.md)
- [FINAL_ARCHITECTURE.md](../FINAL_ARCHITECTURE.md)
- [infra/docs/SECURITY.md](../infra/docs/SECURITY.md)
- [docs/implementation/phase-7-production/README.md](implementation/phase-7-production/README.md)