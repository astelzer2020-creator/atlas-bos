---
title: Automation Module — UI Specification
document_id: ATLAS-UI-12
version: 1.0.0
status: draft
phase: 4
last_updated: 2026-06-30
module: automation
related_documents:
  - ATLAS-DB-14
  - ATLAS-ARCH-15
  - ATLAS-ARCH-16
  - ATLAS-ARCH-08
tags:
  - ui
  - automation
  - workflow
  - bpmn
  - wireframes
---

# Automation Module — UI Specification

## Purpose

Complete UI specification for the **Automation & Workflow** module: IFTTT-style rules, visual rule builder, BPMN workflow designer, instance monitoring, approval inbox, templates gallery, and execution logs. Combines lightweight automation (ARCH-16) with durable workflows (ARCH-15). Aligns with `automation` schema (DB-14).

## Screen ID Convention

```
UI-AUTO-{NNN}       Screen
UI-AUTO-MOD-{NNN}   Modal
```

## Module Navigation

| Route | Screen ID | Label |
|-------|-----------|-------|
| `/automation` | UI-AUTO-001 | Rules |
| `/automation/rules/:id` | UI-AUTO-002 | Rule Builder |
| `/automation/workflows` | UI-AUTO-003 | Workflow Designer (list) |
| `/automation/workflows/:id` | UI-AUTO-003 | Workflow Designer (canvas) |
| `/automation/instances` | UI-AUTO-004 | Workflow Instances |
| `/automation/approvals` | UI-AUTO-005 | Approval Inbox |
| `/automation/templates` | UI-AUTO-006 | Templates Gallery |
| `/automation/logs` | UI-AUTO-007 | Execution Log |

**Primary nav:** Automation icon (position 16). Sub-nav tabs: Rules | Workflows | Instances | Approvals | Templates | Logs.

---

## Permissions Matrix

| Permission | UI Effect |
|------------|-----------|
| `automation:rules:read` | View rules list and builder (read-only) |
| `automation:rules:write` | Create/edit/enable/disable rules |
| `automation:manage` | Full rule management incl. rate limits |
| `automation:advanced` | Webhooks to external URLs, bulk mutations |
| `automation:workflows:read` | View workflow definitions and instances |
| `automation:workflows:write` | Design and publish workflows |
| `automation:workflows:execute` | Manual start, cancel instances |
| `automation:approvals:read` | View approval inbox |
| `automation:approvals:resolve` | Approve/reject workflow tasks |
| `automation:logs:read` | View execution logs |

Rules with human tasks or SLA > 24h should migrate to workflow engine (BR-AUTO-02) — UI shows migration prompt.

---

## Responsive Breakpoints

| Token | Range | Designer Behavior |
|-------|-------|-------------------|
| xs | 0–479px | Rules list only; builder read-only summary |
| sm | 480–767px | Simplified instance cards |
| md | 768–1023px | Rule builder stacked panels |
| lg | 1024px+ | Full visual designers |
| xl | 1440px+ | BPMN canvas with minimap |

---

## UI-AUTO-001 — Rules List

**Route:** `/automation`  
**Permissions:** `automation:rules:read`

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Automation — Rules                [🔍] [Status▾] [Tag▾]    [+ New rule]        │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Name                    │ Trigger        │ Status   │ Runs (24h) │ Last  │ │
│ ├─────────────────────────┼────────────────┼──────────┼────────────┼───────┤ │
│ │ Notify on new deal      │ crm.deal.created│ ● Enabled│ 42         │ 2m ago│ │
│ │ SLA breach alert        │ schedule hourly │ ● Enabled│ 24         │ 1h ago│ │
│ │ Webhook to Slack        │ webhook        │ ○ Disabled│ 0          │ —     │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ 12 enabled │ 3 disabled │ 156 runs today              [Execution log →]     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Row Actions

| Action | Permission |
|--------|------------|
| Edit | `automation:rules:write` |
| Enable/Disable toggle | `automation:rules:write` |
| Duplicate | `automation:rules:write` |
| Dry run | `automation:rules:read` + `dry_run_available` |
| Delete | `automation:manage` |

### States

| State | Treatment |
|-------|-----------|
| Empty | Template gallery CTA (UI-AUTO-006) |
| Rate limited | Badge on rule + tooltip with limits |

---

## UI-AUTO-002 — Rule Builder (Trigger-Condition-Action)

**Route:** `/automation/rules/:id`  
**Permissions:** `automation:rules:read` / `write`

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Rules / Notify on new deal          [Save] [Dry run] [Enable ▾] [⋮]        │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────────┐  │
│ │ WHEN (Trigger)                                                          │  │
│ │ [Event ▾] [crm.deal.created ▾]                                          │  │
│ │ Filter: [workspace equals Sales ▾]  [+ Add condition]                   │  │
│ └─────────────────────────────────────────────────────────────────────────┘  │
│                              ↓                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐  │
│ │ IF (Conditions) — optional                                              │  │
│ │ [deal.amount] [greater than] [10000]  [AND] [+ Add]                     │  │
│ └─────────────────────────────────────────────────────────────────────────┘  │
│                              ↓                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐  │
│ │ THEN (Actions)                                                          │  │
│ │ 1. [Send notification ▾] to [deal.owner] template [New big deal]       │  │
│ │ 2. [Create task ▾] in project [Sales follow-up] title [Follow up {{id}}] │  │
│ │ [+ Add action]                                                          │  │
│ └─────────────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Settings: Max 100/hr │ Retry 3x exponential │ Tags: [sales, crm]             │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Trigger Types (BR-AUTO-05)

| Type | Configuration |
|------|---------------|
| `event` | Domain event picker with JSON path filters |
| `schedule` | Cron builder + timezone |
| `webhook` | URL secret, payload schema validation |

### Action Types

| Action | Permission |
|--------|------------|
| Send notification | `automation:rules:write` |
| Update entity | `automation:rules:write` |
| Start workflow | `automation:workflows:execute` |
| HTTP webhook | `automation:advanced` |
| Invoke AI agent | `ai:agents:execute` |

### Validation

- Name required; version increment on publish.
- External webhook URL requires `automation:advanced` + domain allowlist.

### Responsive

| Breakpoint | Behavior |
|------------|----------|
| xs–sm | Vertical stack cards; no drag reorder (use move up/down) |
| md+ | Full builder with collapsible sections |

---

## UI-AUTO-003 — Workflow Designer (Visual BPMN)

**Route:** `/automation/workflows` (list) / `/automation/workflows/:id` (designer)  
**Permissions:** `automation:workflows:read` / `write`

### List View

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Workflows                                    [+ New workflow] [Import BPMN]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Name                  │ Version │ Status    │ Instances │ Updated             │
│ Invoice approval      │ v3      │ Published │ 12 active │ Jun 28              │
│ Employee onboarding   │ v1      │ Draft     │ 0         │ Jun 25              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Designer Canvas

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Workflow: Invoice approval v3 draft      [Save] [Validate] [Publish] [Simulate]│
├────────────────────────────┬─────────────────────────────────────────────────┤
│ BPMN PALETTE               │ CANVAS                              [minimap]   │
│ ○ Start                    │  (●)──▶[Submit]──▶◇──▶[Manager approve]──▶(●)  │
│ □ Task                     │              │                                   │
│ ◇ Gateway                  │              └──▶[Finance review]──┘           │
│ ⏱ Timer                    │                                                 │
│ 👤 User task               │ Selected: Manager approve                       │
│ ✉ Message                  ├─────────────────────────────────────────────────┤
│ ■ End                      │ PROPERTIES                                      │
│                            │ Assignee: [Manager role ▾]                      │
│                            │ SLA: [48] hours  Escalate: [Finance ▾]          │
│                            │ Form: [Approval form ▾]                         │
└────────────────────────────┴─────────────────────────────────────────────────┘
```

### BPMN Elements

| Element | Purpose |
|---------|---------|
| Start/End | Process boundaries |
| Service task | Automated system action |
| User task | Human approval (→ UI-AUTO-005) |
| Exclusive gateway | Conditional branch |
| Parallel gateway | Concurrent paths (token tracking BR-AUTO-06) |
| Timer boundary | SLA / escalation (BR-AUTO-07) |

Published definitions immutable (BR-AUTO-03). Edit → new draft version.

### Responsive

| Breakpoint | Behavior |
|------------|----------|
| xs–sm | Read-only diagram + step list editor |
| md | Canvas horizontal scroll |
| lg+ | Full designer with palette + properties |

---

## UI-AUTO-004 — Workflow Instances Monitor

**Route:** `/automation/instances`  
**Permissions:** `automation:workflows:read`

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Workflow Instances        [Workflow▾] [Status▾] [Entity▾]     [↻ Auto-refresh]│
├──────────────────────────────────────────────────────────────────────────────┤
│ Instance ID   │ Workflow           │ Entity          │ Status    │ Started    │
│ inst_a91      │ Invoice approval   │ Invoice #4421   │ ● Running │ Jun 29     │
│ inst_b22      │ Employee onboard   │ Employee #881   │ ⏸ Waiting │ Jun 28     │
│ inst_c33      │ Invoice approval   │ Invoice #4410   │ ✓ Complete│ Jun 27     │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Selected: inst_a91]                                                         │
│ Progress: ████████░░ Step 3/5 — Manager approve                              │
│ Token position: user_task_manager_approve                                    │
│ [View diagram] [View variables] [Cancel instance]                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

Instances correlated via `entity_type` + `entity_id` (BR-AUTO-04). Cancel requires `automation:workflows:execute`.

Live updates via SSE on lg+.

---

## UI-AUTO-005 — Approval Inbox

**Route:** `/automation/approvals`  
**Permissions:** `automation:approvals:read` / `resolve`

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Approval Inbox (5 pending)              [Mine▾] [Overdue only☐] [Refresh]    │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Invoice #4421 — Manager approval                                         │ │
│ │ Workflow: Invoice approval · Step: manager_approve · Due: 6h remaining   │ │
│ │ Amount: $12,450.00 · Submitted by: Bob                                   │ │
│ │ [View invoice] [View workflow] [Open form]                               │ │
│ │ [Approve]  [Reject]  [Reassign]                                          │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Purchase order #992 — Finance review          ⚠ OVERDUE                  │ │
│ │ ...                                                                      │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Reject** requires comment. **Reassign** → user/role picker. Expired → timeout path per workflow (BR-AUTO-07).

Badge in global nav; integrates with notification center.

---

## UI-AUTO-006 — Templates Gallery

**Route:** `/automation/templates`  
**Permissions:** `automation:rules:read` or `automation:workflows:read`

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Templates Gallery          [Rules◉] [Workflows]  [🔍]  Category: [All▾]    │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐                 │
│ │ 🔔 Deal won      │ │ 📧 Welcome email │ │ ✅ Invoice       │                 │
│ │ notify team      │ │ drip             │ │ approval flow    │                 │
│ │ Rule · CRM       │ │ Rule · Marketing │ │ Workflow · Fin   │                 │
│ │ [Use template]   │ │ [Use template]   │ │ [Use template]   │                 │
│ └──────────────────┘ └──────────────────┘ └──────────────────┘                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

Platform templates (`organization_id` NULL) + org templates. `Use template` → clones to new draft rule/workflow.

---

## UI-AUTO-007 — Execution Log

**Route:** `/automation/logs`  
**Permissions:** `automation:logs:read`

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Execution Log              [Type▾] [Status▾] [Date▾]  [🔍 Rule/workflow ID] │
├──────────────────────────────────────────────────────────────────────────────┤
│ Time       │ Type     │ Name              │ Status  │ Duration │ Trigger     │
│ 10:42:01   │ Rule     │ Notify on deal    │ Success │ 124ms    │ event       │
│ 10:41:55   │ Rule     │ SLA breach alert  │ Failed  │ 2.1s     │ schedule    │
│ 10:40:12   │ Workflow │ Invoice approval  │ Step OK │ 890ms    │ service     │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Expanded failure: inst_x — HTTP 429 webhook timeout]  [Retry] [View trace] │
└──────────────────────────────────────────────────────────────────────────────┘
```

Filter by rule ID, workflow instance, status (`success`, `failed`, `skipped`, `dry_run`). Export JSON on xl.

Retention: 90 days default (configurable `automation:manage`).

---

## Modals

### UI-AUTO-MOD-001 — Enable Rule Confirmation

**Trigger:** Enable toggle on high-impact rule (bulk update, external webhook)

```
┌─────────────────────────────────────────┐
│ Enable rule?                       [×]  │
├─────────────────────────────────────────┤
│ "Webhook to Slack" will:                │
│ • POST to external URL on every match   │
│ • Estimated 200 executions/day          │
│ [☑] I understand the impact             │
├─────────────────────────────────────────┤
│ [Cancel]              [Enable rule]     │
└─────────────────────────────────────────┘
```

---

### UI-AUTO-MOD-002 — Publish Workflow

**Trigger:** Designer `Publish`  
**Permissions:** `automation:workflows:write`

```
┌─────────────────────────────────────────┐
│ Publish workflow                   [×]  │
├─────────────────────────────────────────┤
│ Invoice approval v3                     │
│ Validation: ✓ 12 nodes ✓ 0 errors       │
│ Active instances on v2: 4               │
│ Migration: [Complete v2 then v3 ▾]      │
│ Release notes:                          │
│ [_________________________________]     │
├─────────────────────────────────────────┤
│ [Cancel]              [Publish]         │
└─────────────────────────────────────────┘
```

---

### UI-AUTO-MOD-003 — Dry Run Result

**Trigger:** Rule builder `Dry run`  
**Permissions:** `automation:rules:read`

Shows matched entities (sample 10), simulated actions (no side effects), estimated duration.

---

## Cross-Cutting Requirements

### Accessibility

- Rule builder: logical tab order through WHEN/IF/THEN.
- BPMN canvas: keyboard-navigable node list alternative.
- Status colors paired with icons.

### Localization

- Cron schedule displayed in user timezone with UTC tooltip.
- Notification templates respect locale of recipient.

### Performance

- Rules list virtualized > 200 rules.
- Instance monitor: paginated, default last 7 days.
- Log search uses OpenSearch.

### Security

- Webhook URLs masked in logs (show domain only).
- Dry run never calls external webhooks.
- Audit all enable/disable and publish actions.

### AI Integration

- "Describe automation" → AI drafts rule (requires `ai:agents:execute` + `automation:rules:write`).
- Workflow designer: suggest next step from template library.

---

## Screen Index

| ID | Name |
|----|------|
| UI-AUTO-001 | Rules List |
| UI-AUTO-002 | Rule Builder |
| UI-AUTO-003 | Workflow Designer |
| UI-AUTO-004 | Workflow Instances Monitor |
| UI-AUTO-005 | Approval Inbox |
| UI-AUTO-006 | Templates Gallery |
| UI-AUTO-007 | Execution Log |
| UI-AUTO-MOD-001 | Enable Rule Confirmation |
| UI-AUTO-MOD-002 | Publish Workflow |
| UI-AUTO-MOD-003 | Dry Run Result |