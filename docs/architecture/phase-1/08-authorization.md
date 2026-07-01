---
title: Authorization
version: 1.0.0
status: draft
phase: 1
last_updated: 2026-06-30
authors:
  - Atlas Architecture Team
related_documents:
  - 02-software-architecture.md
  - 06-api-architecture.md
  - 07-authentication.md
  - 21-security.md
adr_references:
  - ADR-0008
  - ADR-0016
  - ADR-0023
---

# Authorization

## Purpose

Define how Atlas controls access to resources, APIs, and actions after authentication has established identity. Authorization determines *what* an authenticated principal (user, service account, AI agent, OAuth app) may do within and across tenant boundaries. This document specifies the RBAC + ABAC hybrid model, policy engine architecture, permission hierarchy, delegation, integration scopes, and authorization audit logging.

## Scope

### In Scope

- RBAC model (roles, permissions, scopes)
- ABAC for fine-grained, attribute-based control
- Resource-level permissions
- Organization / workspace / team hierarchy permissions
- Policy engine architecture (OPA)
- Permission inheritance and delegation
- API scopes for integrations and OAuth applications
- Audit logging for authorization decisions
- Permission evaluation flow and caching

### Out of Scope

- Authentication and identity verification (`07-authentication.md`)
- API gateway rate limiting (`06-api-architecture.md`)
- Database RLS implementation (`05-database-architecture.md`)
- UI permission rendering (Phase 4 — UI Specification)
- Full permission catalog per module (Phase 3 + Phase 5)

## Context

Atlas is a multi-tenant Business Operating System where a single user may belong to multiple organizations, teams, and workspaces — each with different roles and access levels. Authorization must:

1. Support **simple defaults** (owner, admin, member) for small teams
2. Enable **fine-grained control** for enterprises (custom roles, field-level access)
3. Enforce **tenant isolation** — no cross-tenant data access except explicit federation
4. Support **AI agent delegation** — users grant agents scoped permissions
5. Provide **integration scopes** for OAuth apps and API keys
6. Produce **auditable decisions** for compliance (SOC 2, GDPR, HIPAA)

### Authorization vs Authentication

| Concern | Question | Document |
|---------|----------|----------|
| Authentication | Who are you? | `07-authentication.md` |
| Authorization | What can you do? | This document |
| Tenant isolation | Which organization's data? | `05-database-architecture.md` + this document |

---

## Detailed Design

### 1. Authorization Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Authorization Request                             │
│  Principal: user | service_account | agent | oauth_app                  │
│  Action: contacts:read | invoices:write | projects:delete               │
│  Resource: contact:uuid | invoice:uuid | project:uuid                   │
│  Context: tenant_id, workspace_id, ip, time, device_trust              │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Authorization      │
                    │  Middleware         │
                    │  (API / Service)    │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
     │ RBAC Engine │  │ ABAC Engine │  │ Policy      │
     │ (role →     │  │ (attributes │  │ Engine      │
     │  permissions)│  │  + context) │  │ (OPA)       │
     └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
            │                │                │
            └────────────────┴────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Decision: ALLOW /  │
                    │  DENY (+ reason)      │
                    │  → Audit log          │
                    └─────────────────────┘
```

---

### 2. RBAC Model

#### 2.1 Core Concepts

| Concept | Description | Example |
|---------|-------------|---------|
| **Permission** | Atomic action on a resource type | `contacts:read`, `invoices:write` |
| **Role** | Named collection of permissions | `admin`, `sales_manager`, `viewer` |
| **Role Assignment** | Binding of role to principal at a scope | Alice is `admin` in Workspace A |
| **Scope** | Context where role applies | `organization`, `workspace`, `team` |
| **Principal** | Entity being authorized | User, service account, agent, OAuth app |

#### 2.2 Permission Naming Convention

```
{module}:{resource}:{action}

Examples:
  crm:contacts:read
  crm:contacts:write
  crm:contacts:delete
  finance:invoices:read
  finance:invoices:write
  finance:invoices:send
  finance:invoices:void
  projects:tasks:read
  projects:tasks:assign
  admin:members:invite
  admin:roles:manage
  admin:billing:manage
  ai:agents:execute
  platform:settings:manage
```

**Shorthand** (when resource equals module default):

```
contacts:read     → crm:contacts:read
invoices:write    → finance:invoices:write
```

#### 2.3 System Roles (Built-In)

| Role | Scope | Description | Key Permissions |
|------|-------|-------------|-----------------|
| **owner** | Organization | Full control; billing; cannot be removed if sole owner | All permissions |
| **admin** | Organization | Manage members, settings, all modules | All except `admin:billing:manage` (configurable) |
| **member** | Organization | Standard access per module defaults | Read + write on assigned modules |
| **viewer** | Organization | Read-only access | All `:read` permissions |
| **guest** | Workspace/Project | Limited external collaborator | Scoped read + comment |
| **billing_admin** | Organization | Billing and subscription only | `admin:billing:*` |

System roles cannot be deleted but can be customized (add/remove permissions) by enterprise tenants.

#### 2.4 Custom Roles

Enterprise tenants create custom roles:

```json
POST /v1/roles
{
  "name": "Sales Manager",
  "description": "Manages sales team, contacts, and deals",
  "permissions": [
    "crm:contacts:read",
    "crm:contacts:write",
    "crm:deals:read",
    "crm:deals:write",
    "crm:deals:assign",
    "finance:invoices:read",
    "reports:sales:read"
  ],
  "scope_type": "workspace"
}
```

Custom roles are tenant-scoped. Maximum 100 custom roles per tenant (configurable).

#### 2.5 Role Assignment

```json
{
  "id": "assignment_uuid",
  "principal_type": "user",
  "principal_id": "user_uuid",
  "role_id": "role_uuid",
  "scope_type": "workspace",
  "scope_id": "workspace_uuid",
  "granted_by": "admin_user_uuid",
  "granted_at": "2026-06-30T12:00:00Z",
  "expires_at": null
}
```

- A principal can hold multiple roles across multiple scopes
- Role assignments can be time-limited (`expires_at`)
- Assignments are immutable history — changes create new records (audit)

---

### 3. ABAC for Fine-Grained Control

#### 3.1 When to Use ABAC vs RBAC

| Scenario | Model | Rationale |
|----------|-------|-----------|
| "Can this user access CRM?" | RBAC | Module-level; role covers it |
| "Can this user edit this specific invoice?" | ABAC | Resource ownership, status, amount |
| "Can this agent run during business hours?" | ABAC | Time-based policy |
| "Can this user see salaries in HR?" | ABAC | Field-level sensitivity |
| "Can guest comment on this project?" | ABAC | Resource-level guest list |

**Principle:** RBAC for coarse-grained; ABAC when context matters.

#### 3.2 Attribute Categories

| Category | Attributes | Source |
|----------|------------|--------|
| **Subject** (principal) | `user_id`, `roles`, `team_ids`, `department`, `clearance_level` | Auth context + user profile |
| **Resource** | `resource_type`, `resource_id`, `owner_id`, `status`, `amount`, `visibility` | Database record |
| **Environment** | `tenant_id`, `workspace_id`, `ip_address`, `time`, `device_trust`, `mfa_verified` | Request context |
| **Action** | `permission`, `http_method`, `api_endpoint` | Request |

#### 3.3 ABAC Policy Examples

**Invoice edit restriction — only draft invoices editable by non-admin:**

```rego
# OPA Rego policy
allow {
    input.permission == "finance:invoices:write"
    input.resource.status == "draft"
    rbac_has_permission(input.subject, input.permission)
}

allow {
    input.permission == "finance:invoices:write"
    rbac_has_permission(input.subject, "finance:invoices:admin")
}
```

**Field-level — salary visible only to HR admin:**

```rego
deny_field {
    input.field == "salary"
    not rbac_has_permission(input.subject, "hr:compensation:read")
}
```

**Time-based — agent execution only during business hours:**

```rego
allow {
    input.principal_type == "agent"
    input.permission == "ai:agents:execute"
    time.now_ns() >= business_hours_start
    time.now_ns() <= business_hours_end
}
```

#### 3.4 ABAC Evaluation Order

```
1. Tenant isolation check (must pass — non-negotiable)
2. RBAC check (does role include permission?)
3. ABAC policy check (resource/context constraints)
4. Explicit deny overrides (deny > allow)
5. Default deny (if no rule matches → DENY)
```

---

### 4. Resource-Level Permissions

#### 4.1 Resource Permission Model

Beyond role-based access, individual resources can have explicit grants:

```json
{
  "resource_type": "project",
  "resource_id": "project_uuid",
  "grants": [
    {
      "principal_type": "user",
      "principal_id": "user_uuid",
      "permission": "projects:tasks:write",
      "granted_by": "project_owner_uuid",
      "granted_at": "2026-06-30T12:00:00Z"
    },
    {
      "principal_type": "team",
      "principal_id": "team_uuid",
      "permission": "projects:tasks:read",
      "granted_by": "project_owner_uuid",
      "granted_at": "2026-06-30T12:00:00Z"
    }
  ]
}
```

#### 4.2 Resource Visibility Levels

| Level | Description | Access |
|-------|-------------|--------|
| **Private** | Only owner and explicit grants | Owner + grants |
| **Team** | Visible to owner's team(s) | Team members with role |
| **Workspace** | Visible to workspace members | Workspace role permissions |
| **Organization** | Visible to all org members | Org role permissions |
| **Public** | Visible externally (future) | Authenticated external users |

#### 4.3 Resource Permission Inheritance

```
Organization (tenant)
  └── Workspace
       └── Project
            └── Task
                 └── Comment
```

| Rule | Behavior |
|------|----------|
| Parent → child | Access to parent grants access to children (unless restricted) |
| Child → parent | No inheritance upward |
| Explicit deny on child | Overrides parent grant |
| Guest on project | Access to project + children only; no workspace/org access |

#### 4.4 Sharing and Collaboration

```http
POST /v1/projects/{id}/shares
{
  "principal_type": "user",
  "principal_id": "external_user_uuid",
  "permissions": ["projects:tasks:read", "projects:comments:write"],
  "expires_at": "2026-09-30T00:00:00Z"
}
```

Shared access creates resource-level grants with optional expiration.

---

### 5. Organization / Workspace / Team Hierarchy

#### 5.1 Hierarchy Model

```
┌─────────────────────────────────────────────────────────┐
│                    Organization (Tenant)                 │
│  Roles: owner, admin, member, viewer, custom          │
│  Modules: CRM, Finance, HR, Projects, ...               │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │  Workspace A    │  │  Workspace B    │              │
│  │  (e.g., Sales)  │  │  (e.g., Eng)      │              │
│  │  Roles: admin,  │  │  Roles: admin,    │              │
│  │  member, guest  │  │  member           │              │
│  ├─────────────────┤  ├─────────────────┤              │
│  │ ┌─────┐ ┌─────┐ │  │ ┌─────┐         │              │
│  │ │Team1│ │Team2│ │  │ │Team3│         │              │
│  │ └─────┘ └─────┘ │  │ └─────┘         │              │
│  └─────────────────┘  └─────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

#### 5.2 Scope Resolution

When a request arrives, the authorization engine resolves the effective scope:

```
Request: GET /v1/contacts?workspace_id=ws_a
    │
    ▼
1. Extract tenant_id from JWT (tid claim)
2. Extract workspace_id from request (param or header)
3. Resolve user's roles at:
   a. Organization level (tenant-wide)
   b. Workspace level (ws_a)
   c. Team level (teams within ws_a that user belongs to)
    │
    ▼
4. Union permissions from all applicable roles
5. Apply ABAC policies for resource context
6. Return ALLOW/DENY
```

#### 5.3 Permission Inheritance Rules

| Scope | Inherits From | Override |
|-------|---------------|----------|
| Organization role | — (top level) | — |
| Workspace role | Organization role (additive) | Workspace role can restrict |
| Team role | Workspace + Organization (additive) | Team role can restrict |
| Resource grant | None (explicit only) | Resource grant can extend |

**Additive model:** Higher scope permissions accumulate unless explicitly restricted at lower scope.

**Example:**
- Alice has `member` at org level → `crm:contacts:read,write`
- Alice has `viewer` at workspace Sales → only `crm:contacts:read` in Sales workspace
- Effective in Sales: `crm:contacts:read` (workspace restricts)
- Effective in Engineering: `crm:contacts:read,write` (org role applies)

#### 5.4 Organization Admin Override

Organization `owner` and `admin` roles bypass workspace/team restrictions by default. Configurable:

```json
{
  "tenant_id": "...",
  "authz_config": {
    "admin_scope_override": true,
    "admin_can_access_all_workspaces": true
  }
}
```

---

### 6. Policy Engine Architecture (OPA)

#### 6.1 Why OPA

| Requirement | OPA Capability |
|-------------|----------------|
| Decouple policy from code | Rego policies deployed independently |
| Consistent across services | Centralized policy evaluation |
| Audit trail | Decision logging with input/output |
| Testable | `opa test` for policy unit tests |
| Performance | Compiled policies; caching |

**Decision:** Open Policy Agent (OPA) as the policy engine. Cedar (AWS) evaluated but OPA has broader ecosystem adoption and Rego expressiveness for complex ABAC.

#### 6.2 OPA Deployment Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  API Service │────▶│  OPA Sidecar │     │  Policy      │
│  (TypeScript)│     │  (per pod)   │◀────│  Bundle      │
│              │     │              │     │  Server      │
│  authz.check │     │  evaluate    │     │  (Git → S3)  │
└──────────────┘     └──────────────┘     └──────────────┘
```

**Deployment options:**

| Option | Latency | Consistency | Phase |
|--------|---------|-------------|-------|
| **Sidecar** (per service pod) | <1ms | Bundle polling (10s) | 1 (default) |
| **Centralized OPA cluster** | 2–5ms | Real-time bundle push | 2 (scale) |
| **Embedded** (Wasm compiled Rego) | <0.5ms | Deployed with service | 3 (performance) |

#### 6.3 Policy Bundle Structure

```
policies/
├── rbac/
│   ├── role_permissions.rego      # Role → permission mapping
│   └── scope_resolution.rego      # Hierarchy resolution
├── abac/
│   ├── resource_ownership.rego    # Owner-based access
│   ├── field_level.rego           # Sensitive field visibility
│   ├── time_based.rego            # Business hours, expiration
│   └── ip_restrictions.rego       # IP allowlist for enterprise
├── modules/
│   ├── crm.rego
│   ├── finance.rego
│   ├── hr.rego
│   └── projects.rego
├── integrations/
│   ├── oauth_scopes.rego          # OAuth app scope validation
│   └── service_accounts.rego      # Service account permissions
├── agents/
│   └── agent_delegation.rego      # AI agent permission bounds
└── system/
    ├── tenant_isolation.rego      # Non-negotiable tenant boundary
    └── default_deny.rego          # Fail-closed default
```

#### 6.4 Authorization Check API (Internal)

```typescript
// Application service calls OPA
const decision = await authz.check({
  subject: {
    type: "user",
    id: "user_uuid",
    roles: ["member", "sales_manager"],
    team_ids: ["team_uuid"],
    attributes: { department: "sales", clearance: "standard" }
  },
  action: "finance:invoices:write",
  resource: {
    type: "invoice",
    id: "invoice_uuid",
    attributes: { status: "draft", amount_cents: 50000, owner_id: "user_uuid" }
  },
  environment: {
    tenant_id: "tenant_uuid",
    workspace_id: "workspace_uuid",
    ip: "203.0.113.1",
    time: "2026-06-30T14:00:00Z",
    mfa_verified: true
  }
});

// decision: { allowed: true, reason: "rbac:role_sales_manager", obligations: [] }
// decision: { allowed: false, reason: "abac:invoice_status_sent", obligations: [] }
```

#### 6.5 Policy Testing

```bash
# Unit test policies
opa test policies/ -v

# Test case example
test_invoice_draft_editable {
    allow with input as {
        "permission": "finance:invoices:write",
        "subject": {"roles": ["member"]},
        "resource": {"status": "draft"}
    }
}

test_invoice_sent_not_editable {
    not allow with input as {
        "permission": "finance:invoices:write",
        "subject": {"roles": ["member"]},
        "resource": {"status": "sent"}
    }
}
```

Policies tested in CI before bundle deployment.

---

### 7. Permission Inheritance and Delegation

#### 7.1 Inheritance Summary

```
Organization permissions
    │
    ├──▶ Workspace permissions (additive or restricting)
    │       │
    │       └──▶ Team permissions (additive or restricting)
    │               │
    │               └──▶ Resource grants (explicit extension)
    │
    └──▶ Admin override (if configured)
```

#### 7.2 Delegation Model

Users can delegate a subset of their permissions to others:

```json
POST /v1/delegations
{
  "delegate_to": "user_uuid",
  "permissions": ["finance:invoices:read", "finance:invoices:write"],
  "scope_type": "workspace",
  "scope_id": "workspace_uuid",
  "reason": "Covering while on vacation",
  "expires_at": "2026-07-15T00:00:00Z"
}
```

**Delegation rules:**
- Delegator must hold the permissions being delegated
- Delegated permissions cannot exceed delegator's permissions
- Delegation is time-limited (max 90 days)
- Delegation chain depth: 1 (no re-delegation)
- Audit logged with delegator, delegate, permissions, duration

#### 7.3 AI Agent Delegation

Users grant AI agents scoped permissions:

```json
POST /v1/agents/{agent_id}/delegations
{
  "permissions": [
    "crm:contacts:read",
    "crm:contacts:write",
    "finance:invoices:read"
  ],
  "constraints": {
    "max_amount_cents": 100000,
    "business_hours_only": true,
    "require_confirmation_above_cents": 50000
  },
  "expires_at": "2026-07-30T00:00:00Z"
}
```

Agent authorization check includes:
1. User's delegation grant to agent
2. Agent's constraints (amount limits, time windows)
3. Action confirmation requirements for high-impact operations

---

### 8. API Scopes for Integrations / OAuth Apps

#### 8.1 OAuth Scope Model

OAuth applications request scopes during authorization:

```
GET /oauth/authorize?
  client_id=app_uuid
  &redirect_uri=https://app.example.com/callback
  &scope=contacts:read+invoices:read+invoices:write
  &response_type=code
  &state=...
```

#### 8.2 Scope Definitions

| Scope | Permissions Granted | Tier |
|-------|-------------------|------|
| `openid` | Identity info | Standard |
| `profile` | User profile read | Standard |
| `contacts:read` | `crm:contacts:read` | Standard |
| `contacts:write` | `crm:contacts:write` | Standard |
| `invoices:read` | `finance:invoices:read` | Standard |
| `invoices:write` | `finance:invoices:write` | Standard |
| `projects:read` | `projects:projects:read`, `projects:tasks:read` | Standard |
| `projects:write` | `projects:projects:write`, `projects:tasks:write` | Standard |
| `webhooks:manage` | `platform:webhooks:manage` | Standard |
| `admin:read` | All `:read` permissions | Elevated |
| `admin:write` | All `:write` permissions | Elevated |

#### 8.3 Scope Validation

```
Token presented with scope: contacts:read
    │
    ▼
Request: POST /v1/contacts (requires contacts:write)
    │
    ▼
OPA policy: oauth_scope_check
  - Token scope contacts:read does NOT include contacts:write
  - DENY: insufficient_scope
```

#### 8.4 Scope Consent UI

When user authorizes an OAuth app:

```
┌─────────────────────────────────────────────┐
│  "ERP Connector" wants to access your Atlas  │
│                                              │
│  This app will be able to:                   │
│  ✓ Read your contacts                        │
│  ✓ Read your invoices                        │
│  ✓ Create and update invoices                │
│                                              │
│  [Authorize]  [Deny]                         │
└─────────────────────────────────────────────┘
```

Elevated scopes (`admin:*`) require organization admin approval.

#### 8.5 API Key Scopes

Service accounts and API keys use the same scope model:

```http
GET /v1/contacts
Authorization: Atlas-Key ak_live_...
X-Atlas-Scope: contacts:read    # validated against key's registered scopes
```

---

### 9. Audit Logging for Authorization Decisions

#### 9.1 What Gets Logged

Every authorization decision (allow and deny) produces an audit record:

```json
{
  "id": "audit_uuid",
  "timestamp": "2026-06-30T14:00:00.000Z",
  "tenant_id": "tenant_uuid",
  "decision": "DENY",
  "reason": "abac:invoice_status_sent",
  "principal": {
    "type": "user",
    "id": "user_uuid",
    "email": "alice@example.com"
  },
  "action": "finance:invoices:write",
  "resource": {
    "type": "invoice",
    "id": "invoice_uuid"
  },
  "context": {
    "workspace_id": "workspace_uuid",
    "ip_address": "203.0.113.1",
    "user_agent": "Mozilla/5.0...",
    "request_id": "req_uuid",
    "mfa_verified": true
  },
  "evaluation": {
    "rbac_result": "ALLOW",
    "abac_result": "DENY",
    "policy_id": "finance/invoice_status",
    "duration_ms": 2
  }
}
```

#### 9.2 Audit Storage

| Tier | Storage | Retention |
|------|---------|-----------|
| Hot | PostgreSQL `authz.audit_log` (partitioned) | 90 days |
| Warm | S3 Parquet (via event bus) | 1 year |
| Cold | Glacier | 7 years (compliance) |

#### 9.3 Audit Access

```
GET /v1/admin/audit-log?principal_id=...&action=...&from=...&to=...
GET /v1/admin/audit-log/{id}
```

- Organization admins can view their tenant's audit log
- Platform admins can view cross-tenant (with platform-level auth)
- Audit log access itself is audit logged (meta-audit)

#### 9.4 High-Risk Action Alerts

Certain deny patterns trigger real-time alerts:

| Pattern | Alert |
|---------|-------|
| 5+ denies in 1 minute for same principal | Potential attack / misconfiguration |
| Deny on `admin:*` permission | Privilege escalation attempt |
| Cross-tenant access attempt | Critical security alert |
| Agent exceeds delegation bounds | Agent misbehavior alert |

---

### 10. Permission Caching

#### 10.1 Cache Strategy

Authorization decisions are cached to avoid OPA round-trip on every request:

```
Cache key: authz:{tenant_id}:{principal_id}:{permission}:{resource_id}:{scope_id}
TTL: 60 seconds
Invalidation: on role assignment change, delegation change, policy bundle update
```

#### 10.2 Cache Layers

| Layer | TTL | Invalidation |
|-------|-----|--------------|
| L1: In-process (LRU) | 30s | Role/policy change event |
| L2: Redis | 60s | Pub/sub invalidation channel |
| OPA bundle | 10s poll | Bundle version change |

#### 10.3 Cache Invalidation Events

```
authz.role_assigned       → invalidate principal's cache
authz.role_revoked        → invalidate principal's cache
authz.delegation_created  → invalidate delegate's cache
authz.policy_updated      → invalidate all cache (tenant-scoped policies: tenant only)
authz.resource_shared     → invalidate resource permission cache
```

---

### 11. Authorization Data Model (Overview)

```
authz.roles
  ├── id, tenant_id, name, description, is_system
  └── permissions[]

authz.role_assignments
  ├── id, principal_type, principal_id, role_id
  └── scope_type, scope_id, granted_by, expires_at

authz.resource_grants
  ├── id, resource_type, resource_id, principal_type, principal_id
  └── permission, granted_by, expires_at

authz.delegations
  ├── id, delegator_id, delegate_id, permissions[]
  └── scope_type, scope_id, constraints, expires_at

authz.agent_delegations
  ├── id, user_id, agent_id, permissions[], constraints
  └── expires_at

authz.oauth_scopes
  ├── id, client_id, scopes[]
  └── approved_by, approved_at

authz.audit_log (partitioned)
  ├── id, timestamp, tenant_id, decision, reason
  └── principal, action, resource, context, evaluation
```

Full schema in Phase 3.

---

### 12. Authorization Middleware Flow

```
HTTP Request
    │
    ▼
Extract auth context (JWT → user, tenant, session)
    │
    ▼
Resolve scope (workspace_id, team_id from params/headers)
    │
    ▼
Map endpoint → required permission(s)
    │
    ▼
Check permission cache (Redis)
    │
    ├── HIT → use cached decision
    │
    └── MISS →
         │
         ▼
    Evaluate via OPA:
      1. tenant_isolation (mandatory)
      2. rbac_check
      3. abac_check
      4. default_deny
         │
         ▼
    Cache decision (60s TTL)
    │
    ▼
ALLOW → proceed to handler
DENY → 403 Forbidden (RFC 7807)
    │
    ▼
Write audit log (async, non-blocking)
```

---

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| RBAC-only | Insufficient for resource-level, field-level, and contextual access |
| ABAC-only | Too complex for small teams; poor admin UX without role abstractions |
| Cedar policy engine | Less mature ecosystem; OPA has broader community and tooling |
| Authorization in application code | Inconsistent across services; hard to audit and test |
| AWS IAM-style policies | JSON policies less readable than Rego; AWS-coupled |
| Permify/Oso (managed authz) | Vendor dependency; OPA provides equivalent with more control |
| Per-request database permission lookup | Performance bottleneck at scale; caching + OPA preferred |
| Flat permission model (no hierarchy) | Unmanageable at enterprise scale with workspaces/teams |
| No audit logging on ALLOW | Compliance requires full decision trail, not just denials |

---

## Consequences

### Positive

- **RBAC + ABAC hybrid** balances simplicity (roles) with precision (attributes)
- **OPA policy engine** decouples authorization logic from application code
- **Hierarchy model** (org → workspace → team → resource) matches real business structure
- **Agent delegation** enables safe AI automation with bounded permissions
- **Comprehensive audit logging** supports SOC 2, GDPR, and forensic investigation
- **OAuth scopes** provide standard integration authorization

### Negative

- **OPA operational complexity** — sidecar deployment, bundle management, Rego learning curve
- **Permission cache staleness** — 60s window where revoked permissions may still work
- **Policy sprawl** — many Rego files to maintain across modules
- **Evaluation latency** — OPA round-trip adds 1–5ms per uncached check
- **Role explosion** — enterprise tenants may create too many custom roles without guidance

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| OPA sidecar failure | Fail-closed (deny); fallback to embedded policies |
| Cache serves stale permissions | Short TTL (60s); pub/sub invalidation on changes |
| Policy bug grants excessive access | Policy unit tests in CI; canary deployment |
| Audit log volume at scale | Partitioned tables; async write; tiered retention |
| Delegation abuse | Time limits; no re-delegation; audit alerts |

---

## Open Questions

| # | Question | Owner | Target Date |
|---|----------|-------|-------------|
| 1 | OPA sidecar vs centralized cluster for initial deployment? | Platform Eng | Q3 2026 |
| 2 | Maximum custom roles per tenant? | Product | Q3 2026 |
| 3 | Field-level ABAC in Phase 1 or defer to Phase 2? | Product + Security | Q3 2026 |
| 4 | Cross-tenant resource sharing (partner portals)? | Product | Q4 2026 |
| 5 | Permission catalog — static registry or dynamic per module? | Platform Eng | Q3 2026 |
| 6 | Rego policy authoring UI for enterprise admins? | Product | Q4 2026 |
| 7 | Agent delegation — per-action confirmation threshold defaults? | AI + Security | Q3 2026 |
| 8 | Audit log export format for SIEM integration (CEF, LEEF)? | Security | Q4 2026 |

---

## References

- [Open Policy Agent (OPA) Documentation](https://www.openpolicyagent.org/docs/latest/)
- [Rego Language Reference](https://www.openpolicyagent.org/docs/latest/policy-language/)
- [NIST ABAC Guide (SP 800-162)](https://csrc.nist.gov/publications/detail/sp/800-162/final)
- [OAuth 2.0 Scopes (RFC 6749)](https://datatracker.ietf.org/doc/html/rfc6749#section-3.3)
- [Google Zanzibar Paper (inspiration for resource-level permissions)](https://research.google/pubs/pub48190/)
- Atlas: `05-database-architecture.md`, `06-api-architecture.md`, `07-authentication.md`, `21-security.md`