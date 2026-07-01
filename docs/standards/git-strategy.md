---
title: Git Strategy
document_id: ATLAS-STD-003
version: 1.0.0
status: approved
phase: 2
last_updated: 2026-06-30
authors:
  - Atlas Platform Engineering Team
related_documents:
  - ATLAS-ARCH-22
  - ATLAS-ARCH-24
  - coding-standards.md
  - naming-standards.md
tags:
  - git
  - trunk-based-development
  - conventional-commits
  - code-review
  - release-management
---

# Git Strategy

## Purpose

Define the version control workflow for Atlas BOS — enabling rapid, safe delivery through trunk-based development, standardized commit messages, rigorous pull request review, and predictable release management.

## Scope

All contributors to the `atlas-bos` repository must follow this strategy. No long-lived feature branches. No force-push to `main`.

---

## Branching Model: Trunk-Based Development

Atlas uses **trunk-based development** with short-lived feature branches. All work integrates into `main` at least daily.

```
main ─────●─────●─────●─────●─────●─────●───── (always deployable)
           \   /       \   /       \   /
            ●─●         ●─●         ●─●          (short-lived branches, < 2 days)
```

### Core Rules

| Rule | Description |
|------|-------------|
| **GIT-01** | `main` is always deployable — protected branch |
| **GIT-02** | Feature branches live < 2 days; target < 1 day |
| **GIT-03** | Branch from latest `main`; rebase before PR (not merge commits from `main`) |
| **GIT-04** | No long-lived feature branches (> 3 days requires architect approval) |
| **GIT-05** | No force-push to `main` or `release/*` branches |
| **GIT-06** | Squash merge PRs into `main` for clean history |
| **GIT-07** | Delete branch after merge |
| **GIT-08** | All CI checks must pass before merge |
| **GIT-09** | Feature flags for incomplete features — never merge broken code |
| **GIT-10** | Rebase preferred over merge to keep linear history |

### Permanent Branches

| Branch | Purpose | Protection |
|--------|---------|------------|
| `main` | Production-ready trunk | Required reviews, CI, no force-push |
| `release/v{major}.{minor}` | Release stabilization (cut from `main`) | Required reviews, CI, no force-push |

### Temporary Branches

| Branch Pattern | Purpose | Max Lifetime |
|---------------|---------|-------------|
| `feat/{description}` | New feature or enhancement | 2 days |
| `fix/{description}` | Bug fix | 1 day |
| `refactor/{description}` | Code refactoring (no behavior change) | 2 days |
| `docs/{description}` | Documentation only | 1 day |
| `chore/{description}` | Tooling, CI, dependencies | 1 day |
| `test/{description}` | Test additions or fixes | 1 day |
| `hotfix/{description}` | Production hotfix | 4 hours |
| `spike/{description}` | Time-boxed investigation (not merged) | 3 days |

---

## Branch Naming

### Format

```
{type}/{short-description}
```

### Rules

| Rule | Standard |
|------|----------|
| Lowercase only | `feat/customer-lead-scoring` not `feat/Customer-Lead-Scoring` |
| Kebab-case | `fix/invoice-rounding-error` |
| Max 50 characters | Keep descriptions concise |
| Include ticket ID when applicable | `feat/ATL-1234-lead-scoring` |
| No personal names | `feat/john-stuff` forbidden |
| Descriptive | `fix/null-pointer-contact-list` not `fix/bug` |

### Examples

```
feat/customer-lead-scoring
feat/ATL-1234-quote-to-cash-saga
fix/invoice-tax-calculation
fix/ATL-5678-rls-tenant-leak
refactor/extract-payment-acl
docs/adr-0011-event-sourcing
chore/upgrade-typescript-5.5
test/customer-repository-integration
hotfix/stripe-webhook-signature
spike/opensearch-perf-benchmark
```

---

## Commit Message Format

Atlas uses **Conventional Commits** specification (v1.0.0). Every commit message must conform.

### Format

```
{type}({scope}): {description}

[optional body]

[optional footer(s)]
```

### Types

| Type | Purpose | Semver Impact |
|------|---------|---------------|
| `feat` | New feature | MINOR |
| `fix` | Bug fix | PATCH |
| `docs` | Documentation only | — |
| `style` | Formatting, no logic change | — |
| `refactor` | Code restructuring, no behavior change | — |
| `perf` | Performance improvement | PATCH |
| `test` | Adding or fixing tests | — |
| `build` | Build system or dependencies | — |
| `ci` | CI/CD configuration | — |
| `chore` | Maintenance tasks | — |
| `revert` | Revert a previous commit | — |

### Scopes

Scope identifies the affected module or area:

| Scope | Area |
|-------|------|
| `customer` | Customer/CRM module |
| `commercial` | Sales/Commercial module |
| `ledger` | Finance/Ledger module |
| `workforce` | HR module |
| `delivery` | Project Management module |
| `platform` | Platform package (auth, logging, etc.) |
| `shared-kernel` | Shared kernel package |
| `api` | API app |
| `web` | Web frontend app |
| `worker` | Worker app |
| `gateway` | Gateway app |
| `search-indexer` | Go search indexer service |
| `infra` | Infrastructure/Terraform/K8s |
| `docs` | Documentation |
| `deps` | Dependency updates |

### Description Rules

| Rule | Standard |
|------|----------|
| Imperative mood | "add" not "added" or "adds" |
| Lowercase first letter | `add lead scoring` not `Add lead scoring` |
| No period at end | `fix invoice rounding` not `fix invoice rounding.` |
| Max 72 characters | Keep subject line concise |
| Body wraps at 72 characters | Detailed explanation in body |
| Reference issues | `Closes ATL-1234` or `Refs ATL-5678` in footer |

### Breaking Changes

Breaking changes require `!` after type/scope and `BREAKING CHANGE:` in footer:

```
feat(ledger)!: change invoice number format to ULID

BREAKING CHANGE: Invoice numbers changed from sequential integers
to ULID format. Migration script provided in V042 migration.
API consumers must update invoice number validation.
Closes ATL-1234
```

### Commit Examples

```
feat(customer): add lead scoring based on engagement signals

Implement scoring algorithm using email opens, page visits, and
form submissions. Scores recalculated on LeadUpdated events.

Closes ATL-1234

---

fix(ledger): correct tax calculation for EU VAT rules

VAT was applied twice for B2B transactions with valid VAT ID.
Added reverse charge logic per EU directive 2006/112/EC.

Fixes ATL-5678

---

refactor(platform): extract idempotency store to dedicated module

No behavior change. Moves Redis idempotency logic from
apps/api into packages/platform/idempotency for reuse.

---

docs(adr): add ADR-0011 for event sourcing in ledger module

---

chore(deps): upgrade TypeScript to 5.5.0

---

ci: add dependency-cruiser check for module boundaries
```

### Commit Validation

Enforced by `commitlint` in Husky `commit-msg` hook:

```javascript
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', [
      'customer', 'commercial', 'ledger', 'workforce', 'delivery',
      'service', 'content', 'communication', 'campaign', 'stock',
      'obligation', 'insight', 'presence', 'calendar', 'knowledge',
      'orchestration', 'intelligence', 'tenant-identity',
      'platform', 'shared-kernel', 'ui', 'contracts',
      'api', 'web', 'worker', 'gateway',
      'search-indexer', 'event-processor',
      'infra', 'docs', 'deps',
    ]],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 72],
  },
};
```

---

## Pull Request Process

### PR Lifecycle

```
1. Create branch from main
2. Implement changes (small, focused)
3. Self-review against coding standards checklist
4. Push and open PR
5. Automated CI checks run
6. Code review (1–2 reviewers)
7. Address feedback
8. Squash merge to main
9. Delete branch
10. CI deploys to staging automatically
```

### PR Title

PR title = squash commit message. Must follow Conventional Commits format:

```
feat(customer): add lead scoring based on engagement signals
```

### PR Description Template

```markdown
## Summary
Brief description of what this PR does and why.

## Changes
- Change 1
- Change 2

## Test Plan
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed (describe steps)

## Checklist
- [ ] Coding standards checklist completed
- [ ] No `any` types introduced
- [ ] Coverage thresholds met
- [ ] ADR created (if architectural change)
- [ ] Documentation updated
- [ ] `.env.example` updated (if new env vars)

## Related
Closes ATL-1234
Refs ADR-0005
```

### PR Size Guidelines

| Metric | Target | Maximum |
|--------|--------|---------|
| Lines changed | < 400 | 800 (requires justification) |
| Files changed | < 15 | 30 (requires justification) |
| Review time | < 30 minutes | 1 hour |

Large PRs must be split or reviewed in multiple passes with explicit approval per section.

### Review Requirements

| Change Type | Required Reviewers | Approvals |
|-------------|-------------------|-----------|
| Any code change | 1 engineer from code owner team | 1 |
| Cross-module change | 1 engineer per affected module | 2 |
| Security-sensitive | Security team member | 2 |
| Infrastructure | DevOps/SRE team member | 2 |
| Database migration | DBA or data architect | 2 |
| Breaking API change | API team lead + affected module owner | 2 |
| ADR / architecture | Principal engineer or architect | 1 |

### Review SLA

| Priority | First Review Within |
|----------|-------------------|
| Hotfix | 30 minutes |
| Normal | 4 business hours |
| Large / complex | 1 business day |

### Merge Strategy

| Setting | Value |
|---------|-------|
| Merge method | **Squash merge** |
| Squash commit title | PR title (Conventional Commit format) |
| Squash commit body | PR description summary |
| Delete branch on merge | Yes |
| Require linear history | Yes |
| Require signed commits | Recommended, not required (Phase 1) |

---

## Code Owners

Code ownership is enforced via `.github/CODEOWNERS`:

```
# Default owners
*                                   @atlas-bos/platform-team

# Apps
/apps/api/                          @atlas-bos/platform-team
/apps/web/                          @atlas-bos/frontend-team
/apps/worker/                       @atlas-bos/platform-team
/apps/gateway/                      @atlas-bos/platform-team

# Shared packages
/packages/shared-kernel/            @atlas-bos/architecture-team
/packages/platform/                 @atlas-bos/platform-team
/packages/ui/                       @atlas-bos/frontend-team
/packages/contracts/                @atlas-bos/api-team

# Bounded context modules
/packages/modules/tenant-identity/  @atlas-bos/identity-team
/packages/modules/customer/         @atlas-bos/crm-team
/packages/modules/commercial/       @atlas-bos/sales-team
/packages/modules/ledger/           @atlas-bos/finance-team
/packages/modules/workforce/        @atlas-bos/hr-team
/packages/modules/delivery/         @atlas-bos/pm-team
/packages/modules/service/          @atlas-bos/support-team
/packages/modules/intelligence/     @atlas-bos/ai-team
/packages/modules/orchestration/    @atlas-bos/automation-team

# Go services
/services/                          @atlas-bos/platform-team

# Infrastructure
/infra/                             @atlas-bos/sre-team

# Documentation
/docs/adr/                          @atlas-bos/architecture-team
/docs/architecture/                 @atlas-bos/architecture-team
/docs/standards/                    @atlas-bos/architecture-team

# CI/CD
/.github/                           @atlas-bos/sre-team
```

### Code Owner Responsibilities

- Review PRs affecting owned paths within SLA
- Maintain module README and documentation
- Approve architectural changes within their domain
- Escalate cross-cutting concerns to architecture team

---

## CI/CD Integration

### Required Checks (Branch Protection on `main`)

| Check | Tool | Blocking |
|-------|------|----------|
| Lint | ESLint + golangci-lint | Yes |
| Format | Prettier + gofmt | Yes |
| Type check | `tsc --noEmit` | Yes |
| Unit tests | Vitest + Go test | Yes |
| Integration tests | Testcontainers | Yes |
| Coverage thresholds | Codecov | Yes |
| Module boundaries | dependency-cruiser | Yes |
| Commit message | commitlint | Yes |
| Security scan | Snyk / Dependabot | Yes (critical/high) |
| Migration validate | Flyway | Yes |
| Contract tests | Pact | Yes |

### Deployment Pipeline

```
PR opened → CI checks → Review → Squash merge to main
    → CI full suite → Deploy to staging → Smoke tests
    → (manual approval) → Deploy to production
```

| Environment | Trigger | Approval |
|-------------|---------|----------|
| Staging | Auto on merge to `main` | None |
| Production | Manual promotion from staging | 1 SRE + 1 engineer |
| DR region | Manual, post-production | 1 SRE |

---

## Release Management

### Versioning

Atlas follows **Semantic Versioning 2.0.0**:

```
v{MAJOR}.{MINOR}.{PATCH}[-{prerelease}][+{build}]
```

| Bump | Trigger | Example |
|------|---------|---------|
| MAJOR | Breaking API or schema change | `v2.0.0` |
| MINOR | New feature (backward compatible) | `v1.3.0` |
| PATCH | Bug fix (backward compatible) | `v1.2.4` |

### Release Cadence

| Type | Frequency | Process |
|------|-----------|---------|
| Regular release | Bi-weekly (Tuesday) | Cut `release/v{X.Y}` from `main`, stabilize 2 days, tag |
| Patch release | As needed | Tag directly on `main` |
| Hotfix release | Emergency | Hotfix branch, fast-track review, tag |

### Release Process

```
1. Create release/v{X.Y} branch from main (bi-weekly)
2. Stabilization period (2 days) — only fix commits allowed
3. Run full E2E suite on release branch
4. Tag: git tag -a v{X.Y.Z} -m "Release v{X.Y.Z}"
5. Push tag → triggers production deployment
6. Merge release branch back to main
7. Generate changelog from Conventional Commits
8. Publish release notes on GitHub
```

### Release Tag Format

```
v1.2.3                  # Standard release
v1.2.3-rc.1             # Release candidate
v1.2.3-beta.1           # Beta release
v1.2.4-hotfix.1         # Hotfix release
```

### Changelog Generation

Auto-generated from Conventional Commits using `git-cliff` or `standard-version`:

```markdown
# v1.3.0 (2026-07-15)

## Features
- **customer:** add lead scoring based on engagement signals (#142)
- **ledger:** support multi-currency invoice generation (#145)

## Bug Fixes
- **ledger:** correct EU VAT reverse charge calculation (#148)

## Performance
- **search-indexer:** batch indexing reduces latency by 40% (#150)
```

---

## Hotfix Procedure

For production-critical issues requiring immediate fix:

```
1. Create hotfix/{description} branch from latest release tag
2. Implement minimal fix (no scope creep)
3. Fast-track review: 1 approval from code owner + 1 SRE
4. CI must pass (no exceptions)
5. Merge to hotfix branch
6. Tag: v{X.Y.Z}-hotfix.{n}
7. Deploy to production
8. Cherry-pick or merge hotfix back to main
9. Post-incident: write postmortem if SEV-1/SEV-2
```

### Hotfix Rules

| Rule | Standard |
|------|----------|
| **HF-01** | Minimal change — fix only the production issue |
| **HF-02** | No feature additions on hotfix branches |
| **HF-03** | Must have associated incident ticket |
| **HF-04** | Postmortem required for SEV-1 and SEV-2 |
| **HF-05** | Hotfix must be merged back to `main` within 24 hours |
| **HF-06** | Maximum 4 hours from branch creation to production deploy |

### Severity Classification

| Severity | Definition | Hotfix Required |
|----------|-----------|----------------|
| SEV-1 | Complete service outage or data loss | Yes — immediate |
| SEV-2 | Major feature broken, no workaround | Yes — within 4 hours |
| SEV-3 | Feature degraded, workaround exists | Normal fix process |
| SEV-4 | Minor issue, cosmetic | Normal fix process |

---

## Feature Flags

Incomplete features must be behind feature flags — never merge disabled code paths that break production.

| Rule | Standard |
|------|----------|
| **FF-01** | Feature flags for any feature not ready for general availability |
| **FF-02** | Flag naming: `{module}_{feature}_{state}` — e.g., `customer_lead_scoring_enabled` |
| **FF-03** | Flags managed via platform config service (not env vars for user-facing features) |
| **FF-04** | Remove flag and dead code within 2 releases of GA |
| **FF-05** | Flag default: `false` in production, `true` in development |

---

## Git Hygiene

### Do

- Pull `main` and rebase before starting new work
- Commit early and often on feature branches
- Write meaningful commit messages
- Keep PRs small and focused
- Respond to review feedback promptly
- Delete merged branches

### Do Not

- Force-push to `main` or `release/*`
- Commit secrets, credentials, or `.env` files
- Merge with failing CI
- Leave PRs open > 3 days without activity
- Commit generated files (build output, `node_modules`, coverage reports)
- Use `git commit --no-verify` except in documented emergencies
- Rewrite published history on shared branches

### `.gitignore` Essentials

```
node_modules/
dist/
build/
coverage/
.env
.env.local
.env.*.local
*.log
.turbo/
.DS_Store
```

---

## Cross-References

| Document | Relationship |
|----------|--------------|
| [coding-standards.md](./coding-standards.md) | Code review checklist |
| [naming-standards.md](./naming-standards.md) | Branch and tag naming |
| [22-deployment.md](../architecture/phase-1/22-deployment.md) | Deployment pipeline |
| [24-testing.md](../architecture/phase-1/24-testing.md) | CI quality gates |

---

*Document owner: Platform Engineering · Review cadence: Quarterly · Enforcement: Branch protection + commitlint + CODEOWNERS*