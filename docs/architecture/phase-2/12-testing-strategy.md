---
title: Testing Strategy
document_id: STRAT-12
version: 1.0.0
status: draft
phase: 2
last_updated: 2026-06-30
authors:
  - Atlas Architecture Team
related_documents:
  - ARCH-24
  - ARCH-02
  - ARCH-06
  - ARCH-08
  - ARCH-19
  - ARCH-21
  - ARCH-22
  - STRAT-10
  - STRAT-11
  - STRAT-13
  - STRAT-14
  - STRAT-15
tags:
  - testing
  - quality-assurance
  - ci-gates
  - test-data
  - release-criteria
---

# Testing Strategy — Phase 2

## Executive Summary

Atlas BOS Phase 2 establishes a **comprehensive, automated quality program** that operationalizes [ARCH-24](../phase-1/24-testing.md) into enforceable engineering practice. For a platform serving millions of organizations with financial, HR, and AI capabilities, testing is the **primary risk mitigation** for multi-tenant isolation failures, API contract breakage, AI safety regressions, and performance degradation.

This strategy defines the testing pyramid with coverage targets, CI quality gates that block unsafe merges, test data management policies, environment requirements, and explicit release criteria tied to deployment gates (STRAT-10). Phase 2 matures from basic unit test enforcement through chaos engineering, AI evaluation pipelines, and predictive quality analytics.

**Key outcomes:**

| Outcome | Target |
|---------|--------|
| Unit test coverage (per service) | ≥ 80% lines |
| Critical module coverage (auth, payments) | ≥ 90% |
| Production defect escape rate | < 0.1% of releases |
| Flaky test rate | < 1% |
| E2E smoke pass rate (pre-deploy) | 100% |
| Multi-tenant isolation test pass | 100% every PR |
| P0 test failure MTTR | < 4 hours |

---

## Principles

1. **Shift left** — Catch defects at the lowest pyramid layer; expensive tests reserved for high-confidence gaps.
2. **Test behavior, not implementation** — Tests survive refactors; focus on contracts and outcomes.
3. **Tenant isolation is non-negotiable** — Every integration suite validates cross-tenant denial.
4. **No production data in non-prod** — Synthetic and anonymized data only; GDPR and security compliance.
5. **Deterministic over flaky** — Flaky tests are defects; quarantine policy with SLA to fix.
6. **AI is testable** — Golden sets, safety suites, and cost bounds for non-deterministic systems.
7. **Tests are code** — Reviewed, owned, maintained; deleted when obsolete.
8. **Release confidence is measurable** — Explicit criteria; no subjective "feels ready."

---

## Implementation Approach

### 1. Testing Pyramid

```
                    ┌───────────┐
                    │    E2E    │  ~5%   Critical user journeys
                    │  Contract │
                   ┌┴───────────┴┐
                   │ Integration  │  ~25%  Service boundaries, DB, events
                  ┌┴─────────────┴┐
                  │     Unit      │  ~70%  Business logic, fast feedback
                  └───────────────┘
```

#### Layer Definitions

| Layer | Scope | Speed Target | Tools | Owner |
|-------|-------|--------------|-------|-------|
| **Unit** | Functions, classes, pure logic | < 10ms/test | Jest, Vitest, Go test, pytest | Feature team |
| **Integration** | DB, Kafka, Redis, service pairs | < 5s/test | Testcontainers | Feature team |
| **Contract** | API schemas between services | < 1s/test | Pact, OpenAPI diff | Consumer + provider |
| **E2E** | Full browser user journeys | < 60s/test | Playwright | Platform QA + teams |
| **Specialized** | Perf, chaos, a11y, security, AI eval | Varies | k6, Litmus, axe, ZAP, custom | SRE, Security, AI Platform |

#### Distribution Enforcement

CI reports pyramid distribution per service. Services with > 10% E2E ratio trigger architecture review.

### 2. Coverage Targets

#### Minimum Thresholds (CI Gates)

| Scope | Line Coverage | Branch Coverage | Mutation Score |
|-------|---------------|-----------------|----------------|
| **Default (all services)** | ≥ 80% | ≥ 70% | ≥ 60% (monthly) |
| **Critical (auth, payments, encryption)** | ≥ 90% | ≥ 85% | ≥ 80% (monthly) |
| **Standard domain services** | ≥ 80% | ≥ 70% | ≥ 70% (quarterly) |
| **UI components (changed files)** | ≥ 75% | ≥ 65% | N/A |
| **Generated code** | Excluded | Excluded | N/A |

#### Critical Path Coverage (Integration)

| Path | Requirement |
|------|-------------|
| Authentication / authorization | 100% endpoint matrix |
| Payment processing | 100% state transitions |
| Multi-tenant isolation | 100% data access paths |
| Workflow state machine | 100% transitions |
| Agent tool permission checks | 100% tools |
| Webhook delivery | 100% retry paths |

**100% critical path** means every identified path has at least one integration or E2E test—not line coverage.

#### Coverage Exclusions

- Auto-generated protobuf/OpenAPI clients
- Boilerplate DTOs without logic
- Main entrypoints (covered by integration)
- Third-party adapter stubs

Exclusions require `// coverage:ignore` with justification in PR.

### 3. CI Quality Gates

#### Pull Request Gates (Blocking)

```
PR Created
    │
    ├─► Unit tests pass                          [BLOCK]
    ├─► Integration tests pass                   [BLOCK]
    ├─► Coverage ≥ threshold (diff + overall)    [BLOCK]
    ├─► SAST/SCA — no critical findings            [BLOCK]
    ├─► Secret scan (Gitleaks)                   [BLOCK]
    ├─► Contract tests pass (affected services)    [BLOCK]
    ├─► AuthZ matrix tests pass (if auth touched)  [BLOCK]
    ├─► Tenant isolation tests pass                [BLOCK]
    ├─► Accessibility (axe) — no serious violations [BLOCK if UI]
    ├─► OpenAPI spec diff (breaking = block)       [BLOCK]
    └─► Lint + type check                          [BLOCK]
```

#### Main Branch Gates (Post-Merge)

```
Merge to main
    │
    ├─► Full integration suite (all services)      [BLOCK]
    ├─► E2E smoke suite (staging)                  [BLOCK]
    ├─► Performance regression (if critical path) [BLOCK]
    ├─► Container scan (Trivy)                     [BLOCK]
    ├─► Image signing (Cosign)                     [BLOCK]
    └─► AI eval smoke (if AI code changed)         [BLOCK]
```

#### Pre-Production Gates

```
Deploy to staging (RC tag)
    │
    ├─► E2E full suite                             [BLOCK release]
    ├─► DAST scan (OWASP ZAP)                      [TRACK — block if critical]
    ├─► Load test baseline (weekly comparison)     [BLOCK significant releases]
    ├─► 24h staging soak (significant changes)   [BLOCK]
    └─► Migration up/down test                     [BLOCK]
```

#### Pre-Traffic Production Gates

```
Production deploy (STRAT-10)
    │
    ├─► Smoke tests (pre-canary)                   [BLOCK]
    ├─► Error budget > 25%                         [BLOCK]
    └─► Synthetic monitoring (post-100%)           [BLOCK promotion close]
```

#### Gate Bypass Policy

| Scenario | Approval | Audit |
|----------|----------|-------|
| Emergency hotfix | IC + Eng lead | Retrospective; tests added within 48h |
| Coverage waiver | Architect + Security | Time-limited; documented debt |
| E2E skip | Not permitted for production | — |

### 4. Test Data Management

#### Data Classification in Test Context

| Class | Test Environments Allowed | Source |
|-------|----------------------------|--------|
| Synthetic | All | Factories, fixtures |
| Anonymized | Staging, sandbox | Weekly ETL from prod |
| Production | Synthetic monitoring only | Isolated test tenant |
| PII | **Never** in CI/local | — |

#### Test Data Principles

1. **No production data in CI/local** — Synthetic or anonymized only
2. **Deterministic** — Seeded RNG (`SEED=42`) for reproducible failures
3. **Tenant-isolated** — Every fixture includes `tenant_id`
4. **Minimal** — Create only required entities per test
5. **Self-cleaning** — Transaction rollback or truncate per test suite

#### Factory Pattern (Standard)

```typescript
const tenant = await factories.tenant.create({ plan: 'enterprise' });
const user = await factories.user.create({
  tenant_id: tenant.id,
  roles: ['finance_admin'],
});
const invoice = await factories.invoice.create({
  tenant_id: tenant.id,
  amount: 1500.00,
  status: 'draft',
});
```

#### Fixture Tiers

| Tier | Use Case | Storage | Lifecycle |
|------|----------|---------|-----------|
| Inline | Unit tests | Hardcoded in test file | Per test |
| Factory | Integration tests | Programmatic | Per test (rollback) |
| Snapshot | Contract tests | JSON in repo | Versioned |
| Scenario | E2E tests | Pre-seeded staging | Weekly refresh |
| Anonymized | Staging load tests | ETL pipeline | Weekly |

#### Anonymization Pipeline (Staging)

| Field Type | Transformation |
|------------|----------------|
| Names | Faker-generated |
| Emails | `user_{hash}@test.atlas.dev` |
| Phone | Random valid format |
| SSN/Tax ID | Tokenized / removed |
| Financial amounts | Preserved (needed for tests) ± noise |
| Addresses | Randomized city/state |

ETL runs weekly; staging data never older than 8 days.

#### Multi-Tenant Test Requirements

Every integration suite MUST include:

| Test Case | Expected |
|-----------|----------|
| Cross-tenant read | 404 or 403 (never 200 with other tenant data) |
| Cross-tenant write | 403 |
| Missing `tenant_id` | 400 |
| RLS direct DB query | Returns only tenant rows |
| Cache key isolation | Tenant A cache miss for Tenant B key |
| Search index isolation | Tenant A query returns no Tenant B docs |

### 5. Test Environments

#### Environment Matrix

| Environment | Purpose | Data | Infra | Refresh |
|-------------|---------|------|-------|---------|
| **Local** | Developer iteration | Docker fixtures | Kind/k3d | On demand |
| **CI** | PR validation | Ephemeral Testcontainers | GitHub Actions runners | Per build |
| **Dev** | Integration | Synthetic | EKS (single region) | Continuous |
| **Staging** | Pre-prod validation | Anonymized snapshot | EKS (2 regions, 20% scale) | Weekly data |
| **Production** | Synthetic monitoring | Isolated test tenant | Full | N/A |

#### Parity Requirements

| Property | Local | CI | Staging | Production |
|----------|-------|-----|---------|------------|
| PostgreSQL version | Match prod | Testcontainers (match) | RDS (match) | RDS |
| Kafka | Container | Testcontainers | MSK | MSK |
| Redis | Container | Testcontainers | ElastiCache | ElastiCache |
| Feature flags | Local overrides | Mock | LaunchDarkly test | LaunchDarkly prod |
| LLM | Mock/stub | Mock | Test API keys | Production keys |
| Auth | Local IdP | Testcontainers Keycloak | Staging IdP | Production IdP |

**Rule:** Staging must mirror production service topology; differences only in scale and data.

#### Environment Access

| Environment | Who | Credentials |
|-------------|-----|-------------|
| Local | All engineers | N/A |
| CI | Automated only | Ephemeral |
| Dev | All engineers | SSO |
| Staging | Engineering, QA | SSO |
| Production (synthetic) | SRE, automated | Service account |

### 6. Test Categories (Detailed)

#### Unit Testing

| Requirement | Standard |
|-------------|----------|
| Speed | Full suite < 2 min per service |
| Mocking | External I/O only; prefer fakes |
| Naming | `describe('InvoiceService')` → `it('creates invoice with valid input')` |
| Assertions | One logical assertion per test (multiple `expect` OK) |

**Must unit test:** Business logic, validation, state machines, permission logic, PII redaction, cost calculations.

**Must NOT unit test:** Framework boilerplate, third-party internals, trivial getters/setters.

#### Integration Testing

Testcontainers for PostgreSQL, Kafka, Redis — no in-memory substitutes.

```go
func TestInvoiceCreation(t *testing.T) {
    ctx := context.Background()
    pg := testcontainers.StartPostgreSQL(t)
    kafka := testcontainers.StartKafka(t)

    svc := NewInvoiceService(pg, kafka)
    invoice, err := svc.Create(ctx, CreateInvoiceInput{
        TenantID: "org_test",
        Amount:   decimal.NewFromFloat(100.00),
    })
    require.NoError(t, err)

    event := kafka.ConsumeOne(t, "finance.invoice.created")
    assert.Equal(t, invoice.ID, event.Payload.InvoiceID)
}
```

#### Contract Testing

Consumer-driven contracts (Pact) with provider verification in CI.

| Rule | Enforcement |
|------|-------------|
| Provider verifies all consumer pacts | Block PR on failure |
| Breaking change requires semver bump | Automated |
| OpenAPI is source of truth | Diff on PR |
| Kafka events use AsyncAPI | Schema registry `BACKWARD` compatibility |

#### End-to-End Testing (Playwright)

| Suite | Journeys | Frequency | Blocking |
|-------|----------|-----------|----------|
| Smoke | Login, dashboard load | Every deploy | Yes |
| Core CRM | Contact, deal, activity | Daily | Release |
| Finance | Invoice, payment | Daily | Release |
| Workflow | Approval flow | Daily | Release |
| Automation | Trigger rule, verify action | Daily | Release |
| AI Agent | Read-only query | Daily | Release |
| Admin | User invite, role assignment | Weekly | No |

**Standards:**

- `data-testid` attributes required
- Parallel execution with isolated test tenants
- Video/screenshot on failure
- Max suite time: 30 minutes (sharded)

#### Security Testing

| Type | Tool | Frequency | Gate |
|------|------|-----------|------|
| SAST | Semgrep, CodeQL | Every PR | Block critical |
| SCA | Snyk | Every PR + daily | Block critical CVE |
| Secret scan | Gitleaks | Every commit | Block |
| DAST | OWASP ZAP | Weekly staging | Track |
| AuthZ matrix | Custom suite | Every PR (auth changes) | Block |
| Tenant isolation | Integration suite | Every PR | Block |
| Prompt injection | AI red team suite | Weekly | Track |

#### Performance Testing

See [STRAT-15](15-performance-strategy.md). Testing gates:

| Test | When | Gate |
|------|------|------|
| Baseline latency | Weekly staging | P99 < 500ms |
| Regression | PR (critical services) | < 10% degradation |
| Soak | Quarterly | No memory leaks 72h |
| Spike | Monthly | Recovery < 5 min |

#### AI Agent Evaluation

| Test Type | Description | Gate |
|-----------|-------------|------|
| Golden sets | Expected input → tool calls/output | Block if accuracy -2% |
| Regression | Model/prompt change | Block deploy |
| Safety | Prompt injection resistance | Track; block critical |
| Cost | Run within budget | Block |
| Permission | Agent cannot exceed user perms | Block |
| Hallucination | Financial figures match source | Block (finance) |

```yaml
eval_case:
  id: expense_policy_query
  input: "What is the approval threshold for expenses?"
  expected_tools: [memory.recall]
  expected_output_contains: ["1000 USD"]
  max_cost_cents: 10
  max_duration_seconds: 15
```

#### Accessibility Testing

Target: WCAG 2.1 Level AA.

| Method | Tool | Gate |
|--------|------|------|
| Automated | axe-core (Playwright) | Block serious/critical on changed pages |
| Manual | Screen reader | Sprint review for new features |
| Keyboard nav | Manual checklist | New interactive components |

#### Chaos Engineering

| Experiment | Environment | Frequency |
|------------|-------------|-----------|
| Pod kill | Staging | Monthly (automated) |
| Network latency | Staging | Quarterly |
| DB failover | Staging | Quarterly |
| Kafka broker down | Staging | Quarterly |
| Game day | Staging | Quarterly (cross-team) |

### 7. Flake Management

| Metric | Target |
|--------|--------|
| Flaky test rate | < 1% |
| Quarantined tests | < 0.5% of total |
| Quarantine fix SLA | 5 business days |

**Policy:**

1. Auto-retry once in CI only (not locally)
2. Second failure → quarantine (Jira ticket auto-created)
3. Quarantined tests don't block merge but **block release**
4. Fix or delete within 5 business days

Test results published to Grafana; flaky tests highlighted in weekly QA report.

### 8. Release Criteria

A release to production requires **all** of the following:

#### Mandatory Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | All PR gates passed for included commits | CI history |
| 2 | E2E smoke suite 100% pass on staging | CI artifact |
| 3 | No P0/P1 open bugs for release scope | Jira query |
| 4 | Coverage thresholds met | Coverage report |
| 5 | No critical/high security findings unmitigated | Snyk/Semgrep |
| 6 | Contract tests pass (affected services) | Pact broker |
| 7 | Migration tested up/down on staging | Migration job log |
| 8 | Staging soak 24h (significant changes) | Timestamp |
| 9 | Error budget > 25% | SLO API |
| 10 | Release notes / changelog published | GitOps PR |
| 11 | Rollback plan documented (significant) | PR template |
| 12 | Feature flags configured (default off) | LaunchDarkly |

#### Significant Release Additional Criteria

| # | Criterion |
|---|-----------|
| 13 | E2E full suite pass |
| 14 | Load test within 10% of baseline |
| 15 | CAB approval recorded |
| 16 | AI eval suite pass (if AI changes) |
| 17 | Runbook updated (if operational change) |

#### Release Decision Authority

| Release Type | Approver |
|--------------|----------|
| Standard | Service owner + SRE |
| Significant | Eng lead + SRE + Product |
| Hotfix | IC + Service owner |
| AI model change | AI Platform lead + SRE |

---

## Tooling

| Category | Tool | Purpose |
|----------|------|---------|
| Unit/Integration | Jest, Vitest, Go test, pytest | Core test frameworks |
| Containers | Testcontainers | Ephemeral DB, Kafka, Redis |
| Contract | Pact, AsyncAPI | API/event contracts |
| E2E | Playwright | Browser automation |
| Performance | k6, Gatling | Load testing |
| Chaos | Litmus | Fault injection |
| Security SAST | Semgrep, CodeQL | Static analysis |
| Security SCA | Snyk, Dependabot | Dependency scanning |
| Security DAST | OWASP ZAP | Dynamic scanning |
| Accessibility | axe-core | WCAG automation |
| Mutation | Stryker, mutmut | Test effectiveness |
| AI eval | Custom harness + golden sets | Agent quality |
| Coverage | Codecov / SonarQube | Coverage reporting |
| CI | GitHub Actions | Pipeline orchestration |
| Test reporting | Grafana + custom | Flake tracking |

---

## Processes

### Test Development Workflow

1. Feature PR includes tests at appropriate pyramid layer
2. Critical paths identified in design doc → test plan in PR template
3. Reviewer verifies test quality (not just presence)
4. Coverage diff reported on PR
5. Flaky test auto-detected → quarantine workflow

### Weekly QA Cadence

| Day | Activity |
|-----|----------|
| Monday | Flaky test review; quarantine status |
| Wednesday | E2E full suite (staging) |
| Friday | Coverage trend report; security scan review |

### Monthly Quality Review

- Defect escape analysis
- Coverage trends by service
- Mutation score review (critical services)
- Test environment health
- AI eval accuracy trends

### Incident → Test Feedback Loop

Every production defect MUST result in:

1. Regression test added (within 5 business days)
2. Root cause category tagged (test gap, flake, env, etc.)
3. Quarterly analysis of escape patterns

---

## Metrics

### Quality KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Unit coverage (platform avg) | ≥ 80% | Codecov |
| Critical module coverage | ≥ 90% | Codecov |
| Defect escape rate | < 0.1% releases | Incidents / releases |
| Flaky test rate | < 1% | CI analytics |
| E2E smoke pass rate | 100% | Pre-deploy CI |
| Test suite duration (PR) | < 15 min | CI |
| Test suite duration (main) | < 45 min | CI |
| Quarantined tests | < 0.5% | Quarantine registry |
| Mutation score (critical) | ≥ 80% | Monthly run |
| AI eval accuracy | ≥ baseline - 2% | Eval pipeline |
| Time to add regression test | < 5 days | Jira |

### Process Metrics

| Metric | Target |
|--------|--------|
| PRs blocked by tests (healthy) | 5–15% |
| Test-related hotfixes | < 3% of hotfixes |
| Staging data freshness | < 8 days |
| Contract test breakage caught pre-merge | 100% |

---

## Responsibilities (RACI)

| Activity | Feature Team | Platform QA | SRE | Security | AI Platform | Architect |
|----------|:------------:|:-----------:|:---:|:--------:|:-----------:|:---------:|
| Unit tests | R/A | C | I | I | I | C |
| Integration tests | R/A | C | I | I | I | C |
| Contract tests | R | C | I | I | I | A |
| E2E smoke suite | C | R/A | C | I | C | I |
| E2E full suite | C | R/A | I | I | C | I |
| Performance tests | C | C | R/A | I | I | C |
| Chaos experiments | I | C | R/A | I | I | C |
| Security tests (SAST/SCA) | R | I | I | A | I | I |
| DAST | I | C | C | R/A | I | I |
| AI eval suite | C | I | I | C | R/A | C |
| Accessibility tests | R | C | I | I | I | I |
| Test data factories | R/A | C | I | C | I | I |
| Anonymization pipeline | C | I | R | A | I | I |
| CI gate configuration | C | C | R/A | C | C | C |
| Release criteria sign-off | R | C | A | C | C | C |
| Flake quarantine | R/A | C | I | I | I | I |
| Regression test (post-incident) | R/A | C | I | I | I | I |

**Legend:** R = Responsible, A = Accountable, C = Consulted, I = Informed

---

## Maturity Roadmap

### Level 1 — Foundation (M1–M2)

| Capability | Required |
|------------|----------|
| Unit tests with 80% gate on 5 pilot services | ✓ |
| Testcontainers for integration tests | ✓ |
| Basic CI pipeline (test, lint, build) | ✓ |
| Tenant isolation test template | ✓ |
| Playwright smoke suite (5 journeys) | ✓ |
| SAST/SCA in CI | ✓ |

**Exit criteria:** 10 services at 80% coverage; smoke suite blocks deploy.

### Level 2 — Comprehensive Automation (M3–M4)

| Capability | Required |
|------------|----------|
| 80% coverage all services | ✓ |
| Pact contract tests (top 20 service pairs) | ✓ |
| Full E2E suite (daily) | ✓ |
| AuthZ matrix tests (all auth endpoints) | ✓ |
| Performance regression gate (critical services) | ✓ |
| AI golden set eval (50 cases) | ✓ |
| Flake quarantine workflow | ✓ |
| Anonymized staging data pipeline | ✓ |

**Exit criteria:** Defect escape < 0.5%; flaky rate < 3%.

### Level 3 — Quality Engineering (M5–M8)

| Capability | Required |
|------------|----------|
| 90% coverage on critical modules | ✓ |
| Mutation testing (monthly, critical) | ✓ |
| Chaos engineering (monthly automated) | ✓ |
| DAST weekly with remediation SLA | ✓ |
| AI eval suite (200+ cases) blocks deploy | ✓ |
| Visual regression (Percy/Chromatic) | ✓ |
| Property-based testing (critical parsers) | ✓ |
| Release criteria fully automated | ✓ |

**Exit criteria:** Defect escape < 0.1%; flaky rate < 1%.

### Level 4 — Predictive Quality (M9–M12)

| Capability | Target |
|------------|--------|
| ML-based test selection (affected tests) | ✓ |
| Predictive flake detection | ✓ |
| Quality score per service (composite) | ✓ |
| Continuous mutation testing in CI | Evaluate |
| Production traffic replay (staging) | ✓ |
| AI eval with human review queue | ✓ |
| Zero-touch release criteria (fully automated) | ✓ |

**Exit criteria:** 95% releases pass all criteria first attempt; zero P0 escapes for 6 months.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Slow CI blocks velocity | Parallelize; sharding; selective test runs |
| Tests pass but prod fails | Staging parity; synthetic prod monitoring |
| AI eval flakiness | Temperature 0; deterministic tools; multi-run median |
| Coverage gaming | Mutation testing; code review |
| Stale staging data | Weekly ETL; freshness alerts |
| Test maintenance burden | Ownership model; delete obsolete tests |

---

## Open Questions

| ID | Question | Owner | Target |
|----|----------|-------|--------|
| OQ-STRAT-12-01 | Visual regression (Percy vs Chromatic)? | Frontend | M5 |
| OQ-STRAT-12-02 | Dedicated perf environment vs shared staging? | SRE | M4 |
| OQ-STRAT-12-03 | AI eval human review queue design? | AI Platform | M6 |
| OQ-STRAT-12-04 | Property-based testing scope? | Eng | M7 |
| OQ-STRAT-12-05 | Coverage 80% or 90% default? | Eng | 80% default, 90% critical |

---

## References

- [ARCH-24 Testing](../phase-1/24-testing.md)
- [ARCH-02 Software Architecture](../phase-1/02-software-architecture.md)
- [ARCH-06 API Architecture](../phase-1/06-api-architecture.md)
- [ARCH-08 Authorization](../phase-1/08-authorization.md)
- [ARCH-21 Security](../phase-1/21-security.md)
- [STRAT-10 Deployment Strategy](10-deployment-strategy.md)
- [STRAT-13 Security Strategy](13-security-strategy.md)
- [STRAT-14 AI Strategy](14-ai-strategy.md)
- [STRAT-15 Performance Strategy](15-performance-strategy.md)

---

*Document owner: Engineering Quality · Review cadence: Quarterly*