---
title: Deployment
document_id: ARCH-22
version: 1.0.0
status: approved
phase: 1
last_updated: 2026-06-30
authors:
  - Atlas Architecture Team
related_documents:
  - ARCH-03
  - ARCH-19
  - ARCH-21
  - ARCH-23
  - ARCH-24
  - ARCH-25
tags:
  - deployment
  - gitops
  - cicd
  - argocd
  - canary
  - feature-flags
---

# Deployment

## Purpose

Define the architecture for **Deployment and Release Management** at Atlas — the GitOps-driven, automated pipeline that delivers software changes safely to production across global Kubernetes clusters while supporting **blue-green/canary** strategies, **feature flags**, **database migrations**, **smoke tests**, and controlled **deployment windows**.

## Scope

### In Scope

- GitOps with ArgoCD (Flux as alternative)
- Blue-green and canary deployment patterns
- Feature flags (LaunchDarkly primary; Unleash self-hosted fallback)
- Rollback procedures (automated and manual)
- Database migration in deploy pipeline
- Smoke tests and deployment gates
- Deployment windows and change management
- Multi-region rollout orchestration
- Environment promotion (dev → staging → prod)

### Out of Scope

- Infrastructure provisioning (ARCH-03 Terraform)
- Detailed CI build configuration (Phase 2)
- Application code structure

---

## Context

Atlas deploys hundreds of microservices to multiple regions. Ad-hoc deployments cause outages, schema drift, and inconsistent configuration. Production-grade deployment requires:

- **Declarative desired state** in Git (single source of truth)
- **Progressive exposure** of changes (canary, feature flags)
- **Automated verification** before and after deploy
- **Fast rollback** when SLOs degrade
- **Coordinated schema migrations** with application versions

### Deployment Philosophy

1. **GitOps** — If it's not in Git, it doesn't exist in production
2. **Progressive delivery** — No big-bang releases for critical paths
3. **Automated rollback** — Error budget burn triggers revert
4. **Immutable artifacts** — Same container image promoted across environments
5. **Separate schema from code** — Migrations are first-class, reversible where possible

---

## Detailed Design

### 1. GitOps Architecture (ArgoCD)

```
┌─────────────┐    push     ┌─────────────┐    sync    ┌─────────────┐
│ App Repos   │────────────►│  Git (main) │───────────►│   ArgoCD    │
│ (services)  │   CI build  │  + Helm/Kustomize         │  Controller │
└─────────────┘             └─────────────┘             └──────┬──────┘
                                                               │
                    ┌──────────────────────────────────────────┼──────────┐
                    ▼                    ▼                     ▼          ▼
              us-east-1            us-west-2            eu-west-1    ap-southeast
              (prod)               (prod)               (prod)       (prod)
```

#### Repository Structure

```
atlas-gitops/
├── apps/                    # ArgoCD Application manifests
│   ├── finance-api.yaml
│   └── workflow-runtime.yaml
├── environments/
│   ├── dev/
│   ├── staging/
│   └── production/
│       ├── us-east-1/
│       ├── eu-west-1/
│       └── ...
├── charts/                  # Helm charts per service
└── policies/                # OPA/Gatekeeper constraints
```

| Principle | Implementation |
|-----------|----------------|
| Single source of truth | Git repo `atlas-gitops` |
| Drift detection | ArgoCD auto-sync with self-heal (configurable) |
| Secret management | External Secrets Operator → Vault |
| Image tags | Updated by CI via PR to gitops repo |
| Approval | Production sync requires PR approval + ArgoCD manual sync (optional) |

#### ArgoCD Application Model

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: finance-api-us-east-1
  namespace: argocd
spec:
  project: production
  source:
    repoURL: https://github.com/atlas/gitops
    path: environments/production/us-east-1/finance-api
    targetRevision: main
  destination:
    server: https://us-east-1.k8s.atlas.internal
    namespace: finance
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

### 2. CI/CD Pipeline

```
┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐
│ Commit │──►│ Build  │──►│ Test   │──►│ Scan   │──►│ Push   │──►│ GitOps │
│        │   │ Image  │   │ Unit/  │   │ SAST/  │   │ Registry│  │ PR     │
│        │   │        │   │ Integ  │   │ Container│  │        │   │        │
└────────┘   └────────┘   └────────┘   └────────┘   └────────┘   └────────┘
```

| Stage | Gate |
|-------|------|
| Build | Compile, type check |
| Unit tests | 80% coverage minimum (ARCH-24) |
| Integration | Testcontainers against PostgreSQL/Kafka |
| SAST/SCA | No critical findings (ARCH-21) |
| Container scan | Trivy pass |
| Sign | Cosign sign image |
| GitOps PR | Update image tag + changelog |

**Artifact immutability:** `finance-api:v2.4.1+sha.abc123` — same digest promoted dev → staging → prod.

### 3. Blue-Green Deployments

Used for **stateless services** with instant cutover capability.

```
                    ┌─────────────┐
                    │   Ingress   │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌─────────────┐           ┌─────────────┐
       │ Blue (v2.4)│           │Green (v2.5) │
       │  (active)  │           │ (standby)   │
       └─────────────┘           └─────────────┘
```

| Step | Action |
|------|--------|
| 1 | Deploy Green with new version (0% traffic) |
| 2 | Run smoke tests against Green (internal URL) |
| 3 | Switch Ingress selector to Green |
| 4 | Monitor SLOs for 15 minutes |
| 5 | Scale down Blue (or keep for instant rollback) |

**Use when:** Major version changes, database backward-compatible, need instant rollback.

### 4. Canary Deployments

Default for **production critical services**.

```
Traffic Split:
  95% → Stable (v2.4.0)
   5% → Canary (v2.5.0)
        │
        ▼ (SLO OK after 30m)
  50% / 50%
        │
        ▼ (SLO OK after 30m)
 100% → Canary becomes Stable
```

**Implementation:** Argo Rollouts + Istio/NGINX traffic splitting.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: finance-api
spec:
  strategy:
    canary:
      steps:
        - setWeight: 5
        - pause: {duration: 30m}
        - setWeight: 25
        - pause: {duration: 30m}
        - setWeight: 50
        - pause: {duration: 30m}
        - setWeight: 100
      analysis:
        templates:
          - templateName: success-rate
        startingStep: 1
```

#### Automated Analysis

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error rate | < 0.1% (canary vs stable) | Continue |
| P99 latency | < 1.2× stable | Continue |
| Error rate | > 0.5% | Auto-rollback |
| Error budget burn | > 2× normal | Pause + alert |

Argo Rollouts integrates with Prometheus (ARCH-19) for analysis templates.

### 5. Feature Flags

Decouple **deployment** from **release**.

| Provider | Use Case |
|----------|----------|
| LaunchDarkly | Primary; percentage rollouts, targeting, experiments |
| Unleash | Self-hosted fallback; air-gapped enterprise |

#### Flag Categories

| Type | Lifetime | Example |
|------|----------|---------|
| Release | Days–weeks | `new-invoice-editor` |
| Ops | Permanent | `maintenance-mode` |
| Experiment | Weeks | `checkout-flow-variant-b` |
| Permission | Permanent | `ai-agents-beta` |
| Kill switch | Permanent | `disable-webhook-delivery` |

```yaml
feature_flag:
  key: new-workflow-designer
  type: release
  default: false
  rules:
    - attribute: tenant_id
      values: [org_beta_1, org_beta_2]
      variation: true
    - attribute: plan
      value: enterprise
      percentage: 50
```

**SDK integration:** Server-side evaluation for security-sensitive flags; client-side for UI-only features.

**Flag hygiene:** Max 90-day lifetime for release flags; CI lint for stale flags; removal is part of Definition of Done.

### 6. Rollback Procedures

#### Automatic Rollback

| Trigger | Action |
|---------|--------|
| Canary analysis failure | Argo Rollouts revert traffic |
| Smoke test failure post-deploy | ArgoCD sync previous Git revision |
| P1 alert within 15m of deploy | Runbook suggests auto-rollback (configurable) |

#### Manual Rollback

```bash
# GitOps rollback: revert image tag PR
git revert <commit> && git push
# ArgoCD syncs automatically

# Argo Rollouts abort
kubectl argo rollouts abort finance-api

# Emergency: pin to known good digest
kubectl set image deployment/finance-api finance-api=registry/finance-api@sha256:good
```

| Scenario | Rollback Scope |
|----------|----------------|
| Bad application code | Image tag revert |
| Bad configuration | GitOps revert |
| Bad migration | Forward-fix preferred; backward migration if tested |
| Feature flag issue | Disable flag (seconds) |

**Rollback SLA:** < 5 minutes to previous stable for stateless services.

### 7. Database Migrations in Deploy Pipeline

Migrations are **versioned**, **ordered**, and **coordinated** with application rollout.

```
┌─────────────────────────────────────────────────────────────┐
│                    Migration Pipeline                        │
├─────────────────────────────────────────────────────────────┤
│ 1. CI: Run migrations against ephemeral DB (integration)    │
│ 2. Staging: Apply migrations (automatic on merge)           │
│ 3. Prod: Expand → Deploy App → Contract (pattern)           │
└─────────────────────────────────────────────────────────────┘
```

#### Expand-Contract Pattern

| Phase | Migration | Application |
|-------|-----------|-------------|
| Expand | Add nullable column | Old code ignores |
| Deploy | — | New code writes to both |
| Migrate data | Backfill job | — |
| Contract | Remove old column | New code only |

**Rules:**

- No destructive migrations in single deploy (drop column = two-phase)
- Backward-compatible migrations required for canary
- Migration job runs as K8s Job before app rollout (Helm pre-hook)
- Lock timeout: 5s; retry with backoff
- Long migrations use online schema change (pg_repack, gh-ost)

```yaml
# Helm pre-upgrade hook
apiVersion: batch/v1
kind: Job
metadata:
  annotations:
    helm.sh/hook: pre-upgrade
    helm.sh/hook-weight: "-5"
spec:
  template:
    spec:
      containers:
        - name: migrate
          image: finance-api:v2.5.0
          command: ["./migrate", "up"]
      restartPolicy: Never
```

### 8. Smoke Tests

Automated post-deploy verification before traffic shift.

| Test | Scope | Timeout |
|------|-------|---------|
| `/health/ready` | All services | 10s |
| Auth token issuance | Critical path | 30s |
| CRUD smoke (test tenant) | Per domain service | 60s |
| Workflow canary instance | Workflow engine | 120s |
| Kafka produce/consume | Event pipeline | 30s |

Smoke tests run:

1. Against Green/Canary before traffic switch
2. After 100% rollout (synthetic tenant)

Failure → block promotion / trigger rollback.

### 9. Deployment Windows

| Environment | Window | Restrictions |
|-------------|--------|--------------|
| Dev | 24/7 | None |
| Staging | 24/7 | None |
| Production | Tue–Thu 10:00–16:00 UTC | Default deploy window |
| Production (hotfix) | Anytime | SEV1/SEV2 only; IC approval |
| Blackout | Major holidays, quarter-end | No prod deploys |
| Enterprise dedicated | Customer agreement | Coordinated maintenance |

**Change management:**

- Standard change: automated via GitOps within window
- Normal change: PR + 1 approval
- Emergency change: IC + Security notification; retrospective within 48h

### 10. Multi-Region Rollout

```
Wave 1: us-east-1 (canary region, 10% traffic)
   │ SLO OK 2h
Wave 2: us-west-2, eu-west-1 (parallel)
   │ SLO OK 2h
Wave 3: ap-southeast-1, remaining regions
```

| Strategy | Details |
|----------|---------|
| Sequential waves | Reduce blast radius |
| Region-specific flags | Enable features per region |
| Database | Region-local primary; global services deploy coordinated |
| Rollback | Per-region independent revert |

### 11. Environment Promotion

```
dev (auto on merge) → staging (auto on tag rc) → production (manual approve + window)
```

| Environment | Data | Purpose |
|-------------|------|---------|
| Dev | Synthetic | Feature development |
| Staging | Anonymized prod snapshot (weekly) | Integration, DAST, load test |
| Production | Live | Customer traffic |

**Parity:** Staging mirrors production topology at 20% scale.

### 12. Deployment Observability

| Signal | Integration |
|--------|-------------|
| Deploy annotations | Grafana dashboards show vertical lines |
| Change correlation | `deployment_id` in logs (ARCH-20) |
| Error budget | Deploy freeze when budget low (ARCH-19) |
| ArgoCD metrics | Sync status, drift, health |

---

## Alternatives Considered

### Alternative 1: Flux Instead of ArgoCD

**Evaluation:** Flux is GitOps-native, lighter; ArgoCD has superior UI and multi-cluster management.

**Decision:** **ArgoCD** primary for visibility; Flux acceptable for edge clusters if needed.

### Alternative 2: Manual kubectl Deployments

**Rejected:** No audit trail, configuration drift, human error.

### Alternative 3: Feature Flags in Application Config Only

**Rejected:** Requires deploy to toggle; slow kill switches unacceptable.

### Alternative 4: Big-Bang Releases (100% Immediate)

**Rejected:** Unacceptable risk for 99.99% SLO target.

### Alternative 5: Database Migrations Manual

**Rejected:** Schema drift between regions; human error in production DDL.

---

## Consequences

### Positive

- Auditable, reproducible deployments from Git
- Progressive exposure minimizes customer impact
- Feature flags enable safe experimentation and instant kill switches
- Coordinated migrations prevent schema/application mismatch
- Fast rollback protects SLOs and error budgets

### Negative

- GitOps operational learning curve
- Canary analysis adds deploy duration (hours for full promotion)
- Feature flag proliferation requires governance
- Expand-contract migrations slow schema evolution

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| GitOps repo compromise | Branch protection, signed commits, OPA policies |
| Migration failure mid-deploy | Pre-hook validation; backward-compatible only |
| Flag provider outage | Unleash fallback; default-safe values |
| Regional deploy drift | ArgoCD ApplicationSet per region |

---

## Open Questions

| ID | Question | Owner | Target |
|----|----------|-------|--------|
| OQ-22-01 | Argo Rollouts vs. Flagger for canary? | Platform | Argo Rollouts |
| OQ-22-02 | LaunchDarkly cost at scale vs. Unleash primary? | Eng/Finance | Phase 2 |
| OQ-22-03 | Auto-rollback on P1 without human approval? | SRE | Yes for canary |
| OQ-22-04 | Per-tenant deploy rings for enterprise? | Product | Phase 2 |
| OQ-22-05 | Spinnaker for multi-cloud future? | Platform | Evaluate Year 2 |

---

## References

- ARCH-03 Infrastructure Architecture
- ARCH-05 Database Architecture
- ARCH-19 Monitoring
- ARCH-21 Security
- ARCH-24 Testing
- ARCH-25 Disaster Recovery
- ArgoCD, Argo Rollouts documentation