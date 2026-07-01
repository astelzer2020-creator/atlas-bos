---
title: Testing
document_id: ARCH-24
version: 1.0.0
status: approved
phase: 1
last_updated: 2026-06-30
authors:
  - Atlas Architecture Team
related_documents:
  - ARCH-02
  - ARCH-06
  - ARCH-19
  - ARCH-21
  - ARCH-22
  - ARCH-23
  - ARCH-25
tags:
  - testing
  - quality
  - ci
  - chaos
  - security-testing
  - accessibility
---

# Testing

## Purpose

Define the architecture for **Testing and Quality Assurance** at Atlas — the comprehensive strategy ensuring every module, API, workflow, and AI capability meets production-grade reliability, security, performance, and accessibility standards before reaching customers. Testing is a **continuous, automated discipline** embedded in the development lifecycle, not a final gate.

## Scope

### In Scope

- Testing pyramid (unit, integration, e2e, contract)
- Test environments and data strategy
- Fixture and factory patterns
- Mutation testing
- Performance and load testing
- Chaos engineering
- Accessibility testing (WCAG 2.1 AA)
- Security testing (SAST, DAST, penetration automation)
- AI/agent evaluation testing
- CI/CD quality gates
- Test observability and flake management

### Out of Scope

- Manual QA process documentation (Phase 2)
- Specific test framework code
- Customer UAT procedures

---

## Context

Atlas ships to millions of organizations where defects cause financial loss, compliance violations, and eroded trust. A Business Operating System cannot rely on manual testing alone. The testing architecture must:

- Catch regressions before production
- Validate multi-tenant isolation on every change
- Ensure API contracts are honored across services
- Verify AI agents behave safely under adversarial inputs
- Scale test execution with codebase growth

### Quality Targets

| Metric | Target |
|--------|--------|
| Unit test coverage (lines) | ≥ 80% per service |
| Integration test coverage (critical paths) | 100% |
| E2E smoke suite pass rate | 100% pre-deploy |
| Production defect escape rate | < 0.1% of releases |
| Flaky test rate | < 1% |
| P0 test failure MTTR | < 4 hours |

---

## Detailed Design

### 1. Testing Pyramid

```
                    ┌───────────┐
                    │    E2E    │  ~5%   (slow, high confidence)
                    │  Contract │
                   ┌┴───────────┴┐
                   │ Integration  │  ~25%  (service boundaries)
                  ┌┴─────────────┴┐
                  │     Unit      │  ~70%  (fast, isolated)
                  └───────────────┘
```

| Layer | Scope | Speed | Tools |
|-------|-------|-------|-------|
| Unit | Functions, classes, pure logic | < 10ms/test | Jest, Vitest, Go test, pytest |
| Integration | DB, Kafka, Redis, service pairs | < 5s/test | Testcontainers, docker-compose |
| Contract | API schemas between services | < 1s/test | Pact, OpenAPI diff |
| E2E | Full user journeys (browser) | < 60s/test | Playwright |
| Specialized | Perf, chaos, a11y, security | Varies | k6, Litmus, axe, OWASP ZAP |

**Principle:** Push tests down the pyramid. E2E covers critical paths only; business logic tested at unit layer.

### 2. Test Environments

| Environment | Purpose | Data | Refresh |
|-------------|---------|------|---------|
| Local | Developer iteration | Docker fixtures | On demand |
| CI | PR validation | Ephemeral containers | Per build |
| Dev | Integration | Synthetic | Continuous |
| Staging | Pre-prod validation | Anonymized prod snapshot | Weekly |
| Production | Synthetic monitoring only | Real (isolated tenant) | N/A |

#### Environment Parity Matrix

| Property | Local | CI | Staging | Production |
|----------|-------|-----|---------|------------|
| Kubernetes | Kind/k3d | Kind | Full EKS | Full EKS |
| PostgreSQL | Container | Testcontainers | RDS (scaled) | RDS |
| Kafka | Container | Testcontainers | MSK | MSK |
| Redis | Container | Testcontainers | ElastiCache | ElastiCache |
| Feature flags | Local overrides | Mock | LaunchDarkly test | LaunchDarkly prod |
| LLM | Mock/stub | Mock | Test API keys | Production keys |

**Staging fidelity:** 20% of production scale; identical service topology.

### 3. Fixture Strategy

#### Test Data Principles

1. **No production data in CI/local** — Synthetic or anonymized only
2. **Deterministic** — Seeded RNG for reproducible tests
3. **Tenant-isolated** — Every fixture includes `tenant_id`
4. **Minimal** — Create only required entities per test
5. **Self-cleaning** — Transaction rollback or truncate per test

#### Factory Pattern

```typescript
// Example: test factory
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

| Tier | Use Case | Storage |
|------|----------|---------|
| Inline | Unit tests | Hardcoded minimal objects |
| Factory | Integration tests | Programmatic creation |
| Snapshot | Contract tests | JSON fixtures in repo |
| Scenario | E2E tests | Pre-seeded staging datasets |
| Anonymized | Staging | Weekly ETL from prod |

#### Multi-Tenant Test Cases

Every integration test suite includes:

- Cross-tenant access denial (tenant A cannot read tenant B)
- RLS enforcement on direct DB queries
- API requests without `tenant_id` rejected
- Shared resource isolation (cache keys, search indices)

### 4. Unit Testing

| Requirement | Standard |
|-------------|----------|
| Coverage threshold | 80% lines (CI gate) |
| Critical modules | 90% (auth, payments, encryption) |
| Mocking | External I/O only; prefer fakes over mocks |
| Naming | `describe('InvoiceService')` → `it('creates invoice with valid input')` |
| Speed | Full unit suite < 2 minutes per service |

#### What to Unit Test

- Business logic and validation rules
- State machine transitions (workflow engine)
- Expression language evaluation (automation conditions)
- Permission check logic
- PII redaction functions
- Cost calculation (agent budgets)

#### What NOT to Unit Test

- Framework boilerplate
- Third-party library internals
- Simple getters/setters

### 5. Integration Testing

Uses **Testcontainers** for real PostgreSQL, Kafka, Redis — no in-memory substitutes for persistence behavior.

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

    // Verify event published
    event := kafka.ConsumeOne(t, "finance.invoice.created")
    assert.Equal(t, invoice.ID, event.Payload.InvoiceID)
}
```

#### Integration Test Categories

| Category | Examples |
|----------|----------|
| Repository | CRUD, constraints, indexes |
| Event publishing | Kafka produce/consume |
| Cache | Redis hit/miss, invalidation |
| Auth integration | Token validation, permission enforcement |
| Migration | Schema up/down on Testcontainers |
| Workflow | Instance lifecycle end-to-end |
| Agent tools | Tool invocation with mock LLM |

### 6. Contract Testing

Prevent breaking changes between services.

#### Consumer-Driven Contracts (Pact)

```
finance-api (consumer) ──pact──► api-gateway (provider)
workflow-runtime (consumer) ──pact──► finance-api (provider)
```

| Rule | Enforcement |
|------|-------------|
| Provider verifies all consumer pacts in CI | Block PR on failure |
| Breaking change requires version bump | Semver |
| OpenAPI spec is source of truth | Diff on PR |

#### Event Contracts

```yaml
# AsyncAPI event contract
event: finance.invoice.created
version: 2
payload:
  required: [invoice_id, tenant_id, amount, currency]
  properties:
    invoice_id: { type: string }
    tenant_id: { type: string }
    amount: { type: number }
```

Schema registry (Kafka) enforces compatibility: `BACKWARD` by default.

### 7. End-to-End Testing

**Playwright** for browser-based tests against staging.

#### Critical Path Suites

| Suite | Journeys | Frequency |
|-------|----------|-----------|
| Smoke | Login, dashboard load | Every deploy |
| Core CRM | Create contact, deal, activity | Daily |
| Finance | Create invoice, record payment | Daily |
| Workflow | Start approval, complete task | Daily |
| Automation | Trigger rule, verify action | Daily |
| AI Agent | Ask question, read-only tool use | Daily |
| Admin | User invite, role assignment | Weekly |

```typescript
test('expense approval workflow', async ({ page }) => {
  await login(page, 'manager@test.atlas.dev');
  await page.goto('/workflows/tasks');
  await page.click('[data-testid="task-expense-001"]');
  await page.click('[data-testid="approve-button"]');
  await expect(page.locator('[data-testid="task-status"]')).toHaveText('Completed');
});
```

#### E2E Standards

- `data-testid` attributes required (no CSS selector fragility)
- Parallel execution with isolated test tenants
- Video/screenshot on failure
- Max suite time: 30 minutes (sharded across workers)

### 8. Mutation Testing

Validates test suite effectiveness by injecting code mutations.

| Tool | Language |
|------|----------|
| Stryker | TypeScript/JavaScript |
| mutmut | Python |
| go-mutesting | Go |

| Service Tier | Mutation Score Target |
|--------------|----------------------|
| Critical (auth, payments) | ≥ 80% |
| Standard | ≥ 70% |
| Non-critical | ≥ 60% |

Run monthly on critical services; block release if score drops > 5% from baseline.

### 9. Performance Testing

See ARCH-23 for load testing strategy. Testing architecture adds:

| Test | When | Gate |
|------|------|------|
| Baseline latency | Weekly staging | P99 < 500ms |
| Regression | PR (critical services) | < 10% degradation |
| Soak | Quarterly | No memory leaks 72h |
| Spike | Monthly | Recovery < 5 min |

#### Performance Test Integration

```yaml
# CI performance gate (k6)
thresholds:
  http_req_duration:
    - 'p(99)<500'
  http_req_failed:
    - 'rate<0.001'
```

PRs touching `api-gateway`, `auth-service`, or database queries trigger mini perf test (5 min, 500 VUs).

### 10. Chaos Engineering

**Principles:** Test in staging; automate; hypothesize before experiment; minimize blast radius.

| Experiment | Hypothesis | Tool |
|------------|------------|------|
| Pod kill | Service recovers < 30s | Litmus pod-delete |
| Network latency | P99 < 2s under 200ms injected latency | Litmus network-chaos |
| DB failover | RTO < 60s; no data loss | Manual + automated verify |
| Kafka broker down | Consumer lag recovers | Litmus |
| Redis unavailable | Graceful degradation to DB | Litmus |
| LLM provider timeout | Agent retries/failover works | Mock injection |

#### Game Days

- Quarterly cross-team chaos game day in staging
- Scenarios from ARCH-25 disaster recovery runbooks
- Blameless post-mortem for unexpected failures

### 11. Accessibility Testing

**Target:** WCAG 2.1 Level AA compliance.

| Method | Tool | When |
|--------|------|------|
| Automated | axe-core (Playwright integration) | Every PR (UI changes) |
| Manual | Screen reader (NVDA, VoiceOver) | Sprint review for new features |
| Keyboard nav | Manual checklist | New interactive components |
| Color contrast | axe + manual | Design system components |

```typescript
test('invoice page accessibility', async ({ page }) => {
  await page.goto('/finance/invoices/new');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

**CI gate:** Zero critical/serious axe violations on changed pages.

### 12. Security Testing

Complements ARCH-21 security controls with automated verification.

| Type | Tool | Frequency | Gate |
|------|------|-----------|------|
| SAST | Semgrep, CodeQL | Every PR | Block critical |
| SCA | Snyk | Every PR + daily | Block critical CVE |
| Secret scan | Gitleaks | Every commit | Block |
| DAST | OWASP ZAP | Weekly staging | Track remediation |
| AuthZ matrix | Custom test suite | Every PR (auth changes) | 100% pass |
| Tenant isolation | Integration suite | Every PR | 100% pass |
| Prompt injection | AI red team suite | Weekly | Track |

#### Authorization Matrix Tests

```typescript
describe('Invoice API authorization', () => {
  const matrix = [
    { role: 'viewer', method: 'GET', path: '/invoices', expect: 200 },
    { role: 'viewer', method: 'POST', path: '/invoices', expect: 403 },
    { role: 'finance_admin', method: 'DELETE', path: '/invoices/:id', expect: 200 },
    { role: 'other_tenant_user', method: 'GET', path: '/invoices/:id', expect: 404 },
  ];
  matrix.forEach(({ role, method, path, expect }) => {
    it(`${role} ${method} ${path} → ${expect}`, async () => { /* ... */ });
  });
});
```

### 13. AI Agent Evaluation Testing

| Test Type | Description |
|-----------|-------------|
| Golden sets | Expected input → expected tool calls/output |
| Regression | Model/prompt change does not degrade accuracy |
| Safety | Prompt injection resistance |
| Cost | Run stays within budget |
| Permission | Agent cannot exceed user permissions |
| Hallucination | Financial figures match source data |

```yaml
eval_case:
  id: expense_policy_query
  input: "What is the approval threshold for expenses?"
  expected_tools: [memory.recall]
  expected_output_contains: ["1000 USD"]
  max_cost_cents: 10
  max_duration_seconds: 15
```

Run eval suite on prompt/model changes; block deploy if accuracy drops > 2%.

### 14. CI/CD Quality Gates

```
PR Created
    │
    ├─► Unit tests (pass)
    ├─► Integration tests (pass)
    ├─► Coverage ≥ 80% (pass)
    ├─► SAST/SCA (no critical)
    ├─► Contract tests (pass)
    ├─► Accessibility (no serious violations)
    ├─► AuthZ matrix (pass)
    │
    ▼
Merge to main
    │
    ├─► Full integration suite
    ├─► E2E smoke (staging)
    ├─► Performance regression (if applicable)
    │
    ▼
Deploy to staging
    │
    ├─► E2E full suite
    ├─► DAST scan
    │
    ▼
Deploy to production (ARCH-22)
    │
    └─► Synthetic smoke (production)
```

### 15. Test Observability and Flake Management

| Metric | Target |
|--------|--------|
| Flaky test rate | < 1% |
| Test suite duration | < 15 min (PR); < 45 min (main) |
| Quarantined tests | < 0.5% of total |

**Flake policy:**

1. Auto-retry once in CI (not locally)
2. Second failure → quarantine test (issue created)
3. Quarantined tests don't block merge but block release
4. Fix within 5 business days

Test results published to Grafana dashboard; flaky tests highlighted.

### 16. Test Ownership

| Scope | Owner |
|-------|-------|
| Unit tests | Feature team |
| Integration tests | Feature team |
| Contract tests | Consumer + provider teams |
| E2E smoke | Platform QA |
| Performance | SRE + feature team |
| Chaos | SRE |
| Security tests | Security team |
| AI evals | AI platform team |

---

## Alternatives Considered

### Alternative 1: Manual QA Only

**Rejected:** Cannot scale to release cadence or coverage requirements.

### Alternative 2: 100% E2E Coverage

**Rejected:** Slow, flaky, expensive; poor failure localization.

### Alternative 3: In-Memory Databases for Integration Tests

**Rejected:** Misses PostgreSQL-specific behavior (RLS, constraints, JSON operators).

### Alternative 4: Skip AI Testing (Non-Deterministic)

**Rejected:** AI is core product; golden sets and safety tests mandatory.

### Alternative 5: Annual Security Testing Only

**Rejected:** Continuous SAST/DAST required for SOC 2 and rapid remediation.

---

## Consequences

### Positive

- High confidence in releases; low defect escape rate
- Multi-tenant isolation verified on every change
- Contract tests prevent distributed system breakage
- AI safety validated before customer exposure
- Accessibility and security embedded, not bolted on

### Negative

- CI infrastructure cost (Testcontainers, Playwright workers)
- Test maintenance burden grows with codebase
- Mutation testing adds CI time
- Flaky test management overhead

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Slow CI blocks velocity | Parallelize; test sharding; selective runs |
| Tests pass but prod fails | Staging parity; synthetic prod monitoring |
| AI eval flakiness | Temperature 0; deterministic tools; multiple runs |
| Coverage gaming | Mutation testing; code review |

---

## Open Questions

| ID | Question | Owner | Target |
|----|----------|-------|--------|
| OQ-24-01 | Coverage threshold 80% or 90% for all services? | Eng | 80% default, 90% critical |
| OQ-24-02 | Visual regression testing (Percy/Chromatic) in Phase 1? | Frontend | Phase 2 |
| OQ-24-03 | Dedicated performance test environment vs. shared staging? | SRE | Shared with isolation windows |
| OQ-24-04 | AI eval human review queue for ambiguous cases? | AI Platform | Phase 2 |
| OQ-24-05 | Property-based testing (fast-check/Hypothesis) adoption scope? | Eng | Critical parsers/expressions |

---

## References

- ARCH-02 Software Architecture
- ARCH-06 API Architecture
- ARCH-08 Authorization
- ARCH-19 Monitoring
- ARCH-21 Security
- ARCH-22 Deployment
- ARCH-23 Scaling
- ARCH-25 Disaster Recovery