---
title: Permissions Matrix & UI Visibility Rules
document_id: ATLAS-UI-19
version: 1.0.0
status: approved
phase: 4
last_updated: 2026-06-30
module: cross-cutting
related_documents:
  - ATLAS-DB-04
  - ATLAS-ARCH-08
  - ADR-0005
  - ATLAS-UI-13
  - ATLAS-UI-14
  - ATLAS-UI-15
  - ATLAS-UI-16
  - ATLAS-UI-17
tags:
  - permissions
  - rbac
  - authorization
  - visibility
  - roles
---

# Permissions Matrix & UI Visibility Rules

## Document Control

| Field | Value |
|-------|-------|
| **Scope** | All UI screens and actions mapped to permission keys |
| **Permission format** | `{module}:{resource}:{action}` |
| **Evaluation** | OPA policy engine + client-side permission cache |
| **Default** | DENY |

---

## 1. Purpose & Scope

Define the complete mapping between UI surfaces, user actions, and permission keys. Specify role templates and the three UI visibility modes: **hide**, **disable**, and **redirect**. Client-side checks are optimistic UX only — server enforces authoritative authorization.

### Visibility Modes

| Mode | When to use | User experience |
|------|-------------|-----------------|
| **Hide** | User should not know feature exists | Element not in DOM; nav item absent |
| **Disable** | User knows feature exists but lacks access | Visible but grayed; tooltip explains |
| **Redirect** | User navigated directly to unauthorized URL | 403 page with helpful next steps |

### Decision Tree

```
Has permission?
├── YES → Render enabled
├── NO + nav/primary feature → Hide
├── NO + contextual action (bulk, secondary) → Disable + tooltip
└── NO + direct URL access → Redirect to 403
```

---

## 2. Role Templates

### 2.1 System Roles

| Role | Slug | Priority | Description |
|------|------|----------|-------------|
| Owner | `owner` | 100 | Full org control including billing |
| Admin | `admin` | 80 | Full except billing (configurable) |
| Member | `member` | 50 | Default module read/write |
| Viewer | `viewer` | 10 | Read-only all modules |
| Guest | `guest` | 5 | Scoped external collaborator |
| Billing Admin | `billing_admin` | 60 | Billing only |

### 2.2 Owner

| Attribute | Value |
|-----------|-------|
| Permissions | ALL (wildcard `*:*:*)` |
| Billing | Full |
| Role management | Full |
| Cannot | Remove self if sole owner |
| UI | All nav items visible |

### 2.3 Admin

| Attribute | Value |
|-----------|-------|
| Permissions | All except `admin:billing:manage` (default) |
| Billing | Read-only or hidden (org setting) |
| Role management | Full |
| Marketplace | Install + manage |
| UI | Billing nav hidden or read-only per config |

### 2.4 Member

| Attribute | Value |
|-----------|-------|
| Permissions | `:read`, `:write` on `crm`, `projects`, `finance`, `support`, `documents`, `messaging` |
| Admin | No access to admin settings, roles, templates |
| Analytics | Read dashboards; no create |
| Billing | Hidden |
| Marketplace | Browse + request install (admin approves — optional org setting) |

### 2.5 Viewer

| Attribute | Value |
|-----------|-------|
| Permissions | All `:read` actions |
| Write actions | Disabled with tooltip |
| Delete/export | Hidden |
| Settings | Profile only |

### 2.6 Custom Roles

Enterprise tenants create roles with arbitrary permission subsets.

| Constraint | Value |
|------------|-------|
| Max custom roles | 100 per org |
| Scope | Organization, workspace, or team |
| UI | Appear in role picker; no special UI treatment |
| Inheritance | Union permissions from all assignments; most restrictive scope wins |

---

## 3. Permission Key Catalog

### 3.1 Platform & Admin

| Key | Description |
|-----|-------------|
| `platform:settings:read` | View org settings |
| `platform:settings:manage` | Edit org settings |
| `platform:workspaces:read` | View workspaces |
| `platform:workspaces:manage` | Create/edit workspaces |
| `admin:members:read` | View member list |
| `admin:members:invite` | Invite members |
| `admin:members:remove` | Remove members |
| `admin:roles:read` | View roles |
| `admin:roles:manage` | Create/edit/assign roles |
| `admin:billing:read` | View billing |
| `admin:billing:manage` | Manage subscription/payment |
| `admin:audit:read` | View audit log |
| `admin:notifications:manage` | Manage notification templates |
| `admin:storage:manage` | Manage storage quotas |
| `admin:integrations:manage` | Manage org integrations |

### 3.2 CRM

| Key | Description |
|-----|-------------|
| `crm:contacts:read` | View contacts |
| `crm:contacts:write` | Create/edit contacts |
| `crm:contacts:delete` | Delete contacts |
| `crm:contacts:export` | Export contacts |
| `crm:deals:read` | View deals |
| `crm:deals:write` | Create/edit deals |
| `crm:deals:delete` | Delete deals |
| `crm:deals:assign` | Assign deal owner |
| `crm:leads:read` | View leads |
| `crm:leads:write` | Create/edit leads |
| `crm:leads:convert` | Convert lead to contact |
| `crm:companies:read` | View companies |
| `crm:companies:write` | Create/edit companies |
| `crm:pipelines:manage` | Configure pipelines |

### 3.3 Finance

| Key | Description |
|-----|-------------|
| `finance:invoices:read` | View invoices |
| `finance:invoices:write` | Create/edit invoices |
| `finance:invoices:send` | Send invoices |
| `finance:invoices:void` | Void invoices |
| `finance:invoices:approve` | Approve invoices |
| `finance:expenses:read` | View expenses |
| `finance:expenses:write` | Create/edit expenses |
| `finance:payments:read` | View payments |
| `finance:payments:record` | Record payments |
| `finance:reports:read` | View financial reports |
| `finance:gl:manage` | Manage chart of accounts |

### 3.4 Projects

| Key | Description |
|-----|-------------|
| `projects:projects:read` | View projects |
| `projects:projects:write` | Create/edit projects |
| `projects:projects:delete` | Delete projects |
| `projects:tasks:read` | View tasks |
| `projects:tasks:write` | Create/edit tasks |
| `projects:tasks:assign` | Assign tasks |
| `projects:boards:manage` | Configure boards |

### 3.5 Support

| Key | Description |
|-----|-------------|
| `support:cases:read` | View cases |
| `support:cases:write` | Create/edit cases |
| `support:cases:assign` | Assign cases |
| `support:cases:close` | Close cases |
| `support:kb:read` | View knowledge base |
| `support:kb:write` | Edit KB articles |

### 3.6 HR

| Key | Description |
|-----|-------------|
| `hr:employees:read` | View employee directory |
| `hr:employees:write` | Edit employee records |
| `hr:timeoff:read` | View time off |
| `hr:timeoff:approve` | Approve time off |
| `hr:payroll:read` | View payroll (restricted) |

### 3.7 Documents & Storage

| Key | Description |
|-----|-------------|
| `storage:files:read` | View/download files |
| `storage:files:write` | Upload/edit files |
| `storage:files:delete` | Delete files |
| `storage:files:share` | Share files |
| `storage:folders:write` | Create/rename folders |

### 3.8 Analytics

| Key | Description |
|-----|-------------|
| `analytics:dashboards:read` | View dashboards |
| `analytics:dashboards:write` | Edit dashboards |
| `analytics:dashboards:share` | Share dashboards |
| `analytics:reports:read` | View reports |
| `analytics:reports:write` | Build reports |
| `analytics:metrics:read` | Explore metrics |
| `analytics:exports:manage` | Schedule exports |
| `analytics:embed:read` | View embedded widgets |

### 3.9 Marketplace

| Key | Description |
|-----|-------------|
| `marketplace:apps:browse` | Browse app catalog |
| `marketplace:apps:create` | Submit apps (developer) |
| `marketplace:installations:read` | View installed apps |
| `marketplace:installations:create` | Install apps |
| `marketplace:installations:manage` | Configure/uninstall apps |
| `marketplace:developer:access` | Access developer portal |
| `marketplace:versions:manage` | Manage app versions |
| `marketplace:analytics:read` | Developer analytics |
| `marketplace:reviews:create` | Write app reviews |

### 3.10 AI

| Key | Description |
|-----|-------------|
| `ai:agents:read` | View agents |
| `ai:agents:execute` | Run AI agents |
| `ai:agents:configure` | Configure agents |
| `ai:memory:read` | View AI memory |
| `ai:memory:manage` | Manage AI memory |

### 3.11 Automation

| Key | Description |
|-----|-------------|
| `automation:workflows:read` | View workflows |
| `automation:workflows:write` | Create/edit workflows |
| `automation:workflows:execute` | Manual trigger |

---

## 4. Screen-to-Permission Matrix

### 4.1 Marketplace (ATLAS-UI-13)

| Screen/Action | Permission | Visibility |
|---------------|------------|------------|
| Nav: Marketplace | `marketplace:apps:browse` | Hide |
| MP-S01 Catalog | `marketplace:apps:browse` | Redirect |
| MP-S02 App Detail | `marketplace:apps:browse` | Redirect |
| Install CTA | `marketplace:installations:create` | Disable |
| MP-S03 Install Flow | `marketplace:installations:create` | Redirect |
| MP-S04 Installed Apps | `marketplace:installations:read` | Hide nav |
| MP-S05 App Settings | `marketplace:installations:manage` | Redirect |
| Uninstall action | `marketplace:installations:manage` | Disable |
| Developer Portal nav | `marketplace:developer:access` | Hide |
| MP-S07 Submit App | `marketplace:apps:create` | Redirect |
| MP-S08 Versions | `marketplace:versions:manage` | Redirect |
| MP-S09 Dev Analytics | `marketplace:analytics:read` | Redirect |
| Write review | `marketplace:reviews:create` | Hide CTA |

### 4.2 Billing (ATLAS-UI-14)

| Screen/Action | Permission | Visibility |
|---------------|------------|------------|
| Nav: Settings → Billing | `admin:billing:read` | Hide |
| BL-S01 Plan Selection | `admin:billing:read` | Redirect |
| BL-S02 Checkout | `admin:billing:manage` | Redirect |
| BL-S03 Subscription | `admin:billing:read` | Redirect |
| Change plan | `admin:billing:manage` | Disable |
| BL-S04 Usage | `admin:billing:read` | Redirect |
| BL-S05 Invoices | `admin:billing:read` | Redirect |
| Download invoice | `admin:billing:read` | Disable |
| BL-S07 Payment Methods | `admin:billing:manage` | Redirect |
| Add payment method | `admin:billing:manage` | Disable |
| Cancel subscription | `admin:billing:manage` | Disable |
| BL-S09 Dunning | `admin:billing:manage` | Redirect |
| BL-S10 Billing Settings | `admin:billing:manage` | Redirect |

### 4.3 Notifications (ATLAS-UI-15)

| Screen/Action | Permission | Visibility |
|---------------|------------|------------|
| Notification bell | Authenticated | Hide if logged out |
| NT-S01 Inbox | Authenticated | Redirect |
| NT-S03 Preferences | Authenticated | — |
| NT-S05 Templates | `admin:notifications:manage` | Hide nav |
| NT-S06 Template Editor | `admin:notifications:manage` | Redirect |
| Org quiet hours | `admin:notifications:manage` | Disable |
| Test send template | `admin:notifications:manage` | Disable |

### 4.4 Documents (ATLAS-UI-16)

| Screen/Action | Permission | Visibility |
|---------------|------------|------------|
| Nav: Documents | `storage:files:read` | Hide |
| DC-S01 Browser | `storage:files:read` | Redirect |
| Upload | `storage:files:write` | Hide button |
| New folder | `storage:folders:write` | Hide |
| Share | `storage:files:share` | Disable |
| Delete | `storage:files:delete` | Disable |
| DC-S02 Preview | `storage:files:read` | Redirect |
| Download | `storage:files:read` | Disable |
| Restore version | `storage:files:write` | Disable |
| DC-S05 Trash | `storage:files:read` | Redirect |
| Permanent delete | `storage:files:delete` | Disable |
| Quota admin | `admin:storage:manage` | Hide settings |

### 4.5 Analytics (ATLAS-UI-17)

| Screen/Action | Permission | Visibility |
|---------------|------------|------------|
| Nav: Analytics | `analytics:dashboards:read` | Hide |
| AN-S01 Dashboard | `analytics:dashboards:read` | Redirect |
| Edit dashboard | `analytics:dashboards:write` | Hide Edit button |
| Share dashboard | `analytics:dashboards:share` | Disable |
| AN-S02 Report Builder | `analytics:reports:write` | Redirect |
| Run report | `analytics:reports:read` | Disable |
| AN-S03 Metrics | `analytics:metrics:read` | Redirect |
| AN-S05 Exports | `analytics:exports:manage` | Hide nav |
| Embedded widgets | `analytics:embed:read` | Hide slot |

### 4.6 CRM (Representative — Phase 4 batch 01–05 pending)

| Screen/Action | Permission | Visibility |
|---------------|------------|------------|
| Nav: CRM | `crm:contacts:read` OR `crm:deals:read` | Hide |
| Contact list | `crm:contacts:read` | Redirect |
| Create contact | `crm:contacts:write` | Hide FAB |
| Edit contact | `crm:contacts:write` | Disable |
| Delete contact | `crm:contacts:delete` | Disable |
| Export contacts | `crm:contacts:export` | Hide |
| Deal pipeline | `crm:deals:read` | Redirect |
| Create deal | `crm:deals:write` | Hide FAB |
| Assign deal | `crm:deals:assign` | Disable owner picker |
| Pipeline settings | `crm:pipelines:manage` | Hide |

### 4.7 Finance (Representative)

| Screen/Action | Permission | Visibility |
|---------------|------------|------------|
| Nav: Finance | `finance:invoices:read` | Hide |
| Invoice list | `finance:invoices:read` | Redirect |
| Create invoice | `finance:invoices:write` | Hide |
| Send invoice | `finance:invoices:send` | Disable |
| Void invoice | `finance:invoices:void` | Disable |
| Approve invoice | `finance:invoices:approve` | Disable |
| Financial reports | `finance:reports:read` | Redirect |
| GL settings | `finance:gl:manage` | Hide |

### 4.8 Admin Settings (Representative)

| Screen/Action | Permission | Visibility |
|---------------|------------|------------|
| Settings → Members | `admin:members:read` | Hide |
| Invite member | `admin:members:invite` | Disable |
| Remove member | `admin:members:remove` | Disable |
| Settings → Roles | `admin:roles:read` | Hide |
| Edit roles | `admin:roles:manage` | Redirect |
| Settings → Audit | `admin:audit:read` | Hide |
| Org settings | `platform:settings:manage` | Redirect |

### 4.9 AI (Representative)

| Screen/Action | Permission | Visibility |
|---------------|------------|------------|
| AI assistant panel | `ai:agents:execute` | Hide FAB |
| Run agent action | `ai:agents:execute` | Disable |
| Configure agents | `ai:agents:configure` | Hide |
| AI memory dashboard | `ai:memory:read` | Redirect |

---

## 5. Action-Level Matrix (Common UI Actions)

| UI Action | Typical permission suffix | Hide | Disable | Redirect |
|-----------|---------------------------|------|---------|----------|
| Nav item | `:read` | ✓ | — | — |
| List page | `:read` | — | — | ✓ |
| Create button / FAB | `:write` | ✓ | — | — |
| Edit form save | `:write` | — | — | ✓ |
| Inline edit | `:write` | — | ✓ | — |
| Delete | `:delete` | — | ✓ | — |
| Bulk delete | `:delete` | ✓ | — | — |
| Export | `:export` | ✓ | — | — |
| Share | `:share` | — | ✓ | — |
| Approve | `:approve` | — | ✓ | — |
| Settings / Configure | `:manage` | ✓ | — | ✓ |
| Admin section | `admin:*` | ✓ | — | ✓ |

---

## 6. Resource-Level (ReBAC) UI Rules

Some permissions are evaluated against specific resources, not just module-level.

| Pattern | UI behavior |
|---------|-------------|
| Record owner | Edit/delete enabled if owner OR has module write |
| Team-scoped | List filtered server-side; no "access denied" per row |
| Shared read-only | Edit disabled; "View only" badge in header |
| Resource grant | Overrides role default; UI reads `effective_permissions` on entity |
| Expired grant | Treat as no access; redirect on direct URL |

### Entity Permission Badge

When user has read but not write:

```
┌─────────────────────────────────────────┐
│ Contact: Acme Corp          [View only] │
└─────────────────────────────────────────┘
```

---

## 7. Plan/Tier Gating (Feature Flags)

Some UI is gated by subscription plan in addition to permissions.

| Feature | Minimum tier | UI when unavailable |
|---------|--------------|---------------------|
| Marketplace | Growth | Hide nav; upgrade CTA on direct URL |
| Analytics custom dashboards | Growth | Template-only on Starter |
| SSO settings | Business | Disabled + upgrade tooltip |
| Developer portal | Growth | Hidden |
| Advanced audit | Business | Read-only 7-day on Starter |
| API keys | Growth | Hide |

**Combined check:** `hasPermission AND hasPlanFeature` — both must pass.

---

## 8. Client-Side Implementation

### 8.1 Permission Hook

```typescript
// Conceptual — Phase 6 implementation
function usePermission(key: string, resourceId?: string): {
  allowed: boolean;
  mode: 'enabled' | 'disabled' | 'hidden';
  reason?: string;
}
```

### 8.2 Permission Cache

| Property | Value |
|----------|-------|
| Source | `GET /v1/me/permissions` on login + SSE refresh |
| TTL | 5 min client cache; invalidated on role change event |
| Scope | Current org + workspace context |
| Bundle size | Bitfield or Set for ≤500 permissions |

### 8.3 `<PermissionGate>` Component

```tsx
<PermissionGate
  permission="crm:contacts:write"
  mode="hide"           // hide | disable | redirect
  fallback={<UpgradeCTA />}
>
  <CreateContactButton />
</PermissionGate>
```

### 8.4 Tooltip for Disabled Actions

Standard message: "You don't have permission to {action}. Contact your administrator."

Include link to request access workflow (enterprise): "Request access" → prefilled form.

---

## 9. Role-to-Permission Summary Matrix

| Permission | Owner | Admin | Member | Viewer | Billing Admin |
|------------|:-----:|:-----:|:------:|:------:|:-------------:|
| `platform:settings:manage` | ✓ | ✓ | — | — | — |
| `admin:members:invite` | ✓ | ✓ | — | — | — |
| `admin:roles:manage` | ✓ | ✓ | — | — | — |
| `admin:billing:manage` | ✓ | — | — | — | ✓ |
| `admin:billing:read` | ✓ | ✓* | — | — | ✓ |
| `crm:contacts:write` | ✓ | ✓ | ✓ | — | — |
| `crm:contacts:read` | ✓ | ✓ | ✓ | ✓ | — |
| `finance:invoices:approve` | ✓ | ✓ | — | — | — |
| `analytics:dashboards:write` | ✓ | ✓ | — | — | — |
| `marketplace:installations:create` | ✓ | ✓ | —** | — | — |
| `ai:agents:execute` | ✓ | ✓ | ✓ | — | — |

\* Admin billing read: org-configurable  
\** Member install: org-configurable via `platform.settings.marketplace_member_install`

---

## 10. Audit & Compliance UI

| Event | Logged | Shown in UI |
|-------|--------|-------------|
| Permission denied (API) | Yes | Toast or 403 page |
| Role assignment change | Yes | Admin audit log |
| Permission grant (marketplace) | Yes | Installation activity tab |
| Elevation request | Yes | Admin approval queue (enterprise) |

---

## 11. Open Questions

| ID | Question | Owner |
|----|----------|-------|
| OQ-UI-19-01 | Permission simulator in admin UI? | v1.1 |
| OQ-UI-19-02 | "Request access" self-service workflow? | Enterprise |
| OQ-UI-19-03 | Field-level permission UI indicators? | CRM v1.1 |