# ADR-0005: RBAC + ABAC Authorization with OPA

**Status:** Accepted
**Date:** 2026-06-30
**Deciders:** Chief Software Architect, Security Team
**Related:** [08-authorization.md](../architecture/phase-1/08-authorization.md), [21-security.md](../architecture/phase-1/21-security.md)

## Context

Atlas BOS is a multi-tenant platform where authorization must scale from simple team permissions ("owner can do everything") to enterprise-grade fine-grained control ("Sales Manager in EMEA region can edit contacts they own but not delete them"). Requirements include:

- **Role-based access** for common patterns (owner, admin, member, viewer)
- **Attribute-based access** for enterprise scenarios (department, region, data classification, time-of-day)
- **Resource-level permissions** — access to specific contacts, invoices, projects
- **AI agent delegation** — users grant scoped permissions to AI agents
- **OAuth app scopes** — third-party integrations with limited API access
- **Audit trail** — every authorization decision logged for compliance (SOC 2, GDPR, HIPAA)
- **Performance** — permission checks on every API request; must be < 5ms p99
- **Policy as code** — policies version-controlled, testable, reviewable in PRs

Authorization engine candidates:

| Engine | Strengths | Weaknesses |
|--------|-----------|------------|
| **Open Policy Agent (OPA)** | Policy-as-code (Rego), decoupled from app, CNCF graduated, sidecar or embedded | Rego learning curve, policy debugging |
| **Casbin** | Simple RBAC/ABAC models, library embedded in app | Less flexible for complex policies, no policy-as-code standard |
| **AWS Cedar** | Modern policy language, formal verification | AWS-centric, newer, smaller ecosystem |
| **Custom in-app** | Full control, no external dependency | Hard to test, policy drift, not auditable |
| **Keycloak authorization** | Integrated with identity | Tied to Keycloak, less flexible for resource-level ABAC |

Atlas requires policy-as-code (version controlled, PR-reviewable), support for both RBAC and ABAC in a single engine, and decoupling of policy from application code.

## Decision

Atlas implements a **hybrid RBAC + ABAC authorization model** using **Open Policy Agent (OPA)** as the policy decision engine:

### Authorization Model

| Layer | Mechanism | Example |
|-------|-----------|---------|
| **RBAC** | Roles → Permissions mapping | Role `admin` grants `contacts:*`, `invoices:*` |
| **ABAC** | Attribute conditions on policies | `contacts:edit` allowed if `resource.owner_id == user.id` |
| **Resource-level** | Object-specific grants | User granted `project:123:read` directly |
| **Delegation** | Scoped agent permissions | User grants agent `invoices:read` for 24 hours |
| **Integration scopes** | OAuth app permissions | App granted `contacts:read`, `deals:read` via OAuth consent |

### OPA Architecture

```
API Request
    → Extract principal (user/service/agent/oauth_app)
    → Build authorization input (action, resource, context attributes)
    → OPA Evaluate (Rego policies)
    → Allow / Deny (+ audit log)
    → Proceed or 403 Forbidden
```

- **OPA deployment:** Sidecar container alongside API pods in Kubernetes
- **Policy storage:** Rego files in `infra/docker/opa/policies/` — version controlled, deployed as bundles
- **Policy structure:** Base RBAC policies + module-specific ABAC rules + tenant overrides
- **Data bundle:** OPA receives role/permission data via REST API push (not direct DB access)
- **Caching:** Authorization decisions cached in Redis (TTL 60s) with invalidation on role changes
- **Fallback:** Fail closed — if OPA unavailable, deny all requests (503 for transient, 403 for evaluation errors)

### Permission Format

```
{resource}:{action}
{resource}:{id}:{action}

Examples:
contacts:read
contacts:write
contacts:delete
invoices:read
invoices:write
projects:{id}:manage
settings:organization:write
agent:delegate
```

### Policy Testing

- Rego policies tested with `opa test` in CI
- Authorization integration tests verify role/attribute combinations
- Policy changes require security team review

## Consequences

### Positive

- **Policy as code** — authorization rules version-controlled, PR-reviewable, auditable
- **Flexible model** — RBAC for simplicity, ABAC for enterprise without separate systems
- **Decoupled** — policy changes without application code deployment
- **AI agent support** — delegation policies expressed in same Rego language
- **Compliance** — every decision auditable; policy changes tracked in git history
- **Testable** — `opa test` enables comprehensive policy unit tests
- **Industry standard** — OPA is CNCF graduated; large community and tooling

### Negative

- **Rego learning curve** — policy authors need Rego training
- **Operational dependency** — OPA sidecar adds deployment complexity and failure domain
- **Latency** — network hop to OPA sidecar adds ~1-2ms per request (mitigated by caching)
- **Policy debugging** — complex ABAC rules can be hard to troubleshoot without good tooling
- **Cache invalidation** — role changes must invalidate cached decisions promptly

### Neutral

- Simple RBAC policies cover 80% of use cases; ABAC for enterprise tier
- OPA bundle deployment automated via CI/CD pipeline
- Policy simulator tool planned for admin UI (Phase 4)
- Cedar evaluation deferred — OPA ecosystem maturity preferred for Phase 1