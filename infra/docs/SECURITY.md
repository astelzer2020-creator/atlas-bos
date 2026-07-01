# Atlas BOS — Production Security Checklist

Brief checklist for deploying Atlas to production. Expand per environment and compliance requirements.

## Secrets and Configuration

- [ ] Generate a cryptographically random `JWT_SECRET` (≥ 64 characters); rotate on compromise
- [ ] Store secrets in a managed secret store (AWS Secrets Manager, Vault, K8s Secrets) — never in git
- [ ] Use `infra/k8s/secret.yaml.example` as a template only; apply real values out-of-band
- [ ] Set strong `POSTGRES_PASSWORD` and restrict database network access
- [ ] Disable Grafana self-registration (`GF_USERS_ALLOW_SIGN_UP=false`)

## Network and Transport

- [ ] Terminate TLS at ingress/load balancer; enforce HTTPS redirects
- [ ] Restrict CORS `CORS_ORIGINS` to known frontend origins only
- [ ] Keep Postgres, Redis, and Redpanda off public networks
- [ ] Configure firewall / security groups: expose only 443 (web/api) and admin VPN for ops tools

## Application Hardening

- [ ] Run with `NODE_ENV=production`
- [ ] Helmet security headers enabled (CSP, HSTS, CORP, COOP in production)
- [ ] Rate limiting active on API (`@fastify/rate-limit`)
- [ ] Run containers as non-root (UID 1001 in Dockerfiles)
- [ ] Enable `PROMETHEUS_ENABLED=true` and scrape `/metrics` from internal networks only

## Kubernetes

- [ ] Apply `readOnlyRootFilesystem`, drop all capabilities, `runAsNonRoot`
- [ ] Use NetworkPolicies to limit pod-to-pod traffic
- [ ] Pin container image digests in production (avoid `:latest`)
- [ ] Configure HPA (`hpa-api.yaml`) and resource requests/limits
- [ ] Enable audit logging on the API server and ingress

## Data and Backups

- [ ] Enable automated Postgres backups with tested restore procedure
- [ ] Encrypt data at rest (RDS/disk encryption, S3 SSE)
- [ ] Define RPO/RTO targets per `docs/architecture/phase-1/25-disaster-recovery.md`

## Monitoring and Incident Response

- [ ] Alert on API 5xx rate, latency P99, and worker readiness failures
- [ ] Centralize logs with correlation IDs (`x-request-id`)
- [ ] Document on-call runbooks and escalation paths
- [ ] Review access logs weekly; enable WAF rules where applicable

## Pre-Deploy Verification

```bash
# Validate compose config
docker compose -f docker-compose.prod.yml config

# Smoke test after deploy
curl -f https://api.example.com/health
curl -f https://api.example.com/ready
```