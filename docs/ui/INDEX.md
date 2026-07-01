---
title: Atlas UI Specification Index
document_id: ATLAS-UI-INDEX
version: 1.0.0
status: approved
phase: 4
last_updated: 2026-06-30
related_documents:
  - ATLAS-ARCH-INDEX
  - ATLAS-DB-INDEX
tags:
  - ui
  - specification
  - phase-4
---

# Atlas UI Specification Index

**Last Updated:** 2026-06-30  
**Phase:** 4 — UI Specification (**Complete:** docs 00–23)

---

## Phase 4 Summary

| Metric | Total |
|--------|-------|
| **Documents** | 24 (00–23 + INDEX) |
| **Screens** | **208** |
| **Modals** | **93** |
| **Drawers** | **8** |
| **Panels** | **3** |
| **Error pages** | **5** |
| **Empty state IDs** | **50+** |
| **Permission keys mapped** | **95+** |
| **Responsive patterns** | **47** |

---

## Document Registry

### Foundation & Shell

| # | Document | Module | Screens | Modals | Status |
|---|----------|--------|---------|--------|--------|
| 00 | [00-design-system.md](00-design-system.md) | Tokens, typography, components | 0 | 0 | **Approved** |
| 01 | [01-navigation-layout.md](01-navigation-layout.md) | App shell, global nav | 9 | — | **Approved** |
| 02 | [02-auth-onboarding.md](02-auth-onboarding.md) | Auth, onboarding | 15 | — | **Approved** |
| 03 | [03-platform-settings.md](03-platform-settings.md) | Org settings, members, roles | 16 | — | **Approved** |

### Core Business Modules

| # | Document | Module | Screens | Modals | Status |
|---|----------|--------|---------|--------|--------|
| 04 | [04-crm.md](04-crm.md) | CRM, contacts, deals, pipeline | 16 | 7 | **Approved** |
| 05 | [05-erp.md](05-erp.md) | ERP, inventory, orders | 15 | 15 | **Approved** |
| 06 | [06-finance.md](06-finance.md) | Finance, GL, invoices | 13 | 14 | **Approved** |
| 07 | [07-hr.md](07-hr.md) | HR, directory, time off | 8 | 13 | **Approved** |
| 08 | [08-projects.md](08-projects.md) | Projects, tasks, Gantt | 15 | 5 | **Approved** |
| 09 | [09-marketing.md](09-marketing.md) | Campaigns, segments, landing pages | 7 | 3 | **Approved** |
| 10 | [10-ai.md](10-ai.md) | AI command center, agents, memory | 9 | 6 | **Approved** |
| 11 | [11-knowledge-base.md](11-knowledge-base.md) | KB spaces, articles, help center | 7 | 3 | **Approved** |
| 12 | [12-automation.md](12-automation.md) | Rules, workflows, approvals | 7 | 3 | **Approved** |

### Platform Modules

| # | Document | Module | Screens | Modals | Drawers | Status |
|---|----------|--------|---------|--------|---------|--------|
| 13 | [13-marketplace.md](13-marketplace.md) | App Store, developer portal | 12 | 4 | 2 | **Approved** |
| 14 | [14-billing.md](14-billing.md) | Subscriptions, checkout, dunning | 10 | 3 | 1 | **Approved** |
| 15 | [15-notifications.md](15-notifications.md) | Inbox, preferences, templates | 8 | 0 | 2 | **Approved** |
| 16 | [16-documents.md](16-documents.md) | Files, sharing, versions, trash | 5 | 6 | 0 | **Approved** |
| 17 | [17-analytics.md](17-analytics.md) | Dashboards, reports, metrics | 6 | 0 | 3 | **Approved** |
| 21 | [21-messaging.md](21-messaging.md) | Channels, DMs, chat widget, email inbox | 9 | 3 | — | **Approved** |
| 22 | [22-support.md](22-support.md) | Tickets, SLA, portal, routing | 8 | 5 | — | **Approved** |
| 23 | [23-integrations.md](23-integrations.md) | Connectors, sync, webhooks, OAuth | 8 | 3 | — | **Approved** |

### Cross-Cutting

| # | Document | Scope | Screens | Notes | Status |
|---|----------|-------|---------|-------|--------|
| 18 | [18-mobile-tablet.md](18-mobile-tablet.md) | Responsive, PWA, offline | 0 | 47 patterns | **Approved** |
| 19 | [19-permissions-matrix.md](19-permissions-matrix.md) | RBAC UI visibility | 0 | 95+ permission keys | **Approved** |
| 20 | [20-empty-states-errors.md](20-empty-states-errors.md) | Empty, error, loading | 5 | 50+ empty states, 12 skeletons | **Approved** |

---

## Screen Count by Batch

| Batch | Docs | Screens | Modals | Drawers | Panels |
|-------|------|---------|--------|---------|--------|
| Foundation (00–03) | 4 | 40 | — | — | — |
| Core modules (04–12) | 9 | 97 | 69 | — | — |
| Platform modules (13–17) | 5 | 41 | 13 | 8 | — |
| Remaining modules (21–23) | 3 | 25 | 11 | — | 1 |
| Cross-cutting (18–20) | 3 | 5† | — | — | 2‡ |
| **Total** | **24** | **208** | **93** | **8** | **3** |

† Error pages only (404, 403, 500, 503, Offline).  
‡ Thread panel (UI-MSG-P001) + cross-cutting panel patterns in doc 20.

---

## Screen Count Detail — Docs 13–17 (Phase 4 Batch)

### 13 — Marketplace (12 screens, 4 modals)

| ID | Screen |
|----|--------|
| MP-S01 | App Catalog |
| MP-S02 | App Detail |
| MP-S03 | Install Flow |
| MP-S04 | Installed Apps |
| MP-S05 | Installed App Settings |
| MP-S06 | Developer Dashboard |
| MP-S07 | Submit App |
| MP-S08 | Version Manager |
| MP-S09 | Developer Analytics |
| MP-S10 | App Reviews List |
| MP-S11 | Write Review |
| MP-S12 | Permissions Grant |

**Modals:** Install App, Uninstall, Grant Permissions, Submit for Review

### 14 — Billing (10 screens, 3 modals)

| ID | Screen |
|----|--------|
| BL-S01 | Plan Selection |
| BL-S02 | Checkout |
| BL-S03 | Subscription Management |
| BL-S04 | Usage Dashboard |
| BL-S05 | Invoice History |
| BL-S06 | Invoice Detail |
| BL-S07 | Payment Methods |
| BL-S08 | Upgrade/Downgrade Flow |
| BL-S09 | Dunning / Retry Payment |
| BL-S10 | Billing Settings |

**Modals:** Add Payment Method, Cancel Subscription, Change Plan

### 15 — Notifications (8 screens)

| ID | Screen |
|----|--------|
| NT-S01 | Notification Center |
| NT-S02 | Notification Detail |
| NT-S03 | Notification Preferences |
| NT-S04 | Per-Module Preferences |
| NT-S05 | Template Management |
| NT-S06 | Template Editor |
| NT-S07 | Digest Settings |
| NT-S08 | Email Preview |

**Patterns:** Toast (5 variants), Push notification spec

### 16 — Documents (5 screens, 6 modals)

| ID | Screen |
|----|--------|
| DC-S01 | File Browser |
| DC-S02 | File Preview |
| DC-S03 | Upload Flow |
| DC-S04 | Version History |
| DC-S05 | Trash / Recovery |

**Modals:** Share, Move, Rename, Delete, Restore Version, Create Folder

### 17 — Analytics (6 screens, 3 drawers)

| ID | Screen |
|----|--------|
| AN-S01 | Home Dashboard |
| AN-S02 | Report Builder |
| AN-S03 | Metric Explorer |
| AN-S04 | Dashboard Gallery |
| AN-S05 | Export Scheduler |
| AN-S06 | Embedded Analytics (pattern) |

**Widget types:** KPI, Chart, Table, Funnel, Map

---

## Screen Count Detail — Docs 21–23 (Remaining Modules)

### 21 — Messaging (9 screens, 3 modals, 1 panel)

| ID | Screen / Surface |
|----|----------------|
| UI-MSG-001 | Channel List |
| UI-MSG-002 | Channel View |
| UI-MSG-003 | DM List |
| UI-MSG-004 | DM Conversation |
| UI-MSG-005 | Search Messages |
| UI-MSG-006 | Channel Settings |
| UI-MSG-007 | Notification Prefs (per channel) |
| UI-MSG-008 | Customer Chat Widget |
| UI-MSG-009 | Email Inbox Integration |

**Modals:** Create Channel (M001), File Attach (M002), Invite Members (M003)  
**Panel:** Thread Panel (P001)  
**Patterns:** Message composer, Emoji picker, @mentions

### 22 — Support (8 screens, 5 modals)

| ID | Screen |
|----|--------|
| UI-SUP-001 | Ticket Inbox (list/kanban) |
| UI-SUP-002 | Ticket Detail |
| UI-SUP-003 | Create Ticket |
| UI-SUP-004 | Customer Portal |
| UI-SUP-005 | SLA Dashboard |
| UI-SUP-006 | Canned Responses |
| UI-SUP-007 | Assignment Rules |
| UI-SUP-008 | Support Settings |

**Modals:** Assign Agent (M001), Escalate (M002), Merge Tickets (M003), Add Internal Note (M004), Send Reply (M005)

### 23 — Integrations (8 screens, 3 modals)

| ID | Screen |
|----|--------|
| UI-INT-001 | Integration Marketplace (connected apps) |
| UI-INT-002 | Connector Config Wizard |
| UI-INT-003 | Sync Status Dashboard |
| UI-INT-004 | Field Mapping UI |
| UI-INT-005 | Webhook Subscriptions |
| UI-INT-006 | OAuth App Management |
| UI-INT-007 | Sync Conflict Resolver |
| UI-INT-008 | Integration Logs |

**Pre-built connectors:** QuickBooks, Xero, Salesforce, Google Workspace, Microsoft 365, Slack  
**Modals:** Disconnect Connector (M001), Test Webhook (M002), Quick Resolve Conflict (M003)

---

## Cross-Reference Map

```
┌─────────────────────────────────────────────────────────────┐
│              01-navigation-layout.md (App Shell)             │
├────────────┬────────────┬────────────┬───────────────────────┤
│ 19-perms   │ 20-empty   │ 18-mobile  │ Module specs 04–17,   │
│ matrix     │ /errors    │ /tablet    │ 21–23 Feature screens │
├────────────┴────────────┴────────────┴───────────────────────┤
│                  00-design-system.md (Tokens)                │
└─────────────────────────────────────────────────────────────┘
```

Every module document references:

- `19-permissions-matrix.md` — permission gates and visibility rules
- `20-empty-states-errors.md` — empty state IDs, skeletons, errors
- `18-mobile-tablet.md` — breakpoint and touch adaptations

### Module Cross-Links (21–23)

| From | To | Link |
|------|-----|------|
| Messaging (21) | Notifications (15) | @mention → notification delivery |
| Messaging (21) | Support (22) | Chat widget → ticket creation |
| Messaging (21) | Integrations (23) | Slack connector notification routing |
| Support (22) | CRM (04) | Customer 360° sidebar |
| Support (22) | Knowledge Base (11) | Portal deflection + macro KB insert |
| Support (22) | Messaging (21) | Email inbox + chat widget intake |
| Integrations (23) | Marketplace (13) | App discovery vs runtime connector mgmt |
| Integrations (23) | Finance (06) | QuickBooks / Xero sync |
| Integrations (23) | CRM (04) | Salesforce sync |

---

## Document Conventions

| Convention | Rule |
|------------|------|
| Screen IDs | `{PREFIX}-S{NN}` or `UI-{MODULE}-{NNN}` |
| Modal IDs | `{PREFIX}-M{NN}` or `UI-{MODULE}-M{NNN}` |
| Drawer IDs | `{PREFIX}-D{NN}` |
| Panel IDs | `UI-{MODULE}-P{NNN}` |
| Empty state IDs | `ES-{MODULE}-{NNN}` |
| Skeleton IDs | `SKEL-{NN}` |
| Error page IDs | `ES-ERR-{code}` |
| Permission keys | `{module}:{resource}:{action}` |
| Front matter | YAML with `document_id: ATLAS-UI-{NN}` |

---

## Related Documentation

| Phase | Location | Relevance |
|-------|----------|-----------|
| Phase 1 | `docs/architecture/phase-1/` | Auth, storage, notifications, messaging, integrations architecture |
| Phase 2 | `docs/architecture/phase-2/01-prd.md` | Feature requirements per module |
| Phase 3 | `docs/database/` | Schema alignment for data models |
| Phase 5 | `docs/api/` | API contracts referenced in screen specs |

---

## Phase 4 Completion Checklist

| Criterion | Status |
|-----------|--------|
| All business architecture modules have UI specs | ✅ Complete (00–23) |
| Screen IDs assigned | ✅ 208 screens documented |
| Wireframes for primary flows | ✅ All module docs |
| Permission gates mapped | ✅ 95+ keys |
| Responsive breakpoints defined | ✅ 47 patterns + per-module |
| Empty states and errors cross-referenced | ✅ Doc 20 |
| Document status | ✅ All docs **Approved** |