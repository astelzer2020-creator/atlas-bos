---
title: CRM UI Specification
document_id: ATLAS-UI-04
version: 1.0.0
status: draft
phase: 4
last_updated: 2026-06-30
module: crm
bounded_context: customer
related_documents:
  - ATLAS-DB-05
  - ATLAS-ARCH-08
  - 05-erp.md
  - 06-finance.md
tags:
  - ui
  - crm
  - wireframes
  - permissions
  - responsive
---

# CRM UI Specification

## Purpose

Exhaustive UI specification for the **Customer** (CRM) module: every screen, modal, workflow, permission gate, responsive variant, and state. Implementation must not begin until this document is approved.

## Scope

| In Scope | Out of Scope |
|----------|--------------|
| Dashboard, contacts, accounts, leads, deals, activities, pipeline settings | Marketing automation UI (`10-marketing`) |
| All CRM modals and bulk workflows | Platform auth/onboarding UI |
| Desktop, tablet, mobile layouts | Pixel-perfect design tokens (design system doc) |

---

## Global Conventions

### Route Pattern

```
/app/:orgSlug/:workspaceSlug/crm/{resource}/:id?/{action}?
```

| Segment | Description |
|---------|-------------|
| `orgSlug` | Organization identifier (URL-safe) |
| `workspaceSlug` | Workspace scope for RBAC/ABAC |
| `resource` | Module resource (`contacts`, `accounts`, `leads`, `deals`, etc.) |

### Screen ID Format

`UI-CRM-{NNN}` for pages; `UI-CRM-M{NNN}` for modals/drawers.

### Responsive Breakpoints

| Token | Range | Layout Behavior |
|-------|-------|-----------------|
| `mobile` | `< 768px` | Single column; bottom nav; full-screen modals |
| `tablet` | `768px – 1279px` | Collapsible sidebar; 2-column detail; condensed kanban |
| `desktop` | `≥ 1280px` | Persistent sidebar; multi-column dashboards; full kanban |

### Permission Evaluation (UI)

1. Button/action hidden when `permission` absent (default).
2. Button disabled + tooltip when ABAC denies (e.g., not record owner).
3. Destructive actions require confirmation dialog + `*:delete` permission.
4. Permission keys use `{module}:{resource}:{action}` per `ATLAS-ARCH-08`.

### Shared Components (Design System)

| Component | Usage in CRM |
|-----------|--------------|
| `AppShell` | Global nav, org switcher, command palette |
| `ModuleSidebar` | CRM section nav |
| `DataTable` | Lists with sort, filter, pagination, bulk select |
| `EntityHeader` | Detail page title, status badge, primary actions |
| `Timeline` | Activities, deal history |
| `KanbanBoard` | Deal pipeline |
| `FilterBar` | Saved views, quick filters |
| `EmptyState` | Zero-data with CTA |
| `PermissionGate` | Wraps actions by permission key |
| `AuditTrailPanel` | Created/updated metadata |

### Standard States (All Screens)

| State | UI Treatment |
|-------|--------------|
| **Loading** | Skeleton placeholders; no layout shift |
| **Empty** | Illustration + primary CTA + secondary help link |
| **Error** | Inline alert with retry; preserve filters |
| **Forbidden** | Full-page 403 with "Request access" link |
| **Offline** | Banner + read-only cached data where supported |
| **Stale** | Subtle "Data may be outdated" with refresh |

---

## Navigation Structure

```
CRM
├── Dashboard                    → /crm
├── Contacts
│   ├── List                     → /crm/contacts
│   ├── Detail                   → /crm/contacts/:id
│   ├── Create                   → /crm/contacts/new
│   └── Edit                     → /crm/contacts/:id/edit
├── Accounts
│   ├── List                     → /crm/accounts
│   ├── Detail                   → /crm/accounts/:id
│   └── Hierarchy                → /crm/accounts/hierarchy
├── Leads
│   ├── List                     → /crm/leads
│   ├── Detail                   → /crm/leads/:id
│   └── Convert                  → /crm/leads/:id/convert
├── Deals
│   ├── Pipeline (Kanban)        → /crm/deals
│   ├── List                       → /crm/deals/list
│   └── Detail                     → /crm/deals/:id
├── Activities                   → /crm/activities
└── Settings
    └── Pipeline                   → /crm/settings/pipeline
```

---

## Screen Inventory

| Screen ID | Name | Route | Primary Permission |
|-----------|------|-------|-------------------|
| UI-CRM-001 | CRM Dashboard | `/crm` | `crm:dashboard:read` |
| UI-CRM-002 | Contacts List | `/crm/contacts` | `crm:contacts:read` |
| UI-CRM-003 | Contact Detail | `/crm/contacts/:id` | `crm:contacts:read` |
| UI-CRM-004 | Contact Create | `/crm/contacts/new` | `crm:contacts:write` |
| UI-CRM-005 | Contact Edit | `/crm/contacts/:id/edit` | `crm:contacts:write` |
| UI-CRM-006 | Accounts List | `/crm/accounts` | `crm:accounts:read` |
| UI-CRM-007 | Account Detail | `/crm/accounts/:id` | `crm:accounts:read` |
| UI-CRM-008 | Account Hierarchy | `/crm/accounts/hierarchy` | `crm:accounts:read` |
| UI-CRM-009 | Leads List | `/crm/leads` | `crm:leads:read` |
| UI-CRM-010 | Lead Detail | `/crm/leads/:id` | `crm:leads:read` |
| UI-CRM-011 | Lead Convert | `/crm/leads/:id/convert` | `crm:leads:convert` |
| UI-CRM-012 | Deals Pipeline | `/crm/deals` | `crm:deals:read` |
| UI-CRM-013 | Deals List | `/crm/deals/list` | `crm:deals:read` |
| UI-CRM-014 | Deal Detail | `/crm/deals/:id` | `crm:deals:read` |
| UI-CRM-015 | Activities Timeline | `/crm/activities` | `crm:activities:read` |
| UI-CRM-016 | Pipeline Settings | `/crm/settings/pipeline` | `crm:pipeline:manage` |

### Modal Inventory

| Modal ID | Name | Triggered From | Permission |
|----------|------|----------------|------------|
| UI-CRM-M001 | Create Contact | Global +, Contacts list | `crm:contacts:write` |
| UI-CRM-M002 | Merge Contacts | Contacts list (bulk) | `crm:contacts:merge` |
| UI-CRM-M003 | Convert Lead | Lead detail, Leads list | `crm:leads:convert` |
| UI-CRM-M004 | Move Deal Stage | Kanban drag, Deal detail | `crm:deals:write` |
| UI-CRM-M005 | Log Activity | Any entity detail, Activities | `crm:activities:write` |
| UI-CRM-M006 | Bulk Import | Contacts/Leads/Accounts list | `crm:imports:write` |
| UI-CRM-M007 | Export | Any list view | `crm:exports:read` |

---

## Screen Specifications

---

### UI-CRM-001 — CRM Dashboard

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/crm` |
| **Layout** | `AppShell` → `ModuleSidebar` → `DashboardGrid` |
| **Data Sources** | `GET /v1/crm/dashboard` (aggregated KPIs, pipeline snapshot, recent activity) |

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [≡] Atlas    [Org ▼] [Workspace ▼]              [🔍] [+ New] [🔔] [Avatar] │
├────────┬─────────────────────────────────────────────────────────────────────┤
│ CRM    │ CRM Dashboard                                    [Date Range ▼]     │
│ ─────  │                                                                     │
│ Dash ● │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│ Contac │ │ Open     │ │ Won MTD  │ │ Pipeline │ │ Lead     │                │
│ Accoun │ │ Deals    │ │ Revenue  │ │ Value    │ │ Conv %   │                │
│ Leads  │ │   42     │ │ $128K    │ │ $1.2M    │ │  18.4%   │                │
│ Deals  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘                │
│ Activi │                                                                     │
│ Settin │ ┌─────────────────────────────┐ ┌─────────────────────────────┐    │
│        │ │ Pipeline Funnel (bar)       │ │ My Tasks / Activities       │    │
│        │ │ Qualification ████████      │ │ ○ Call Acme — today 2pm     │    │
│        │ │ Proposal      ██████        │ │ ○ Email Beta Corp           │    │
│        │ │ Negotiation   ████          │ │ ○ Follow-up Gamma Ltd       │    │
│        │ └─────────────────────────────┘ └─────────────────────────────┘    │
│        │ ┌─────────────────────────────┐ ┌─────────────────────────────┐    │
│        │ │ Deals Closing This Month    │ │ Recent Leads                │    │
│        │ │ [mini table 5 rows]         │ │ [mini table 5 rows]         │    │
│        │ └─────────────────────────────┘ └─────────────────────────────┘    │
└────────┴─────────────────────────────────────────────────────────────────────┘
```

#### Components

| Component | Props / Behavior |
|-----------|------------------|
| `KpiCard` ×4 | Metric, delta %, sparkline, drill-down link |
| `PipelineFunnelChart` | Stages from default pipeline; click → Deals Pipeline filtered |
| `ActivityFeed` | Last 10 activities; infinite scroll on detail link |
| `DealsClosingTable` | Sortable; row click → Deal Detail |
| `LeadsTable` | Status badges; row click → Lead Detail |
| `DateRangePicker` | Presets: 7d, 30d, MTD, QTD, YTD, custom |
| `DashboardFilter` | Owner: me / team / all (requires `crm:deals:read_all`) |

#### Actions & Permissions

| Action | Label | Type | Permission | Notes |
|--------|-------|------|------------|-------|
| View dashboard | — | Page access | `crm:dashboard:read` | Fallback: any `crm:*:read` |
| Change date range | Date Range | Control | `crm:dashboard:read` | — |
| View all owners' data | All owners | Filter | `crm:deals:read_all` | ABAC: manager role |
| Create contact | + New → Contact | Menu | `crm:contacts:write` | Opens M001 |
| Create deal | + New → Deal | Menu | `crm:deals:write` | Navigate to create flow |
| Create lead | + New → Lead | Menu | `crm:leads:write` | Navigate to lead create |
| Log activity | + New → Activity | Menu | `crm:activities:write` | Opens M005 |
| Drill into pipeline | Funnel segment | Link | `crm:deals:read` | — |

#### States

| State | Behavior |
|-------|----------|
| **Empty (new tenant)** | Onboarding cards: "Import contacts", "Configure pipeline", "Add first deal" |
| **Partial permissions** | Hide widgets user cannot access; no 403 for whole page |
| **Loading** | 4 KPI skeletons + 2 chart skeletons |

#### Responsive Variants

| Breakpoint | Layout |
|------------|--------|
| **Desktop** | 4-column KPI row; 2×2 widget grid |
| **Tablet** | 2×2 KPI; stacked widgets full width |
| **Mobile** | Single column KPI carousel (swipe); widgets stacked; bottom nav replaces sidebar |

---

### UI-CRM-002 — Contacts List

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/crm/contacts` |
| **Layout** | `AppShell` → `ModuleSidebar` → `ListPage` |

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Contacts (1,247)                    [Import] [Export] [+ New Contact]        │
├──────────────────────────────────────────────────────────────────────────────┤
│ [🔍 Search contacts...]  [Owner ▼] [Tags ▼] [Account ▼] [Status ▼] [Saved ▼]│
├──────────────────────────────────────────────────────────────────────────────┤
│ ☐ │ Name ▲        │ Email           │ Account      │ Owner    │ Tags │ ⋮   │
│───┼───────────────┼─────────────────┼──────────────┼──────────┼──────┼─────│
│ ☐ │ Jane Smith    │ jane@acme.com   │ Acme Corp    │ You      │ VIP  │ ⋮   │
│ ☐ │ John Doe      │ john@beta.io    │ Beta Inc     │ Alex     │      │ ⋮   │
│ ☐ │ ...           │                 │              │          │      │     │
├──────────────────────────────────────────────────────────────────────────────┤
│ Bulk: [Merge] [Tag] [Assign] [Delete]              Page 1 of 63  [< 1 2 3 >] │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Components

| Component | Behavior |
|-----------|----------|
| `DataTable` | Virtualized; 50 rows/page; column customization persisted |
| `FilterBar` | Full-text search (OpenSearch); facet filters |
| `SavedViewsDropdown` | User + shared views |
| `BulkActionBar` | Appears when ≥1 row selected |
| `RowActionsMenu` | View, Edit, Log activity, Delete |

#### Actions & Permissions

| Action | Label | Permission |
|--------|-------|------------|
| View list | — | `crm:contacts:read` |
| Search/filter | Filters | `crm:contacts:read` |
| Create contact | + New Contact | `crm:contacts:write` → M001 or navigate to 004 |
| Import | Import | `crm:imports:write` → M006 |
| Export | Export | `crm:exports:read` → M007 |
| View detail | Row click | `crm:contacts:read` |
| Edit | Row ⋮ → Edit | `crm:contacts:write` |
| Delete | Row ⋮ → Delete | `crm:contacts:delete` |
| Bulk merge | Merge | `crm:contacts:merge` → M002 |
| Bulk tag | Tag | `crm:contacts:write` |
| Bulk assign owner | Assign | `crm:contacts:assign` |
| Bulk delete | Delete | `crm:contacts:delete` |

#### States

| State | UI |
|-------|-----|
| **Empty** | "No contacts yet" + Import + Create CTA |
| **No results** | Clear filters CTA |
| **Bulk selection** | Sticky bulk bar; max 100 for merge |

#### Responsive Variants

| Breakpoint | Layout |
|------------|--------|
| **Desktop** | Full table; all columns |
| **Tablet** | Hide Tags, Account; expandable rows |
| **Mobile** | Card list; swipe actions (call, email, edit); FAB for create; filters in bottom sheet |

---

### UI-CRM-003 — Contact Detail

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/crm/contacts/:contactId` |
| **Layout** | `EntityDetail` — header + 2-column body |

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Contacts    Jane Smith  [Active]              [Edit] [Log Activity] [⋮]    │
├──────────────────────────────┬───────────────────────────────────────────────┤
│ OVERVIEW                     │ ACTIVITY TIMELINE                             │
│ Email: jane@acme.com         │ Today                                         │
│ Phone: +1 555-0100           │   ● Email sent — Proposal follow-up           │
│ Title: VP Sales              │ Yesterday                                     │
│ Account: [Acme Corp →]       │   ● Call logged — 30 min discovery            │
│ Owner: You                   │   ● Deal updated — Stage → Proposal           │
│ Tags: [VIP] [+ Add]          │                                               │
│                              │ [All] [Calls] [Emails] [Meetings] [Notes]     │
│ DEALS (2)                    │                                               │
│ ┌─────────────────────────┐  │ RELATED                                       │
│ │ Enterprise License $50K │  │ Deals (2) · Accounts (1) · Documents (0)    │
│ └─────────────────────────┘  │                                               │
│ CUSTOM FIELDS                │                                               │
│ LinkedIn: /in/janesmith      │                                               │
└──────────────────────────────┴───────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission | ABAC |
|--------|------------|------|
| View | `crm:contacts:read` | Owner/team visibility |
| Edit | `crm:contacts:write` | — |
| Delete | `crm:contacts:delete` | Confirm dialog |
| Log activity | `crm:activities:write` | M005 |
| Assign owner | `crm:contacts:assign` | — |
| Add tag | `crm:contacts:write` | — |
| Link account | `crm:contacts:write` | — |
| Create deal | `crm:deals:write` | Pre-fill contact |
| Send email | `crm:activities:write` | Integration required |
| View compensation | — | N/A in CRM |

#### States

- **Not found**: 404 with back to list
- **Deleted (soft)**: Banner "Contact archived" + Restore (`crm:contacts:write`)

#### Responsive Variants

| Breakpoint | Layout |
|------------|--------|
| **Desktop** | 40/60 split overview / timeline |
| **Tablet** | Tabbed: Overview \| Activity \| Related |
| **Mobile** | Stacked; sticky action bar (Call, Email, Activity); timeline as primary tab |

---

### UI-CRM-004 — Contact Create

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/crm/contacts/new` |
| **Layout** | `FormPage` — centered card max 720px |

#### Wireframe

```
┌─────────────────────────────────────────────────────────┐
│ ← Back to Contacts                                      │
│ Create Contact                                          │
├─────────────────────────────────────────────────────────┤
│ First Name *        [________________]                  │
│ Last Name *         [________________]                  │
│ Email               [________________]                  │
│ Phone               [________________]                  │
│ Account             [Search account...        ▼]        │
│ Owner               [You                          ▼]    │
│ Tags                [Select tags...               ▼]    │
│ ── Custom Fields ──                                     │
│ [dynamic fields]                                        │
├─────────────────────────────────────────────────────────┤
│                          [Cancel]  [Save & Add Another] [Save] │
└─────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| Access form | `crm:contacts:write` |
| Save | `crm:contacts:write` |
| Save & Add Another | `crm:contacts:write` |
| Assign other owner | `crm:contacts:assign` |

#### Validation

- At least one of: email, phone, or display name (DB invariant)
- Email unique per org → inline error
- Unsaved changes → `beforeunload` + navigation guard

#### Responsive

- **Mobile**: Full-screen form; sticky footer Save/Cancel

---

### UI-CRM-005 — Contact Edit

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/crm/contacts/:contactId/edit` |
| **Layout** | Same as 004; pre-populated |

#### Additional Actions

| Action | Permission |
|--------|------------|
| Save | `crm:contacts:write` |
| Cancel | — |
| View audit history | `crm:contacts:read` + `platform:audit:read` |

Optimistic locking: show conflict modal if `version` mismatch on save.

---

### UI-CRM-006 — Accounts List

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/crm/accounts` |

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Accounts (384)              [Hierarchy View] [Import] [Export] [+ Account] │
├──────────────────────────────────────────────────────────────────────────────┤
│ [🔍 Search...] [Type ▼] [Industry ▼] [Owner ▼] [Status ▼]                    │
├──────────────────────────────────────────────────────────────────────────────┤
│ Name ▲          │ Type     │ Industry   │ Revenue    │ Contacts │ Owner │ ⋮ │
│ Acme Corp       │ Customer │ Technology │ $12M       │ 24       │ You   │ ⋮ │
│ Beta Holdings   │ Prospect │ Finance    │ —          │ 3        │ Alex  │ ⋮ │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View list | `crm:accounts:read` |
| Create account | `crm:accounts:write` |
| View hierarchy | `crm:accounts:read` → 008 |
| Import/Export | `crm:imports:write` / `crm:exports:read` |
| Delete | `crm:accounts:delete` |

#### Responsive

- **Mobile**: Card view with type badge; hierarchy link in header menu

---

### UI-CRM-007 — Account Detail

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/crm/accounts/:accountId` |

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Accounts   Acme Corp  [Customer]              [Edit] [Add Contact] [⋮]   │
├──────────────────────────────┬───────────────────────────────────────────────┤
│ COMPANY INFO                 │ CONTACTS (24)                    [View all →] │
│ Website: acme.com            │ Jane Smith — VP Sales                         │
│ Industry: Technology         │ John Doe — CTO                                │
│ Revenue: $12M                │ ...                                           │
│ Parent: [Beta Holdings →]    │                                               │
│ Addresses (billing/shipping) │ DEALS (5)                                     │
│                              │ Open: $320K · Won: $1.2M                      │
│ CHILD ACCOUNTS (2)           │                                               │
│ Acme EU · Acme APAC          │ ACTIVITY TIMELINE                             │
└──────────────────────────────┴───────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View | `crm:accounts:read` |
| Edit | `crm:accounts:write` |
| Delete | `crm:accounts:delete` |
| Set parent account | `crm:accounts:write` |
| Add contact | `crm:contacts:write` |
| Create deal | `crm:deals:write` |
| View child accounts | `crm:accounts:read` |

---

### UI-CRM-008 — Account Hierarchy

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/crm/accounts/hierarchy` |
| **Layout** | `TreeView` + `GraphView` toggle |

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Account Hierarchy          [Tree View ●] [Graph View]    [Expand All] [+ Node]│
├──────────────────────────────────────────────────────────────────────────────┤
│                         ┌─────────────┐                                      │
│                         │ Beta Holdings│                                     │
│                         └──────┬──────┘                                      │
│                    ┌───────────┴───────────┐                                 │
│              ┌─────┴─────┐           ┌─────┴─────┐                           │
│              │ Acme Corp │           │ Gamma LLC │                           │
│              └─────┬─────┘           └───────────┘                           │
│         ┌──────────┴──────────┐                                              │
│    ┌────┴────┐          ┌────┴────┐                                          │
│    │ Acme EU │          │ Acme APAC│                                         │
│    └─────────┘          └─────────┘                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ Selected: Acme Corp — 24 contacts, 5 deals, Parent: Beta Holdings  [Edit]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View hierarchy | `crm:accounts:read` |
| Reparent account | `crm:accounts:write` | Drag-drop; cycle prevention |
| Add child | `crm:accounts:write` |
| Remove from hierarchy | `crm:accounts:write` |

#### Responsive

| Breakpoint | Layout |
|------------|--------|
| **Desktop** | Interactive tree + side panel |
| **Tablet** | Tree only; detail in drawer |
| **Mobile** | Indented list view (no graph); tap to expand |

---

### UI-CRM-009 — Leads List

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/crm/leads` |

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Leads (89)                              [Import] [Export] [+ New Lead]       │
├──────────────────────────────────────────────────────────────────────────────┤
│ [🔍] [Status ▼] [Source ▼] [Owner ▼] [Score ▼]                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ Name          │ Company    │ Status      │ Score │ Source   │ Owner │ ⋮      │
│ Sam Wilson    │ Delta Co   │ Qualified   │ 82    │ Web form │ You   │ [Convert]│
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View | `crm:leads:read` |
| Create | `crm:leads:write` |
| Edit | `crm:leads:write` |
| Delete | `crm:leads:delete` |
| Convert | `crm:leads:convert` → M003 |
| Disqualify | `crm:leads:write` |

Status transitions enforced: `new → contacted → qualified → converted | disqualified`

---

### UI-CRM-010 — Lead Detail

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/crm/leads/:leadId` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Leads   Sam Wilson  [Qualified]        [Convert Lead] [Edit] [Disqualify]  │
├──────────────────────────────┬───────────────────────────────────────────────┤
│ LEAD INFO                    │ ACTIVITY                                      │
│ Company: Delta Co            │ Timeline (same component as Contact)          │
│ Source: Web form             │                                               │
│ Score: 82 ████████░░         │                                               │
│ Owner: You                   │                                               │
└──────────────────────────────┴───────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View | `crm:leads:read` |
| Edit | `crm:leads:write` |
| Convert | `crm:leads:convert` |
| Disqualify | `crm:leads:write` |
| Reopen (from disqualified) | `crm:leads:write` | Admin only via ABAC |

**Converted state**: Read-only banner + links to created Contact/Deal.

---

### UI-CRM-011 — Lead Convert (Full Page)

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/crm/leads/:leadId/convert` |
| **Note** | Full-page wizard; same flow as modal M003 |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Convert Lead: Sam Wilson                                                     │
│ Step 2 of 3 — Deal Options                                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ ● Contact  ● Deal  ○ Review                                                  │
│                                                                              │
│ ☑ Create new contact (pre-filled from lead)                                  │
│ ☑ Create account "Delta Co"                                                  │
│ ☑ Create deal                                                                │
│   Deal name: [Delta Co — Enterprise]                                         │
│   Pipeline:  [Default Sales        ▼]                                        │
│   Stage:     [Qualified            ▼]                                        │
│   Amount:    [$25,000              ]                                         │
│                                                                              │
│                              [Back]  [Cancel]  [Convert]                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| Convert | `crm:leads:convert` |
| Create deal on convert | `crm:deals:write` |
| Create account on convert | `crm:accounts:write` |

Post-convert: redirect to Contact Detail or Deal Detail (user preference).

---

### UI-CRM-012 — Deals Pipeline (Kanban)

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/crm/deals` |
| **Default view** | Kanban board |

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Deals   [Kanban ●] [List]           [Pipeline: Default ▼] [+ New Deal]       │
├──────────────────────────────────────────────────────────────────────────────┤
│ [🔍] [Owner ▼] [Amount ▼] [Close Date ▼]                    Total: $1.24M    │
├────────────┬────────────┬────────────┬────────────┬────────────┬───────────────┤
│Qualification│ Proposal  │Negotiation │ Closed Won │ Closed Lost│               │
│  $420K (12)│ $310K (8) │ $180K (5)  │ $890K (34) │ $45K (3)   │               │
├────────────┼────────────┼────────────┼────────────┼────────────┼───────────────┤
│┌──────────┐│┌──────────┐│┌──────────┐│            │            │               │
││Acme $50K │││Beta $30K │││Gamma $80K││            │            │               │
││Jane S.   │││Close 7/15│││Close 8/01││            │            │               │
│└──────────┘│└──────────┘│└──────────┘│            │            │               │
│ [+ Quick]  │ [+ Quick]  │            │            │            │               │
└────────────┴────────────┴────────────┴────────────┴────────────┴───────────────┘
```

#### Components

| Component | Behavior |
|-----------|----------|
| `KanbanBoard` | Horizontal scroll columns; drag-drop between stages |
| `DealCard` | Title, amount, contact, close date, owner avatar |
| `StageColumn` | Header sum + count; WIP limit indicator (optional) |
| `PipelineSelector` | Switch pipeline config |
| `QuickCreateDeal` | Inline card at column bottom |

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View kanban | `crm:deals:read` |
| Drag to new stage | `crm:deals:write` → M004 if validation required |
| Mark won/lost | `crm:deals:write` |
| Create deal | `crm:deals:write` |
| Delete deal | `crm:deals:delete` |
| View all pipelines | `crm:pipeline:read` |

#### Mobile Kanban

```
┌─────────────────────────┐
│ Deals        [List] [+] │
│ ◀ Qualification  12 ▶  │  ← swipe between columns
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ Acme Enterprise $50K│ │
│ │ Close: Jul 30       │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ Delta Pilot $12K    │ │
│ └─────────────────────┘ │
│ [Move Stage]            │  ← bottom sheet instead of drag
└─────────────────────────┘
```

- Column navigation via horizontal swipe or dropdown
- Long-press card → Move Stage sheet (M004)
- No drag-and-drop on mobile (accessibility + touch reliability)

#### Tablet Layout

- 3 visible columns; horizontal scroll for rest
- Condensed cards (no contact name; show on expand)
- Split view optional: select card → detail drawer (40% width)

---

### UI-CRM-013 — Deals List

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/crm/deals/list` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Deals  [Kanban] [List ●]                         [Export] [+ New Deal]       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Name          │ Account   │ Stage        │ Amount  │ Close    │ Owner │ ⋮   │
│ Acme Ent.     │ Acme Corp │ Negotiation  │ $50,000 │ Jul 30   │ You   │ ⋮   │
└──────────────────────────────────────────────────────────────────────────────┘
```

Same permissions as 012. View toggle persists in user preferences.

---

### UI-CRM-014 — Deal Detail

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/crm/deals/:dealId` |

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Deals  Acme Enterprise License  [Negotiation]    [Won] [Lost] [Edit] [⋮]  │
├──────────────────────────────┬───────────────────────────────────────────────┤
│ DEAL SUMMARY                 │ STAGE HISTORY                                 │
│ Amount: $50,000              │ Qualification → Proposal → Negotiation ●      │
│ Probability: 60%             │                                               │
│ Weighted: $30,000            │ ACTIVITY TIMELINE                             │
│ Close: Jul 30, 2026          │ ...                                           │
│ Account: [Acme Corp]         │                                               │
│ Contact: [Jane Smith]        │ LINE ITEMS (optional)                         │
│ Owner: You                   │ [+ Add product from ERP]                      │
│                              │                                               │
│ [Create Invoice →]           │ FILES                                         │
└──────────────────────────────┴───────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View | `crm:deals:read` |
| Edit | `crm:deals:write` |
| Delete | `crm:deals:delete` |
| Change stage | `crm:deals:write` |
| Mark Won | `crm:deals:write` | Triggers `deal.won` event |
| Mark Lost | `crm:deals:write` | Requires loss reason |
| Assign owner | `crm:deals:assign` |
| Log activity | `crm:activities:write` |
| Create invoice | `finance:invoices:write` | Link to Finance M002 |
| Add products | `erp:products:read` + `crm:deals:write` |

**Won/Lost terminal states**: Lock amount/stage; edit requires `crm:deals:admin`.

---

### UI-CRM-015 — Activities Timeline

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/crm/activities` |
| **Layout** | Global CRM activity feed |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Activities                              [Log Activity]  [Calendar View]      │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Mine ▼] [Type ▼] [Entity ▼] [Date ▼]                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ TODAY                                                                        │
│ ● 10:30  Call completed — Jane Smith (Acme) — 30 min     [You]    [View]    │
│ ● 09:00  Email sent — Proposal — Beta Inc deal           [You]    [View]    │
│ YESTERDAY                                                                    │
│ ● 16:00  Meeting — Discovery — Gamma LLC lead            [Alex]   [View]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View activities | `crm:activities:read` |
| View all users | `crm:activities:read_all` |
| Log activity | `crm:activities:write` |
| Edit own activity | `crm:activities:write` |
| Edit others' | `crm:activities:admin` |
| Complete task | `crm:activities:write` |
| Delete | `crm:activities:delete` |

Activity types: `call`, `email`, `meeting`, `note`, `task`, `system` (immutable).

---

### UI-CRM-016 — Pipeline Settings

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/crm/settings/pipeline` |
| **Layout** | Settings sub-layout |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ CRM Settings > Pipeline                              [+ New Pipeline]        │
├──────────────────────────────────────────────────────────────────────────────┤
│ Pipeline: [Default Sales ▼]                              [Delete Pipeline] │
├──────────────────────────────────────────────────────────────────────────────┤
│ STAGES (drag to reorder)                                                     │
│ ≡ 1. Qualification    Prob: 10%   WIP: —    [Default] [Edit] [×]            │
│ ≡ 2. Proposal         Prob: 40%   WIP: 20   [Edit] [×]                      │
│ ≡ 3. Negotiation      Prob: 60%   WIP: 10   [Edit] [×]                      │
│ ≡ 4. Closed Won       Prob: 100%  Terminal Won    [Edit]                    │
│ ≡ 5. Closed Lost      Prob: 0%    Terminal Lost   [Edit]                    │
│ [+ Add Stage]                                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│ Automation: ☑ Require lost reason  ☑ Require amount on stage ≥ Proposal     │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View settings | `crm:pipeline:read` |
| Manage pipelines | `crm:pipeline:manage` |
| Reorder stages | `crm:pipeline:manage` |
| Delete stage | `crm:pipeline:manage` | Blocked if deals in stage |
| Set default stage | `crm:pipeline:manage` |

---

## Modals Catalog

---

### UI-CRM-M001 — Create Contact (Modal)

| Attribute | Value |
|-----------|-------|
| **Type** | Modal (`size: md`) — alternative to full page 004 |
| **Trigger** | Global `+ New`, Contacts list, Account detail |
| **Permission** | `crm:contacts:write` |

```
┌─────────────────────────────────────┐
│ Create Contact                   [×]│
├─────────────────────────────────────┤
│ First Name *  [___________]         │
│ Last Name *   [___________]         │
│ Email         [___________]         │
│ Account       [Search...    ▼]      │
├─────────────────────────────────────┤
│        [Cancel]  [Create & View] [Create] │
└─────────────────────────────────────┘
```

**States**: Submitting spinner; validation errors inline; success → toast + optional navigate.

**Mobile**: Full-screen sheet.

---

### UI-CRM-M002 — Merge Contacts

| Attribute | Value |
|-----------|-------|
| **Type** | Modal (`size: lg`) |
| **Trigger** | Contacts list bulk (2–100 contacts) |
| **Permission** | `crm:contacts:merge` |

```
┌──────────────────────────────────────────────────────────┐
│ Merge 3 Contacts                                      [×]│
├──────────────────────────────────────────────────────────┤
│ Select primary record:                                   │
│ ○ Jane Smith (jane@acme.com) — 12 activities, 2 deals   │
│ ● John Doe (john.doe@acme.com) — 5 activities, 1 deal   │
│ ○ Jane S. (jane.smith@corp.com) — duplicate              │
├──────────────────────────────────────────────────────────┤
│ Field resolution (pick per field):                       │
│ Email:    [jane@acme.com ▼]                              │
│ Phone:    [+1 555-0100   ▼]                              │
│ Account:  [Acme Corp     ▼]                              │
├──────────────────────────────────────────────────────────┤
│ ⚠ 2 duplicate records will be archived. This cannot be undone. │
│                    [Cancel]  [Merge Contacts]            │
└──────────────────────────────────────────────────────────┘
```

**Workflow**: Preview → Confirm → Progress bar → Success with undo window (30s, `crm:contacts:merge`).

---

### UI-CRM-M003 — Convert Lead

| Attribute | Value |
|-----------|-------|
| **Type** | Modal (`size: lg`) or redirect to 011 |
| **Permission** | `crm:leads:convert` |

3-step wizard: (1) Contact options (2) Account options (3) Deal options + Review.

**Validation**: Lead must be `qualified` or admin override; cannot convert already converted.

---

### UI-CRM-M004 — Move Deal Stage

| Attribute | Value |
|-----------|-------|
| **Type** | Bottom sheet (mobile) / Modal (desktop) |
| **Trigger** | Kanban drag, Deal detail, mobile long-press |
| **Permission** | `crm:deals:write` |

```
┌─────────────────────────────────────┐
│ Move Deal: Acme Enterprise       [×]│
├─────────────────────────────────────┤
│ Current: Proposal                   │
│ Move to: [Negotiation          ▼]   │
│                                     │
│ Close date: [Jul 30, 2026]          │
│ Amount:     [$50,000] (required)    │
│ Notes:      [________________]      │
├─────────────────────────────────────┤
│              [Cancel]  [Move]       │
└─────────────────────────────────────┘
```

**Conditional fields**: Required fields per stage rules (from pipeline settings).

---

### UI-CRM-M005 — Log Activity

| Attribute | Value |
|-----------|-------|
| **Type** | Modal (`size: md`) or slide-over |
| **Permission** | `crm:activities:write` |

Fields: Type, Subject, Related to (contact/account/deal/lead), Due date, Duration, Outcome, Notes, Assignee.

Quick-log variant: Note only (single field).

---

### UI-CRM-M006 — Bulk Import

| Attribute | Value |
|-----------|-------|
| **Type** | Full-screen modal wizard |
| **Permission** | `crm:imports:write` |

**Steps**:
1. Select entity (Contacts / Leads / Accounts)
2. Upload CSV/XLSX (max 10MB, 50K rows)
3. Column mapping with saved templates
4. Validation preview (errors highlighted)
5. Import execution with progress
6. Summary report (created, updated, skipped, failed)

**Actions**: Download template (`crm:exports:read`), Start import (`crm:imports:write`).

---

### UI-CRM-M007 — Export

| Attribute | Value |
|-----------|-------|
| **Type** | Modal (`size: sm`) |
| **Permission** | `crm:exports:read` |

```
┌─────────────────────────────────────┐
│ Export Contacts                  [×]│
├─────────────────────────────────────┤
│ Format:  ○ CSV  ○ XLSX              │
│ Scope:   ● Current filters (1,247)  │
│          ○ Selected rows (12)       │
│          ○ All records              │
│ Columns: [Customize...]             │
│ ☑ Include custom fields             │
├─────────────────────────────────────┤
│         [Cancel]  [Export]          │
└─────────────────────────────────────┘
```

Large exports → async job + notification download link.

---

## Cross-Module Integration Points

| Source | Target | UI Element | Permission |
|--------|--------|------------|------------|
| Deal Detail | Finance | "Create Invoice" button | `finance:invoices:write` |
| Deal Detail | ERP | "Add Products" line items | `erp:products:read` |
| Deal Won | ERP | Auto-prompt "Create Sales Order" toast | `erp:sales_orders:write` |
| Account Detail | Finance | Outstanding invoices widget | `finance:invoices:read` |

---

## Accessibility Requirements

| Requirement | Implementation |
|-------------|----------------|
| Keyboard kanban | Arrow keys move focus; Enter opens deal; `M` opens move stage |
| Screen reader | Stage columns as `role="list"`; cards as `article` with deal summary |
| Focus trap | All modals |
| Color | Status badges include text labels, not color-only |
| Touch targets | Minimum 44×44px on mobile |

---

## Localization

- All currency via org `currency_code`; deal amounts formatted with `Intl.NumberFormat`
- Date fields respect user timezone
- Stage names translatable per tenant (i18n keys)

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-30 | Initial CRM UI specification |