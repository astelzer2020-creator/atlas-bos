# Atlas BOS — Production Deployment Checklist

Use this checklist before every production deploy of Atlas v1.0.0.

---

## 1. Environment Variables

- [ ] Copy `.env.example` to production secret store (never commit `.env` to git)
- [ ] Run `pnpm env:validate` against production environment — all required vars present
- [ ] `JWT_SECRET` is a cryptographically random string ≥ 64 characters (not the `.env.example` placeholder)
- [ ] `DATABASE_URL` points to production PostgreSQL with TLS enabled
- [ ] `REDIS_URL` points to production Redis (TLS if available)
- [ ] `KAFKA_BROKERS` points to production Redpanda/Kafka cluster
- [ ] `CORS_ORIGINS` lists only known frontend origins (no wildcards)
- [ ] `NEXT_PUBLIC_API_URL` matches the public API URL (baked into web image at build time)
- [ ] `NODE_ENV=production` on API and worker
- [ ] `PROMETHEUS_ENABLED=true` on API and worker
- [ ] `SMTP_HOST` configured if email delivery is required (otherwise notifications log only)
- [ ] `ATLAS_STORAGE_PROVIDER` and credentials configured for production object storage if not using local

### Required Variables Reference

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | ≥ 64 random chars |
| `REDIS_URL` | Yes | BullMQ + pub/sub |
| `KAFKA_BROKERS` | Yes | Event bus |
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins |
| `NEXT_PUBLIC_API_URL` | Yes | Public API base URL |
| `API_HOST` / `API_PORT` | Yes | `0.0.0.0` / `3001` |
| `WORKER_HOST` / `WORKER_PORT` | Yes | `0.0.0.0` / `3002` |
| `BCRYPT_ROUNDS` | Yes | Default `12` |
| `JWT_ACCESS_TTL_SECONDS` | Yes | Default `900` (15 min) |
| `JWT_REFRESH_TTL_SECONDS` | Yes | Default `604800` (7 days) |
| `ATLAS_STORAGE_*` | Yes | Storage provider config |
| `SMTP_*` | No | Email optional |
| `WORKER_ID` | No | Auto-generated if unset |
| `PROMETHEUS_ENABLED` | No | Default `false` in dev, `true` in prod |

---

## 2. Database Migrations

- [ ] Backup production database before migration
- [ ] Verify migration version: V001 through V012 applied
- [ ] Run migrations:

```bash
pnpm db:generate
pnpm db:migrate
```

- [ ] Confirm all 9 PostgreSQL schemas exist: `atlas_core`, `notifications`, `storage`, `atlas_audit`, `automation`, `ai_agents`, `customer`, `ledger`, `projects`
- [ ] Verify RLS policies are active on tenant-scoped tables
- [ ] Test restore procedure from backup

### Migration Files

| Version | Domain |
|---------|--------|
| V001 | Platform core |
| V002 | Auth |
| V003 | Notifications |
| V004 | Storage |
| V005 | Audit |
| V006 | Workflow |
| V007 | Automation |
| V008 | AI agents |
| V009 | CRM |
| V010 | Finance |
| V011 | Projects |
| V012 | AI memory |

---

## 3. Security

- [ ] Secrets stored in managed secret store (AWS Secrets Manager, Vault, K8s Secrets) — not in git
- [ ] `infra/k8s/secret.yaml` created from `secret.yaml.example` with real values, applied out-of-band
- [ ] TLS terminated at ingress/load balancer with valid certificates
- [ ] Postgres, Redis, and Kafka not accessible from public internet
- [ ] API containers run as non-root (UID 1001)
- [ ] K8s security context: `readOnlyRootFilesystem`, `allowPrivilegeEscalation: false`, drop all capabilities
- [ ] Helmet security headers active (`NODE_ENV=production`)
- [ ] Rate limiting active (200 req/min in production)
- [ ] Grafana self-registration disabled (`GF_USERS_ALLOW_SIGN_UP=false`)
- [ ] Strong `POSTGRES_PASSWORD` and `GRAFANA_ADMIN_PASSWORD` set
- [ ] Container images pinned by digest in production (avoid `:latest`)
- [ ] Review [infra/docs/SECURITY.md](infra/docs/SECURITY.md)

---

## 4. Monitoring & Observability

- [ ] Prometheus scraping API (`:3001/metrics`) and worker (`:3002/metrics`)
- [ ] Grafana dashboards provisioned and accessible on internal network only
- [ ] Alerts configured for:
  - [ ] API 5xx error rate
  - [ ] API P99 latency
  - [ ] Worker readiness failures (`/ready` returning 503)
  - [ ] Database connection pool exhaustion
  - [ ] BullMQ queue depth / DLQ growth
  - [ ] Disk usage on Postgres volumes
- [ ] Centralized log aggregation with `x-request-id` correlation
- [ ] On-call runbooks documented

---

## 5. Health Endpoints

Verify after deploy:

```bash
# API liveness
curl -f https://api.example.com/health
# Expected: {"status":"ok","service":"atlas-api","timestamp":"..."}

# API readiness (database)
curl -f https://api.example.com/ready
# Expected: {"status":"ready","checks":{"database":"ok"}}

# Worker liveness (internal network)
curl -f http://atlas-worker:3002/health
# Expected: {"status":"ok",...}

# Worker readiness
curl -f http://atlas-worker:3002/ready
# Expected: {"status":"ready","checks":{"database":"ok"}}
```

- [ ] K8s liveness probes passing on `/health`
- [ ] K8s readiness probes passing on `/ready`
- [ ] Docker HEALTHCHECK passing on API container

---

## 6. Smoke Tests

### Automated

```bash
# Full validation suite (run in staging before prod)
pnpm validate

# Environment check
pnpm env:validate

# E2E smoke (against staging web)
E2E_BASE_URL=https://app.example.com pnpm test:e2e
```

- [ ] `pnpm validate` passes in staging
- [ ] Playwright smoke tests pass (landing, login, register, mobile viewport)

### Manual Smoke Tests

- [ ] Landing page loads at `/`
- [ ] Register new account at `/register`
- [ ] Login at `/login` — redirects to `/dashboard`
- [ ] Onboarding wizard creates workspace and organization
- [ ] CRM: create account, view detail page, edit and save
- [ ] Members: list members at `/settings/members`
- [ ] Audit log: entries visible at `/settings/audit`
- [ ] Approvals: inbox loads at `/workflows/approvals`
- [ ] Notifications: bell shows unread count, `/notifications` page loads
- [ ] MFA: login with MFA-enabled user redirects to `/login/mfa`
- [ ] Toast notifications appear on successful actions
- [ ] Logout clears session and redirects to login

---

## 7. Infrastructure

### Docker Compose

- [ ] `docker compose -f docker-compose.prod.yml config` validates without errors
- [ ] All services healthy: `docker compose -f docker-compose.prod.yml ps`
- [ ] Volumes persisted for Postgres, Redis, Prometheus, Grafana

### Kubernetes

- [ ] Namespace `atlas` created
- [ ] ConfigMap `atlas-config` applied with production values
- [ ] Secret `atlas-secrets` applied (not committed to git)
- [ ] Deployments: `atlas-api` (2 replicas), `atlas-worker` (1), `atlas-web` (2)
- [ ] Services: `atlas-api:3001`, `atlas-web:3000`, `atlas-worker:3002`
- [ ] Ingress configured with TLS for `api.example.com` and `app.example.com`
- [ ] HPA applied for API (`hpa-api.yaml`)
- [ ] Resource requests/limits set on all pods

---

## 8. Pre-Deploy Build Verification

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build
pnpm test
pnpm test:integration
```

- [ ] Build succeeds for `@atlas/api`, `@atlas/worker`, `@atlas/web`
- [ ] No TypeScript errors in core packages
- [ ] Unit and integration tests pass

---

## 9. Rollback Plan

- [ ] Previous container image tags retained in registry
- [ ] Database rollback scripts or point-in-time recovery tested
- [ ] Rollback procedure documented:
  1. Revert to previous image tag / deployment revision
  2. Restore database from pre-migration backup if schema changed
  3. Verify health endpoints
  4. Run smoke tests

---

## 10. Post-Deploy

- [ ] All health endpoints return 200
- [ ] Smoke tests pass
- [ ] No error spikes in logs or metrics for 15 minutes
- [ ] Notify stakeholders of successful deploy
- [ ] Update deployment log with version, timestamp, and operator

---

## Quick Reference Commands

```bash
# Validate environment
pnpm env:validate

# Full test suite
pnpm validate

# Apply migrations
pnpm db:migrate

# Production compose
JWT_SECRET="<secret>" docker compose -f docker-compose.prod.yml up -d --build

# K8s deploy
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/configmap.yaml
kubectl apply -f infra/k8s/secret.yaml        # from secret.yaml.example
kubectl apply -f infra/k8s/api-deployment.yaml
kubectl apply -f infra/k8s/api-service.yaml
kubectl apply -f infra/k8s/worker-deployment.yaml
kubectl apply -f infra/k8s/worker-service.yaml
kubectl apply -f infra/k8s/web-deployment.yaml
kubectl apply -f infra/k8s/ingress.yaml
kubectl apply -f infra/k8s/hpa-api.yaml
```
