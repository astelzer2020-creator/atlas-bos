---
title: Integrations UI Specification
document_id: ATLAS-UI-23
version: 1.0.0
status: approved
phase: 4
last_updated: 2026-06-30
module: integrations
related_documents:
  - ATLAS-DB-20
  - ATLAS-ARCH-11
  - ATLAS-UI-13
  - ATLAS-UI-19
  - ATLAS-UI-18
  - ATLAS-UI-20
tags:
  - integrations
  - connectors
  - oauth
  - webhooks
  - sync
  - field-mapping
  - wireframes
---

# Integrations UI Specification

## Document Control

| Field | Value |
|-------|-------|
| **Module** | Integrations |
| **Screen count** | 8 screens, 3 modals |
| **Pre-built connectors** | QuickBooks, Xero, Salesforce, Google Workspace, Microsoft 365, Slack |
| **Primary personas** | P2 (Admin), P1 (SMB Owner), Developer Partner |
| **Route prefix** | `/settings/integrations`, `/developer/oauth` |

---

## 1. Purpose & Scope

Define all user-facing surfaces for the Atlas Integration Platform: connector marketplace, configuration wizards, sync health monitoring, field mapping, webhook management, OAuth app administration, conflict resolution, and operational logs. Complements Marketplace UI (`13-marketplace.md`) with runtime connector management. Aligns with `integrations.*` schema and `ATLAS-ARCH-11`.

### In Scope

- Connected apps marketplace view (installed + available connectors)
- Multi-step connector configuration wizard
- Sync status dashboard with per-connector health
- Visual field mapping UI
- Webhook subscription management (inbound + outbound)
- OAuth application management (org-level and developer)
- Sync conflict resolver queue
- Integration activity and error logs

### Out of Scope

- Marketplace app discovery/reviews (doc 13)
- iPaaS visual workflow designer (Automation module)
- Custom connector SDK documentation (developer docs site)

---

## 2. Navigation & Information Architecture

```
Settings → Integrations
├── Connected Apps (/settings/integrations)           → UI-INT-001
│   └── Connector wizard                            → UI-INT-002
├── Sync Dashboard (/settings/integrations/sync)      → UI-INT-003
├── Field Mappings (/settings/integrations/mappings)  → UI-INT-004
├── Webhooks (/settings/integrations/webhooks)        → UI-INT-005
├── OAuth Apps (/settings/integrations/oauth)         → UI-INT-006
├── Conflicts (/settings/integrations/conflicts)      → UI-INT-007
└── Logs (/settings/integrations/logs)                → UI-INT-008

Developer Portal (cross-link)
└── OAuth app registration                            → UI-INT-006 (developer mode)
```

### Entry Points

| Source | Destination | Condition |
|--------|-------------|-----------|
| Settings → Integrations | UI-INT-001 | `integrations:connectors:read` |
| Finance → Connect accounting | UI-INT-002 (QuickBooks/Xero) | `integrations:connectors:manage` |
| CRM → Import from Salesforce | UI-INT-002 (Salesforce) | `integrations:connectors:manage` |
| Alert banner "Sync failed" | UI-INT-003 | `integrations:sync:read` |
| Marketplace installed app | UI-INT-001 filtered | `marketplace:installations:read` |

---

## 3. Screen Inventory

| ID | Screen | Route | Permission gate |
|----|--------|-------|-----------------|
| UI-INT-001 | Integration Marketplace | `/settings/integrations` | `integrations:connectors:read` |
| UI-INT-002 | Connector Config Wizard | `/settings/integrations/connect/:connectorId/setup` | `integrations:connectors:manage` |
| UI-INT-003 | Sync Status Dashboard | `/settings/integrations/sync` | `integrations:sync:read` |
| UI-INT-004 | Field Mapping UI | `/settings/integrations/mappings/:connectionId` | `integrations:mapping:manage` |
| UI-INT-005 | Webhook Subscriptions | `/settings/integrations/webhooks` | `integrations:webhooks:read` |
| UI-INT-006 | OAuth App Management | `/settings/integrations/oauth` | `integrations:oauth:manage` |
| UI-INT-007 | Sync Conflict Resolver | `/settings/integrations/conflicts` | `integrations:conflicts:resolve` |
| UI-INT-008 | Integration Logs | `/settings/integrations/logs` | `integrations:logs:read` |

### Modals

| ID | Surface | Trigger |
|----|---------|---------|
| UI-INT-M001 | Disconnect Connector | Disconnect on UI-INT-001 or UI-INT-003 |
| UI-INT-M002 | Test Webhook | Send test on UI-INT-005 |
| UI-INT-M003 | Quick Resolve Conflict | Resolve action on UI-INT-007 row |

---

## 4. Permissions Matrix

| Permission | UI Effect |
|------------|-----------|
| `integrations:connectors:read` | View marketplace and connection status |
| `integrations:connectors:manage` | Connect, configure, disconnect connectors |
| `integrations:sync:read` | View sync dashboard and history |
| `integrations:sync:manage` | Trigger manual sync, pause/resume |
| `integrations:mapping:manage` | Edit field mappings |
| `integrations:webhooks:read` | View webhook subscriptions |
| `integrations:webhooks:manage` | Create/edit/delete webhooks |
| `integrations:oauth:manage` | Manage OAuth apps and tokens |
| `integrations:conflicts:resolve` | Resolve sync conflicts |
| `integrations:logs:read` | View integration logs |
| `admin:integrations:manage` | Org-wide revoke-all, credential rotation |
| `platform:integrations:read` | View-only for non-admin roles |
| `platform:integrations:manage` | Alias for admin integration settings |

---

## 5. Pre-Built Connectors

| Connector | Atlas modules synced | Auth method | Wizard steps |
|-----------|---------------------|-------------|--------------|
| **QuickBooks** | Finance (invoices, payments, COA) | OAuth 2.0 | Auth → Company select → Entity mapping → Schedule |
| **Xero** | Finance (invoices, bills, contacts) | OAuth 2.0 | Auth → Org select → Mapping → Schedule |
| **Salesforce** | CRM (accounts, contacts, opportunities) | OAuth 2.0 | Auth → Object select → Field mapping → Sync direction |
| **Google Workspace** | Docs, Calendar, Directory | OAuth 2.0 | Auth → Service toggles → User scope → Confirm |
| **Microsoft 365** | Docs, Calendar, Teams notify | OAuth 2.0 | Auth → Tenant consent → Service toggles → Confirm |
| **Slack** | Messaging (notifications), Automation | OAuth 2.0 | Auth → Channel mapping → Notification routing |

Each connector card shows: logo, description, modules affected, sync direction icon (↔, →, ←), setup time estimate.

---

## 6. Screen Specifications

### UI-INT-001 — Integration Marketplace (Connected Apps)

**Route:** `/settings/integrations`

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Integrations                              [🔍 Search connectors...]           │
├──────────────────────────────────────────────────────────────────────────────┤
│ CONNECTED (4)                                                                 │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │ [QB logo]    │ │ [SF logo]    │ │ [Google]     │ │ [Slack]      │        │
│ │ QuickBooks ● │ │ Salesforce ● │ │ Workspace ●  │ │ Slack ●      │        │
│ │ Synced 5m ago│ │ Synced 1h ago│ │ ⚠ Token exp. │ │ Connected    │        │
│ │ [Configure]  │ │ [Configure]  │ │ [Reconnect]  │ │ [Configure]  │        │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘        │
├──────────────────────────────────────────────────────────────────────────────┤
│ AVAILABLE CONNECTORS                                                          │
│ [All] [Finance] [CRM] [Productivity] [Communication]                        │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                           │
│ │ Xero         │ │ Microsoft365 │ │ More apps →  │                           │
│ │ [Connect]    │ │ [Connect]    │ │ Marketplace  │                           │
│ └──────────────┘ └──────────────┘ └──────────────┘                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Connection Status Badges

| Status | Color | Meaning |
|--------|-------|---------|
| `connected` | Green dot | Healthy, syncing |
| `syncing` | Blue pulse | Active sync job |
| `warning` | Amber | Token expiring, partial errors |
| `error` | Red | Auth failed or sync halted |
| `paused` | Gray | Admin paused sync |

#### Card Actions

| Action | Permission |
|--------|------------|
| Connect | `integrations:connectors:manage` |
| Configure | `integrations:connectors:manage` |
| View logs | `integrations:logs:read` |
| Disconnect | `integrations:connectors:manage` |

---

### UI-INT-002 — Connector Config Wizard

**Route:** `/settings/integrations/connect/:connectorId/setup`

Multi-step stepper; progress persisted if user navigates away.

#### Wireframe — Step 3 (Field Mapping preview)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Connect QuickBooks                                                            │
│ ●━━━━━●━━━━━●━━━━━○━━━━━○  Step 3 of 5: Map entities                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Atlas entity        Direction    External entity                              │
│ Invoice             →            QBO Invoice                                  │
│ Payment             ↔            QBO Payment                                  │
│ Contact             ←            QBO Customer                                   │
│ [+ Add mapping]                                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                              [← Back]  [Next: Field mapping →]                │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Wizard Steps (generic)

| Step | Content |
|------|---------|
| 1. Authorize | OAuth redirect or API key input; consent scope display |
| 2. Select account | External org/company picker |
| 3. Entity mapping | Which objects sync both directions |
| 4. Field mapping | Link to UI-INT-004 inline or embedded |
| 5. Schedule | Sync frequency, conflict policy default |
| 6. Review | Summary + initial sync options (full vs incremental) |

#### OAuth Flow UX

- Popup or redirect with return deep link
- Error states: denied, expired, insufficient scope — actionable retry
- Credential stored in vault; never display secrets after save

---

### UI-INT-003 — Sync Status Dashboard

**Route:** `/settings/integrations/sync`

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sync Status                    [Last 24h ▼]  [Connector: All ▼]  [Refresh]   │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│ │ Healthy    │ │ Syncing    │ │ Warnings   │ │ Errors     │               │
│ │ 3          │ │ 1          │ │ 1          │ │ 0          │               │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘               │
├──────────────────────────────────────────────────────────────────────────────┤
│ Connector    │ Status   │ Last sync  │ Records │ Lag    │ Actions           │
│ QuickBooks   │ ● OK     │ 5m ago     │ 1,240   │ <1m    │ [Sync now] [⋮]  │
│ Salesforce   │ ◐ Running│ —          │ 342/500 │ —      │ [View job]        │
│ Google WS    │ ⚠ Warn   │ 2h ago     │ 89      │ 45m    │ [Reconnect]       │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Job Detail Drawer

- Timeline: queued → fetching → transforming → writing → complete
- Record counts: created, updated, skipped, failed
- Error samples with link to UI-INT-008
- Actions: Retry failed, Pause sync, Full resync (confirm destructive)

---

### UI-INT-004 — Field Mapping UI

**Route:** `/settings/integrations/mappings/:connectionId`

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Field Mapping — QuickBooks › Invoices          [Entity: Invoice ▼] [Save]   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Atlas field              Transform         QuickBooks field        Required │
│ invoice_number           —                 DocNumber                 ✓       │
│ total_amount             currency_convert  TotalAmt                  ✓       │
│ due_date                 —                 DueDate                   ✓       │
│ customer_id              lookup(contact)   CustomerRef              ✓       │
│ notes                    truncate(500)     PrivateNote               ○       │
│ [+ Add field mapping]                                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ Preview: [Run preview sync — 10 records]                                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Mapping Controls

| Control | Purpose |
|---------|---------|
| Drag-connect | Visual line between field columns (optional graph mode) |
| Transform | Dropdown: none, format date, currency, lookup, custom expression |
| Required | Validation before save; block sync if unmapped |
| Default value | Fallback when source null |
| Sync direction | Per-field: → Atlas, ← External, ↔ Both |

Expression editor: monospace with variable autocomplete; validated server-side.

---

### UI-INT-005 — Webhook Subscriptions

**Route:** `/settings/integrations/webhooks`

#### Sections

**Outbound (Atlas → subscriber)**

| Column | Notes |
|--------|-------|
| Endpoint URL | HTTPS required |
| Events | Multi-select from catalog |
| Secret | Rotate action; show once on create |
| Status | Active / failing / disabled |
| Last delivery | Timestamp + status code |

**Inbound (provider → Atlas)**

- Webhook URL display with copy button
- Signature verification key
- Provider-specific setup instructions accordion

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Webhooks                              [Outbound ●] [Inbound]  [+ Subscribe]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Endpoint                          │ Events          │ Status │ Last    │ ⋮  │
│ https://api.acme.com/atlas-hooks  │ invoice.* (3)   │ ● OK   │ 2m ago  │ ⋮  │
│ https://hooks.zapier.com/...      │ contact.created │ ⚠ Fail │ 1h ago  │ ⋮  │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Delivery Log (row expand)

Request payload hash, response code, latency, retry count, next retry time.

---

### UI-INT-006 — OAuth App Management

**Route:** `/settings/integrations/oauth`

#### Admin View (org-connected apps)

Table of authorized OAuth grants: app name, scopes, authorized by, expires, revoke action.

#### Developer View (toggle if `marketplace:developer:access`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ OAuth Applications                              [+ Register application]       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Name           │ Client ID    │ Redirect URIs │ Scopes        │ Status │ ⋮   │
│ Acme Sync Tool │ app_abc123…  │ 2 URIs        │ crm:read (2)  │ Active │ ⋮   │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### App Detail

- Client ID (copy), Client secret (rotate, reveal once)
- Redirect URI list (add/remove)
- Scope checklist grouped by module
- Rate limit tier display
- Sandbox tenant link

---

### UI-INT-007 — Sync Conflict Resolver

**Route:** `/settings/integrations/conflicts`

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sync Conflicts (14)               [Connector ▼] [Entity ▼] [Bulk resolve]   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Entity      │ Record        │ Field     │ Atlas value │ External │ Detected │
│ Contact     │ Jane Smith    │ email     │ j@acme.com  │ jane@... │ 2h ago   │
│ Invoice     │ INV-4521      │ total     │ $1,200.00   │ $1,250   │ 1d ago   │
├──────────────────────────────────────────────────────────────────────────────┤
│ RESOLUTION PANEL (selected row)                                               │
│ ○ Keep Atlas value    ○ Keep external value    ○ Merge manually              │
│ [Atlas] j@acme.com     [External] jane.smith@acme.com                        │
│                              [Apply to this] [Apply to all similar]         │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Conflict Policies (org default in wizard)

| Policy | Behavior |
|--------|----------|
| Atlas wins | Auto-resolve; log only |
| External wins | Auto-resolve; log only |
| Newest wins | Compare `updated_at` |
| Manual | Queue in UI-INT-007 |

---

### UI-INT-008 — Integration Logs

**Route:** `/settings/integrations/logs`

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Integration Logs     [🔍] [Level ▼] [Connector ▼] [Date range]  [Export]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Time       │ Level │ Connector  │ Event                    │ Details        │
│ 10:42:01   │ ERROR │ Salesforce │ contact.sync.failed      │ [View]         │
│ 10:41:55   │ INFO  │ QuickBooks │ invoice.sync.completed   │ 42 records     │
│ 10:40:12   │ WARN  │ Google WS  │ token.expiring_soon      │ 7d remaining   │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Log Detail Drawer

- Correlation ID (copy)
- Full error stack (admin only)
- Related sync job link → UI-INT-003
- Payload redaction: PII masked per policy

Retention: 90 days default; Enterprise 1 year.

---

## 7. Modal Specifications

### UI-INT-M001 — Disconnect Connector

```
┌─────────────────────────────────────────┐
│ Disconnect QuickBooks?            [×]   │
├─────────────────────────────────────────┤
│ This will stop all syncing with         │
│ QuickBooks. Existing data in Atlas       │
│ will be preserved.                      │
│ ☐ Revoke OAuth tokens immediately       │
│ ☐ Delete field mappings                   │
│ Type DISCONNECT to confirm              │
│ [________________]                      │
│         [Cancel]  [Disconnect]          │
└─────────────────────────────────────────┘
```

Destructive confirm requires typing connector name.

### UI-INT-M002 — Test Webhook

- Select sample event type
- Preview payload JSON
- Send test → show response status, headers, body
- `200` success toast; failure shows retry guidance

### UI-INT-M003 — Quick Resolve Conflict

Compact modal for single-field conflicts from UI-INT-003 error links. Radio pick + apply.

---

## 8. Responsive Behavior

| Breakpoint | Adaptation |
|------------|------------|
| Mobile | Connector cards single column; wizard steps full-screen |
| Tablet | Mapping UI stacked columns |
| Desktop | Full dashboard tables with expandable rows |

Settings section inherits app shell from `01-navigation-layout.md`.

---

## 9. Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Status badges | Icon + text label |
| Wizard | `aria-current="step"` on stepper |
| Mapping table | Keyboard-navigable row actions |
| OAuth flows | Focus return to opener on popup close |

---

## 10. Telemetry Events

| Event | Properties |
|-------|------------|
| `integrations.connector.connected` | `connector_id`, `modules` |
| `integrations.connector.disconnected` | `connector_id`, `reason` |
| `integrations.sync.started` | `connector_id`, `sync_type` |
| `integrations.sync.completed` | `records_processed`, `duration_ms`, `errors` |
| `integrations.conflict.resolved` | `entity`, `resolution`, `bulk` |
| `integrations.webhook.delivery_failed` | `endpoint_hash`, `status_code` |
| `integrations.mapping.saved` | `connection_id`, `field_count` |

---

## 11. Open Questions

| ID | Question | Owner |
|----|----------|-------|
| OQ-UI-23-01 | Visual drag-drop mapping vs table-only for v1? | Design |
| OQ-UI-23-02 | Self-service custom connector builder? | v2 |
| OQ-UI-23-03 | HubSpot as pre-built connector in v1? | GTM |