---
title: Atlas Navigation & App Shell
document_id: PHASE4-01
version: 1.0.0
status: Draft
last_updated: 2026-06-30
phase: 4
related_documents:
  - INDEX.md
  - 00-design-system.md
  - ../architecture/phase-1/01-business-architecture.md
---

# Atlas Navigation & App Shell

## Purpose

Define the authenticated application shell, global navigation for all 17 business modules, responsive layout behavior, and cross-cutting navigation patterns (breadcrumbs, command palette, quick actions).

---

## App Shell Architecture

### SHL-001: Desktop App Shell (≥1024px)

| Field | Value |
|-------|-------|
| **Screen ID** | SHL-001 |
| **Route** | `/app/*` |
| **Purpose** | Primary layout frame for all authenticated module views |

#### Wireframe (Desktop)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR (56px)                                                               │
│ [≡] [Atlas Logo] [Org/Workspace ▾]  ·········  [⌘K Search] [🔔] [AI] [Avatar▾]│
├────────┬─────────────────────────────────────────────────────────┬───────────┤
│        │ BREADCRUMB BAR (40px)                                   │           │
│ SIDE   │ Home › CRM › Accounts › Acme Corp                       │  AI       │
│ BAR    ├─────────────────────────────────────────────────────────┤  PANEL    │
│ 240px  │                                                         │  (360px)  │
│        │  PAGE HEADER + ACTIONS                                  │  optional │
│ [Nav]  │  ┌─────────────────────────────────────────────────┐   │           │
│ [Nav]  │  │                                                 │   │  [Chat]   │
│ [Nav]  │  │           MAIN CONTENT AREA                     │   │  [Ctx]    │
│ [Nav]  │  │           (fluid, max 1280px centered)          │   │  [Acts]   │
│        │  │                                                 │   │           │
│ [Set]  │  └─────────────────────────────────────────────────┘   │           │
│        │                                                         │           │
└────────┴─────────────────────────────────────────────────────────┴───────────┘
```

#### Regions

| Region | Component | Behavior |
|--------|-----------|----------|
| Top bar | `<TopBar />` | Fixed; z-index 100 |
| Sidebar | `<Sidebar />` | Persistent 240px; collapsible to 64px icon rail |
| Breadcrumb bar | `<Breadcrumb />` | Hidden on dashboard home |
| Content | `<MainContent />` | Scrollable; padding `--space-6` |
| AI panel | `<AIPanel />` | Toggle via top bar or `Cmd+.`; resizable 320–480px |
| Right inset | — | AI panel pushes content, does not overlay |

#### Components

- `<TopBar />`, `<Sidebar />`, `<Breadcrumb />`, `<MainContent />`, `<AIPanel />`
- `<OrgWorkspaceSwitcher />`, `<NotificationBell />`, `<UserMenu />`, `<GlobalSearchTrigger />`
- `<SkipLink />`, `<PermissionGate />`

#### Actions & Permissions

| Action | Control | Permission | Notes |
|--------|---------|------------|-------|
| Toggle sidebar | `≡` button | — | User preference persisted |
| Open command palette | Search input / `Cmd+K` | — | All authenticated users |
| Open notifications | Bell icon | — | All authenticated users |
| Toggle AI panel | AI icon | `ai:copilot:read` | Hidden if tier lacks AI |
| Open settings | Sidebar footer / user menu | `platform:settings:read` | Partial nav if read-only |
| Switch org/workspace | Switcher dropdown | Membership-based | Only shows accessible scopes |

#### States

| State | Behavior |
|-------|----------|
| Loading | Sidebar skeleton; content area `<Skeleton />` |
| No modules entitled | Content shows `SHL-010` upgrade prompt |
| AI panel loading | Panel skeleton; content usable |
| Offline | Top banner warning; read-only mode |

#### Mobile Variant

See SHL-003.

#### Tablet Variant

See SHL-002.

#### Related Modals

- `SHL-004`: Command Palette
- `SHL-005`: Notification Center (drawer)
- `SHL-007`: Workspace/Org Switcher (dropdown, not modal)

---

### SHL-002: Tablet App Shell (768–1023px)

| Field | Value |
|-------|-------|
| **Screen ID** | SHL-002 |
| **Route** | `/app/*` |
| **Purpose** | Collapsible sidebar layout for tablet form factors |

#### Wireframe (Tablet)

```
┌────────────────────────────────────────────────────────┐
│ TOP BAR: [≡] Logo [Switcher▾] ··· [⌘K] [🔔] [Avatar▾]  │
├────────────────────────────────────────────────────────┤
│ Breadcrumb (condensed)                                 │
├────────────────────────────────────────────────────────┤
│                                                        │
│              MAIN CONTENT (full width)                 │
│                                                        │
└────────────────────────────────────────────────────────┘

Sidebar: overlay drawer from left (280px), opened via ≡
AI panel: full-screen drawer from right when open
```

#### Behavior

- Sidebar **collapsed by default**; opens as `<Drawer position="left" />`
- Tap outside sidebar closes it
- Swipe from left edge opens sidebar (80px threshold)
- Bottom nav **not shown** on tablet
- Tables switch to comfortable density

---

### SHL-003: Mobile App Shell (320–767px)

| Field | Value |
|-------|-------|
| **Screen ID** | SHL-003 |
| **Route** | `/app/*` |
| **Purpose** | Touch-optimized layout with bottom navigation |

#### Wireframe (Mobile)

```
┌─────────────────────────┐
│ [≡]  Atlas   [🔔] [👤]  │  TOP BAR (48px)
├─────────────────────────┤
│                         │
│    MAIN CONTENT         │
│    (single column)      │
│                         │
├─────────────────────────┤
│ 🏠  💬  📁  📅  ⋯      │  BOTTOM NAV (56px + safe area)
└─────────────────────────┘
```

#### Bottom Navigation Items

| Icon | Label | Route | Module |
|------|-------|-------|--------|
| Home | Home | `/app/{org}` | Dashboard |
| Messages | Chat | `/app/{org}/messages` | Messaging |
| Docs | Docs | `/app/{org}/docs` | Docs |
| Calendar | Calendar | `/app/{org}/calendar` | Scheduling |
| More | More | Opens module drawer | All modules |

**More drawer:** Grid of all entitled modules (2 columns).

#### Mobile-Specific Behaviors

- Hamburger (`≡`) opens full-height left drawer with complete sidebar nav
- Breadcrumbs collapse to back button + current page title
- Command palette: full-screen overlay
- AI panel: full-screen with swipe-down to dismiss
- Pull-to-refresh on list views (where data is stale-tolerant)

#### Gestures

| Gesture | Action |
|---------|--------|
| Swipe right from edge | Open sidebar |
| Swipe left on sidebar | Close sidebar |
| Swipe down on AI panel | Dismiss AI panel |
| Long press on list item | Context action menu |

---

## Global Navigation Tree (17 Modules)

Navigation items are **entitlement-gated**. Locked modules show lock icon + upgrade tooltip.

### Primary Sidebar Structure

```
🏠  Home                         /app/{org}
─── Revenue ───
👥  CRM                          /app/{org}/crm
    ├─ Accounts
    ├─ Contacts
    ├─ Leads
    ├─ Opportunities
    └─ Lists
💰  Sales                         /app/{org}/sales
    ├─ Products
    ├─ Price Books
    ├─ Quotes
    └─ Orders
📣  Marketing                     /app/{org}/marketing
─── Operations ───
📊  ERP                           /app/{org}/erp
💵  Finance                       /app/{org}/finance
📦  Inventory                     /app/{org}/inventory
📋  Projects                      /app/{org}/projects
─── People ───
👔  HR                            /app/{org}/hr
📅  Scheduling                    /app/{org}/calendar
─── Engagement ───
🎧  Support                       /app/{org}/support
📄  Docs                          /app/{org}/docs
💬  Messages                      /app/{org}/messages
📚  Knowledge Base                /app/{org}/kb
─── Platform ───
📈  Analytics                     /app/{org}/analytics
⚖️  Legal                         /app/{org}/legal
🌐  Website                       /app/{org}/sites
⚡  Automation                    /app/{org}/automation
─── System ───
⚙️  Settings                      /settings
```

### Module Nav Item Spec

| Property | Rule |
|----------|------|
| Icon | Module accent color when active |
| Active state | Left border 3px brand + bold label |
| Badge | Unread count (Messages, Support) |
| Collapsed sidebar | Icon only + tooltip on hover |
| Keyboard | Arrow keys navigate; `Enter` activates |
| Expandable groups | Chevron; state persisted per user |

### Entitlement Display

| Tier State | UI |
|------------|-----|
| Included in plan | Normal nav item |
| Trial available | "Try" badge; click opens trial modal |
| Upgrade required | Lock icon; click opens `SET-006-M01` upgrade |
| Enterprise only | "Enterprise" badge |
| Disabled by admin | Hidden from nav |

---

## Breadcrumb Patterns

### Standard Pattern

```
{Workspace Name} › {Module} › {Entity Type} › {Entity Name}
```

### Rules

| Rule | Example |
|------|---------|
| Org name omitted when single org | `CRM › Accounts › Acme` |
| Entity ID never shown | Use display name; fallback to truncated UUID |
| Truncate long names | 32 chars + ellipsis |
| Clickable segments | All except current page |
| Mobile | `‹ Back` + current title only |

### Module-Specific Patterns

| Module | Pattern |
|--------|---------|
| CRM | `CRM › Accounts › {Account} › Contacts` |
| Finance | `Finance › Invoices › {Invoice #}` |
| Projects | `Projects › {Project} › Board` |
| Settings | `Settings › {Section}` |
| Docs | `Docs › {Folder path} › {File}` |

---

## SHL-004: Command Palette

| Field | Value |
|-------|-------|
| **Screen ID** | SHL-004 |
| **Route** | Global overlay (`Cmd/Ctrl+K`) |
| **Purpose** | Universal navigation, search, and quick actions |

#### Wireframe

```
┌────────────────────────────────────────────┐
│ 🔍  Search commands, records, actions...   │
├────────────────────────────────────────────┤
│ RECENT                                     │
│   Acme Corp (Account)                      │
│   Invoice #1042                            │
├────────────────────────────────────────────┤
│ ACTIONS                                    │
│   Create Contact                           │
│   Create Invoice                           │
│   Invite Team Member                       │
├────────────────────────────────────────────┤
│ NAVIGATION                                 │
│   Go to CRM › Opportunities                │
│   Go to Settings › Billing                 │
└────────────────────────────────────────────┘
```

#### Components

- `<CommandPalette />` (cmdk-based)
- `<SearchInput />`, `<CommandGroup />`, `<CommandItem />`

#### Actions & Permissions

| Action | Permission | Notes |
|--------|------------|-------|
| Navigate to module | Module read permission | Hidden if locked |
| Create record | Entity write permission | Shown in Actions group |
| Admin actions | `admin:*` or specific | "Invite member", "Create role" |
| AI query | `ai:copilot:read` | "Ask Atlas..." prefix routes to AI panel |

#### Search Sources (Priority Order)

1. Recent records (local, last 20)
2. Navigation targets
3. Quick actions (permission-filtered)
4. OpenSearch global index (debounced 300ms)
5. Help documentation links

#### States

| State | Behavior |
|-------|----------|
| Empty query | Show recent + suggested actions |
| Loading | Spinner in input; skeleton results |
| No results | "No results for '{query}'" + create suggestion if applicable |
| Error | "Search unavailable" + retry |

#### Mobile Variant

Full-screen overlay; keyboard opens automatically; results fill viewport.

#### Tablet Variant

Centered modal 600px width (same as desktop).

#### Keyboard

| Key | Action |
|-----|--------|
| `↑/↓` | Navigate results |
| `Enter` | Execute selected |
| `Escape` | Close |
| `Tab` | Cycle result groups |

---

## Quick Actions

### Top Bar Quick Create (`+` Button)

| Action | Permission | Tier |
|--------|------------|------|
| New Contact | `crm:contacts:write` | Starter+ |
| New Lead | `crm:leads:write` | Starter+ |
| New Invoice | `finance:invoices:write` | Growth+ |
| New Project | `projects:projects:write` | Growth+ |
| New Case | `support:cases:write` | Growth+ |
| New Event | `scheduling:events:write` | Starter+ |
| Invite Member | `admin:members:invite` | All |

Mobile: Quick create accessible from bottom nav "More" drawer header.

---

## SHL-005: Notification Center

| Field | Value |
|-------|-------|
| **Screen ID** | SHL-005 |
| **Route** | Drawer from bell icon |
| **Purpose** | Unified notification inbox across modules |

#### Wireframe

```
┌──────────────────────────────┐
│ Notifications    [Mark all]  │
│ [All] [Mentions] [Approvals] │
├──────────────────────────────┤
│ ● Sarah mentioned you in #sales │
│   2m ago                     │
├──────────────────────────────┤
│ ○ Invoice #1042 overdue      │
│   1h ago                     │
├──────────────────────────────┤
│ ○ Approval: Quote #88        │
│   Yesterday                  │
└──────────────────────────────┘
```

#### Components

- `<Drawer />`, `<Tabs />`, `<NotificationItem />`, `<Badge />`

#### Actions

| Action | Permission |
|--------|------------|
| Mark as read | — |
| Mark all read | — |
| Click notification | Navigate to source (permission-checked) |
| Notification settings | Link to `SET-015` |

#### Mobile Variant

Full-screen drawer from right.

---

## SHL-006: AI Assistant Panel

| Field | Value |
|-------|-------|
| **Screen ID** | SHL-006 |
| **Route** | Right panel (desktop) / full screen (mobile) |
| **Purpose** | Persistent AI copilot with module context |
| **Wave** | D (GA) |

#### Wireframe

```
┌─────────────────────────┐
│ Atlas AI        [−][×]  │
├─────────────────────────┤
│ Context: Account › Acme │
├─────────────────────────┤
│ [Chat messages...]      │
│                         │
├─────────────────────────┤
│ Suggested actions:      │
│  • Summarize account    │
│  • Draft follow-up      │
├─────────────────────────┤
│ [Ask anything...]  [⏎]  │
└─────────────────────────┘
```

#### Context Injection

| Current Route | Auto-injected Context |
|---------------|----------------------|
| CRM record | Account/contact ID, timeline summary |
| Support case | Case + customer 360 |
| Finance invoice | Invoice lines, payment status |
| Global | Org metrics snapshot |

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| Open panel | `ai:copilot:read` |
| L0–L3 (read/draft) | `ai:copilot:read` |
| L4 execute action | Inherited from user + `ai:agents:execute` |
| Approve AI action | Same as target mutation permission |

---

## SHL-007: Workspace / Org Switcher

| Field | Value |
|-------|-------|
| **Screen ID** | SHL-007 |
| **Route** | Top bar dropdown |
| **Purpose** | Switch between organizations and workspaces |

#### Wireframe

```
┌──────────────────────────────┐
│ WORKSPACES                   │
│  ✓ Acme Holdings             │
│    └ Acme US Inc. (org)      │
│    └ Acme EU GmbH (org)      │
│  ○ Client Agency WS          │
├──────────────────────────────┤
│ [+ Create workspace]         │
│ [Manage organizations]       │
└──────────────────────────────┘
```

#### Actions

| Action | Permission |
|--------|------------|
| Switch org | Membership required |
| Switch workspace | `workspace:read` |
| Create workspace | `admin:workspace:create` |
| Manage orgs | `platform:settings:manage` |

#### Behavior

- Switching org: full page reload to `/app/{newOrgSlug}`; preserve module if entitled
- Recent orgs pinned (last 3)
- Search filter when >5 workspaces

---

## SHL-008: User Menu

| Field | Value |
|-------|-------|
| **Screen ID** | SHL-008 |
| **Route** | Top bar avatar dropdown |
| **Purpose** | Profile access, preferences, sign out |

#### Menu Items

| Item | Route | Permission |
|------|-------|------------|
| Profile | `/settings/profile` | — |
| Preferences | `/settings/profile#preferences` | — |
| Keyboard shortcuts | Modal | — |
| Theme toggle | Inline | — |
| Help & Documentation | External link | — |
| Sign out | `/auth/signout` | — |

---

## SHL-009: Unified Search

Global search is integrated into Command Palette (SHL-004). Dedicated search results page:

| Field | Value |
|-------|-------|
| **Route** | `/app/{org}/search?q={query}` |
| **Purpose** | Full search results with filters |

#### Wireframe

```
┌─────────────────────────────────────────────────┐
│ Search: "acme"                    [Filters ▾]   │
├──────────┬──────────────────────────────────────┤
│ All (42) │  Accounts (3)                        │
│ Accounts │  ┌────────────────────────────────┐  │
│ Contacts │  │ Acme Corp — San Francisco      │  │
│ Invoices │  └────────────────────────────────┘  │
│ ...      │  Contacts (5) ...                    │
└──────────┴──────────────────────────────────────┘
```

---

## SHL-010: Empty Module (Gated)

| Field | Value |
|-------|-------|
| **Screen ID** | SHL-010 |
| **Route** | `/app/{org}/{module}/locked` |
| **Purpose** | Upgrade prompt when module not entitled |

#### Wireframe

```
┌─────────────────────────────────────┐
│         [Module Icon]               │
│     Unlock Finance Module           │
│  Track invoices, expenses, and      │
│  financial reports in one place.    │
│                                     │
│  [Start 14-day trial]  [Compare]    │
│  [Contact sales]                    │
└─────────────────────────────────────┘
```

#### Actions

| Action | Permission | Tier |
|--------|------------|------|
| Start trial | `admin:billing:manage` | Workspace admin |
| Compare plans | — | All |
| Contact sales | — | All |

---

## Home Dashboard (Shell Content)

| Field | Value |
|-------|-------|
| **Route** | `/app/{org}` |
| **Purpose** | Cross-module landing; personalized widgets |

Not a separate shell screen—renders inside `SHL-001` content area.

#### Widgets (Persona-Adaptive)

| Widget | Persona | Data Sources |
|--------|---------|--------------|
| AI Morning Brief | P1 | CRM, Finance, PM |
| Pipeline Summary | P5 | CRM, Sales |
| Tasks Due Today | P3 | PM, Messaging |
| Overdue Invoices | P4 | Finance |
| Open Cases | P6 | Support |
| Onboarding Checklist | New users | ONB-008 |

---

## Settings Entry Points

| Entry | Location | Destination |
|-------|----------|-------------|
| Sidebar footer | `⚙️ Settings` | `/settings` |
| User menu | Profile & Settings | `/settings/profile` |
| Org switcher | Manage organizations | `/settings/organization` |
| Billing alert banner | Top bar | `/settings/billing` |
| Keyboard `G S` | Shortcut | `/settings` |

### Settings Sub-Nav (Secondary Sidebar)

When route starts with `/settings`, main sidebar collapses to settings-specific nav:

```
Organization
Workspace
Teams
Members
Roles & Permissions
Security
  ├─ SSO
  └─ Policies
Billing
Integrations
API Keys
Webhooks
Audit Log
Data Export
Notifications
Danger Zone
```

---

## Layout Grid

| Breakpoint | Columns | Gutter | Margin |
|------------|---------|--------|--------|
| Mobile | 4 | 16px | 16px |
| Tablet | 8 | 24px | 24px |
| Desktop | 12 | 24px | 32px |
| Wide | 12 | 32px | auto center |

---

## Z-Index Scale

| Layer | z-index |
|-------|---------|
| Base content | 0 |
| Sticky header | 50 |
| Sidebar | 60 |
| Dropdown | 200 |
| Drawer backdrop | 300 |
| Drawer | 310 |
| Modal backdrop | 400 |
| Modal | 410 |
| Toast | 500 |
| Command palette | 600 |
| Tooltip | 700 |

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-30 | Initial navigation and shell specification |

---

*Document owner: UX Architecture*