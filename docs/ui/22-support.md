---
title: Support UI Specification
document_id: ATLAS-UI-22
version: 1.0.0
status: approved
phase: 4
last_updated: 2026-06-30
module: support
related_documents:
  - ATLAS-DB-19
  - ATLAS-ARCH-01
  - ATLAS-UI-19
  - ATLAS-UI-18
  - ATLAS-UI-20
  - ATLAS-UI-21
  - ATLAS-UI-11
tags:
  - support
  - tickets
  - sla
  - customer-portal
  - kanban
  - wireframes
---

# Support UI Specification

## Document Control

| Field | Value |
|-------|-------|
| **Module** | Support (Customer Service) |
| **Screen count** | 8 screens, 5 modals |
| **Primary personas** | P6 (Support Agent), P2 (Admin), P5 (Customer) |
| **Route prefix** | `/app/{org}/support`, `/portal/support` |
| **Tier gate** | Growth+ |

---

## 1. Purpose & Scope

Define all user-facing surfaces for Atlas Support: ticket lifecycle management, omnichannel intake, SLA monitoring, canned responses, routing rules, customer self-service portal, and admin configuration. Aligns with `service.*` schema and PRD requirements SUP-001 through SUP-008.

### In Scope

- Agent ticket inbox (list and kanban views)
- Ticket detail with Customer 360° sidebar
- Ticket creation (agent and customer)
- Customer portal (submit + track tickets)
- SLA dashboard and breach alerts
- Canned responses / macros
- Assignment and escalation rules
- Ticket merge workflow
- Support module settings

### Out of Scope

- AI suggested replies UI (Wave 4 — see `10-ai.md`)
- Phone/voice channel (v1.1)
- Full CSAT analytics (Analytics module — cross-link AN-S01 widgets)

---

## 2. Navigation & Information Architecture

```
Support (primary nav — Growth+ tiers)
├── Inbox (/app/{org}/support)                    → UI-SUP-001
│   └── Ticket detail                             → UI-SUP-002
├── New ticket (/app/{org}/support/new)             → UI-SUP-003
├── SLA Dashboard (/app/{org}/support/sla)          → UI-SUP-005
├── Canned Responses (/app/{org}/support/macros)    → UI-SUP-006
├── Assignment Rules (/app/{org}/support/routing)   → UI-SUP-007
└── Settings (/app/{org}/support/settings)          → UI-SUP-008

Customer Portal (external — authenticated or guest)
└── Portal home + ticket tracker                    → UI-SUP-004
```

### Entry Points

| Source | Destination | Condition |
|--------|-------------|-----------|
| Main nav → Support | UI-SUP-001 | `support:cases:read` |
| Global quick action → New Case | UI-SUP-003 | `support:cases:write` |
| CRM contact → Open cases | UI-SUP-002 filtered | `support:cases:read` |
| Email inbox → Create ticket | UI-SUP-003 pre-filled | `support:cases:write` |
| Chat widget offline form | UI-SUP-003 (customer) | Public |
| Portal URL | UI-SUP-004 | Portal enabled |

---

## 3. Screen Inventory

| ID | Screen | Route | Permission gate |
|----|--------|-------|-----------------|
| UI-SUP-001 | Ticket Inbox | `/app/{org}/support` | `support:cases:read` |
| UI-SUP-002 | Ticket Detail | `/app/{org}/support/cases/:caseId` | `support:cases:read` + queue access |
| UI-SUP-003 | Create Ticket | `/app/{org}/support/new` | `support:cases:write` (agent); portal public |
| UI-SUP-004 | Customer Portal | `/portal/{org}/support` | Public / customer auth |
| UI-SUP-005 | SLA Dashboard | `/app/{org}/support/sla` | `support:sla:read` |
| UI-SUP-006 | Canned Responses | `/app/{org}/support/macros` | `support:macros:read` |
| UI-SUP-007 | Assignment Rules | `/app/{org}/support/routing` | `support:routing:manage` |
| UI-SUP-008 | Support Settings | `/app/{org}/support/settings` | `support:settings:manage` |

### Modals

| ID | Surface | Trigger |
|----|---------|---------|
| UI-SUP-M001 | Assign Agent | Assign button on UI-SUP-002 |
| UI-SUP-M002 | Escalate | Escalate action on UI-SUP-002 |
| UI-SUP-M003 | Merge Tickets | Merge action on UI-SUP-002 or bulk |
| UI-SUP-M004 | Add Internal Note | Internal note tab shortcut |
| UI-SUP-M005 | Send Reply | Reply CTA (quick compose) |

---

## 4. Permissions Matrix

| Permission | UI Effect |
|------------|-----------|
| `support:cases:read` | View inbox and ticket detail |
| `support:cases:write` | Create/edit tickets, add public replies |
| `support:cases:assign` | Assign/reassign agents |
| `support:cases:close` | Resolve and close tickets |
| `support:cases:merge` | Merge duplicate tickets |
| `support:cases:escalate` | Escalate priority/tier |
| `support:cases:internal` | Add internal notes (hidden from customer) |
| `support:sla:read` | View SLA dashboard |
| `support:sla:manage` | Configure SLA policies |
| `support:macros:read` | View and insert canned responses |
| `support:macros:write` | Create/edit macros |
| `support:routing:manage` | Configure assignment rules |
| `support:settings:manage` | Module settings, queues, portal |
| `support:kb:read` | Insert KB articles in replies |
| `support:portal:manage` | Customer portal branding/config |

Queue-scoped access: agents see only assigned queues unless `support:cases:read:all`.

---

## 5. Global Patterns

### 5.1 Ticket Card / Row Component

```
┌────────────────────────────────────────────────────────────────┐
│ [#1042] Login issue — can't reset password          🔴 SLA   │
│ Beta Corp · jane@betacorp.com · High · Unassigned              │
│ Updated 12m ago · Email · Queue: Technical                     │
└────────────────────────────────────────────────────────────────┘
```

| Property | Spec |
|----------|------|
| ID | Monospace, link to UI-SUP-002 |
| SLA indicator | Green / Amber (<20% time) / Red (breached) |
| Priority badge | Low, Normal, High, Urgent |
| Status | New, Open, Pending, Resolved, Closed |
| Channel icon | Email, Chat, Web form, Phone, API |

### 5.2 SLA Timer Component

| State | Display |
|-------|---------|
| On track | Green progress bar + "4h 12m remaining" |
| At risk | Amber pulse + "38m to first response breach" |
| Breached | Red + "Breached 2h ago" + escalation CTA |
| Paused | Gray + "Paused — awaiting customer" tooltip |

### 5.3 Customer 360° Sidebar (UI-SUP-002)

Collapsible right panel aggregating:

- CRM contact/account with health score
- Open opportunities and recent orders (ERP)
- Outstanding invoices (Finance)
- Previous tickets (last 5)
- Linked KB articles suggested by AI (Wave 4)

---

## 6. Screen Specifications

### UI-SUP-001 — Ticket Inbox

**Route:** `/app/{org}/support`  
**Views:** List (default) and Kanban toggle

#### Wireframe — List View (Desktop)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Support Inbox        [List ●] [Kanban]   [🔍] [Queue ▼] [Status ▼] [+ New]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ ☐ │ ID    │ Subject              │ Customer    │ Priority │ Agent  │ SLA  │
│───┼───────┼──────────────────────┼─────────────┼──────────┼────────┼──────│
│ ☐ │ #1042 │ Login issue          │ Beta Corp   │ High     │ —      │ 🔴   │
│ ☐ │ #1041 │ Billing question     │ Acme Inc    │ Normal   │ You    │ 🟢   │
│ ☐ │ #1040 │ Feature request      │ Gamma LLC   │ Low      │ Alex   │ 🟢   │
├──────────────────────────────────────────────────────────────────────────────┤
│ 3 selected  [Assign] [Merge] [Close]              Showing 1–50 of 384       │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Wireframe — Kanban View

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Support Inbox        [List] [Kanban ●]              [Queue: All ▼] [+ New] │
├──────────────┬──────────────┬──────────────┬──────────────┬──────────────────┤
│ New (12)     │ Open (28)    │ Pending (8)  │ Resolved (5) │ Closed           │
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │                  │
│ │ #1042    │ │ │ #1041    │ │ │ #1038    │ │ │ #1035    │ │                  │
│ │ Login…   │ │ │ Billing… │ │ │ Waiting… │ │ │ Done     │ │                  │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │ └──────────┘ │                  │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────────┘
```

#### Saved Views

| View | Filter |
|------|--------|
| Unassigned | `assignee = null` |
| Mine | `assignee = me` |
| SLA at risk | `sla_status = at_risk` |
| Breached | `sla_status = breached` |

#### Bulk Actions

| Action | Permission |
|--------|------------|
| Assign | `support:cases:assign` |
| Merge | `support:cases:merge` |
| Change priority | `support:cases:write` |
| Close | `support:cases:close` |

#### Empty States

| State | ID |
|-------|-----|
| No tickets | ES-SUP-001 |
| Filtered empty | ES-SUP-002 |
| Queue access denied | ES-ERR-403 |

---

### UI-SUP-002 — Ticket Detail

**Route:** `/app/{org}/support/cases/:caseId`

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Inbox  #1042 Login issue — can't reset password    [Assign] [Escalate] [⋮]│
├────────────────────────────────────────────┬─────────────────────────────────┤
│ CONVERSATION                             │ CUSTOMER 360°                     │
│ ─────────────────────────────────────────│ Beta Corp · jane@betacorp.com    │
│ [Customer] Mar 12, 9:00 AM               │ Health: Good · MRR $4,200         │
│ I can't reset my password. The link…     │ ─────────────────────────────────│
│                                          │ Open tickets: 1                   │
│ [Internal] Mar 12, 9:15 AM  Alex         │ Orders: #ORD-882 (shipped)        │
│ Checked auth logs — token expired.       │ Invoices: #4521 (paid)            │
│                                          │ [View in CRM →]                   │
│ [Agent reply composer area]              │                                   │
├──────────────────────────────────────────┤ SUGGESTED KB                      │
│ [Public reply ▼] [Internal note] [Macro] │ • Reset password guide            │
│ ┌──────────────────────────────────────┐ │ • SSO troubleshooting             │
│ │ Type reply…                          │ │                                   │
│ └──────────────────────────────────────┘ │ SLA: First response 🔴 Breached   │
│ [Send reply]  [Send & close]             │ Resolution: 18h remaining 🟢      │
└──────────────────────────────────────────┴─────────────────────────────────┘
```

#### Header Metadata

| Field | Editable | Permission |
|-------|----------|------------|
| Subject | Yes | `support:cases:write` |
| Priority | Yes | `support:cases:write` |
| Status | Yes | `support:cases:write` |
| Queue | Yes | `support:cases:assign` |
| Assignee | Yes | `support:cases:assign` |
| Tags | Yes | `support:cases:write` |
| Linked entities | Yes | `support:cases:write` |

#### Conversation Tabs

| Tab | Visibility | Permission |
|-----|------------|------------|
| Public replies | Customer + agents | `support:cases:read` |
| Internal notes | Agents only | `support:cases:internal` |
| Activity log | Agents | `support:cases:read` — status changes, assignments |
| Attachments | All | `support:cases:read` |

#### Overflow Menu (⋮)

- Merge tickets → UI-SUP-M003
- Print ticket
- Clone ticket
- Delete (admin, 30-day soft delete)

---

### UI-SUP-003 — Create Ticket

**Route:** `/app/{org}/support/new`

#### Agent Form

| Field | Required | Notes |
|-------|----------|-------|
| Customer | Yes | Contact search or create inline |
| Subject | Yes | Max 200 chars |
| Description | Yes | Rich text |
| Priority | No | Default Normal |
| Queue | No | Default from routing rules |
| Assignee | No | Optional immediate assign |
| Attachments | No | Max 10 files |
| Channel | Auto | `agent`, `email`, `chat`, `web` |

#### Customer Portal Form (subset)

Name, email, subject, description, attachments, optional category dropdown.

Submit → confirmation with ticket # and portal tracking link.

---

### UI-SUP-004 — Customer Portal

**Route:** `/portal/{org}/support`

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Org Logo]  Acme Support Portal                        [Sign in] [Submit ticket]│
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐  ┌──────────────────────────────────────────┐│
│ │ 🔍 Search help articles     │  │ MY TICKETS (signed in)                   ││
│ └─────────────────────────────┘  │ #1042 Login issue        Open    Mar 12   ││
│                                  │ #998 Billing question    Resolved Feb 01 ││
│ Popular Articles                 │ [View all tickets →]                   ││
│ • Getting started                └──────────────────────────────────────────┘│
│ • Reset your password                                                        │
│ • Contact support                                                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Features

- KB deflection search (links `11-knowledge-base.md`)
- Guest ticket submit → email verification magic link
- Authenticated customer: ticket list + detail (public replies only)
- CSAT prompt on resolved tickets (thumbs + comment)
- Branding from UI-SUP-008 portal settings

---

### UI-SUP-005 — SLA Dashboard

**Route:** `/app/{org}/support/sla`  
**Gate:** `support:sla:read`

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ SLA Dashboard                    [Last 7 days ▼]  [Queue: All ▼]  [Export]   │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐             │
│ │ First Resp  │ │ Resolution  │ │ Breach Rate │ │ At Risk Now │             │
│ │ 94.2% met   │ │ 87.1% met   │ │ 2.3%        │ │ 7 tickets   │             │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘             │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Chart: SLA compliance trend — line chart by day]                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ AT RISK TICKETS                                              [View in inbox →]│
│ #1042 · High · Technical · 12m to breach                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Widgets

| Widget | Data |
|--------|------|
| Compliance KPIs | First response %, resolution %, breach rate |
| Trend chart | Daily compliance 7/30/90 days |
| At-risk queue | Live list with countdown |
| By agent | Table: agent, tickets, avg response, breach count |
| By priority | Stacked bar SLA met vs breached |

Drill-down: click metric → UI-SUP-001 with filters applied.

---

### UI-SUP-006 — Canned Responses

**Route:** `/app/{org}/support/macros`  
**Gate:** `support:macros:read`

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Canned Responses                              [🔍] [Folder ▼]  [+ New macro]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Name              │ Shortcut   │ Folder      │ Used (30d) │ Updated  │ ⋮   │
│ Password reset    │ /pwdreset  │ Technical   │ 142        │ Mar 1    │ ⋮   │
│ Billing FAQ       │ /billing   │ General     │ 89         │ Feb 15   │ ⋮   │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Macro Editor (inline drawer)

- Title, shortcut (`/slug`), folder, visibility (personal vs team)
- Rich text body with variable insertion: `{{customer.first_name}}`, `{{ticket.id}}`, `{{agent.name}}`
- Attach files option
- Preview with sample data

Insert in UI-SUP-002: type `/` in composer → autocomplete macros.

---

### UI-SUP-007 — Assignment Rules

**Route:** `/app/{org}/support/routing`  
**Gate:** `support:routing:manage`

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Assignment Rules                                        [+ Add rule]          │
├──────────────────────────────────────────────────────────────────────────────┤
│ Priority │ Rule name              │ Conditions          │ Action    │ Status │
│ 1        │ Urgent → Senior queue  │ Priority = Urgent   │ Queue: Sr │ ● On  │
│ 2        │ Beta Corp VIP            │ Account = Beta Corp │ Agent: JM │ ● On  │
│ 3        │ Round robin — Technical  │ Queue = Technical   │ Round robin│ ● On │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Rule Builder

| Component | Options |
|-----------|---------|
| Conditions | Queue, priority, channel, account, tags, business hours — AND/OR |
| Actions | Assign queue, assign agent, set priority, add tag, escalate |
| Schedule | Business hours only toggle |
| Fallback | Default queue if no match |

Drag to reorder priority. Test rule with sample ticket preview.

---

### UI-SUP-008 — Support Settings

**Route:** `/app/{org}/support/settings`  
**Gate:** `support:settings:manage`

#### Sections

| Tab | Contents |
|-----|----------|
| Queues | Create queues, default assignee, business hours link |
| SLA Policies | First response / resolution targets by priority |
| Ticket fields | Custom fields builder |
| Portal | Enable portal, branding, allowed domains |
| Channels | Email addresses, web form embed, chat widget link |
| CSAT | Enable survey, delay after resolve, question text |
| Automations | Link to UI-AUTO-001 for support triggers |

---

## 7. Modal Specifications

### UI-SUP-M001 — Assign Agent

```
┌─────────────────────────────────────────┐
│ Assign ticket #1042               [×]   │
├─────────────────────────────────────────┤
│ Agent        [Search agents...      ▼]  │
│ Queue        [Technical             ▼]  │
│ Note         [Optional handoff note  ]  │
│ ☑ Notify assignee via email             │
│              [Cancel]  [Assign]         │
└─────────────────────────────────────────┘
```

Shows agent workload badge (open ticket count). Suggests least-loaded if round-robin.

### UI-SUP-M002 — Escalate

| Field | Options |
|-------|---------|
| Escalate to | Tier 2 queue, specific agent, manager |
| New priority | Auto-bump to Urgent or manual select |
| Reason | Required textarea |
| Notify | Manager + current assignee |

### UI-SUP-M003 — Merge Tickets

```
┌─────────────────────────────────────────┐
│ Merge tickets                     [×]   │
├─────────────────────────────────────────┤
│ Primary (keep)  [#1042 Login issue    ] │
│ Merge in        [#1039 Password help  ] │
│                 [#1021 Can't log in   ] │
│ ○ Combine conversations chronologically │
│ ○ Append as internal note summary       │
│ ⚠ Merged tickets close as duplicate     │
│              [Cancel]  [Merge (2)]        │
└─────────────────────────────────────────┘
```

**Gate:** `support:cases:merge`

### UI-SUP-M004 — Add Internal Note

Focused modal for quick internal note without full page context. @mention agents, attach files.

### UI-SUP-M005 — Send Reply

Quick reply modal from inbox row action. Macro picker, send, send & next ticket navigation.

---

## 8. Responsive Behavior

| Breakpoint | Adaptation |
|------------|------------|
| Mobile | UI-SUP-001 card list; UI-SUP-002 stacked (conversation first, 360° in tab) |
| Tablet | Split view inbox + detail; kanban horizontal scroll |
| Desktop | Three-column detail with persistent 360° sidebar |

Customer portal: mobile-first; single column.

---

## 9. Accessibility

| Requirement | Implementation |
|-------------|----------------|
| SLA status | Icon + text label, not color-only |
| Kanban | Keyboard drag alternative via status dropdown |
| Forms | All fields labeled; error summary on submit |
| Live updates | `aria-live` for new ticket assignments |

---

## 10. Telemetry Events

| Event | Properties |
|-------|------------|
| `support.inbox.viewed` | `view_mode`, `queue`, `filter` |
| `support.ticket.created` | `channel`, `priority`, `queue` |
| `support.ticket.assigned` | `case_id`, `agent_id`, `method` |
| `support.ticket.merged` | `primary_id`, `merged_count` |
| `support.ticket.resolved` | `case_id`, `resolution_time_hours` |
| `support.sla.breached` | `case_id`, `sla_type` |
| `support.portal.ticket_submitted` | `org_id`, `deflected` |

---

## 11. Open Questions

| ID | Question | Owner |
|----|----------|-------|
| OQ-UI-22-01 | Kanban WIP limits per column? | v1.1 |
| OQ-UI-22-02 | Customer portal SSO with org IdP? | Enterprise |
| OQ-UI-22-03 | Co-browse / screen share in ticket detail? | v2 |