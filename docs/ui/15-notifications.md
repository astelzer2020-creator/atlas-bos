---
title: Notifications UI Specification
document_id: ATLAS-UI-15
version: 1.0.0
status: approved
phase: 4
last_updated: 2026-06-30
module: notifications
related_documents:
  - ATLAS-DB-17
  - ATLAS-ARCH-10
  - ATLAS-UI-19
  - ATLAS-UI-18
  - ATLAS-UI-20
tags:
  - notifications
  - inbox
  - preferences
  - toast
  - push
  - email
  - digest
---

# Notifications UI Specification

## Document Control

| Field | Value |
|-------|-------|
| **Module** | Notifications |
| **Screen count** | 8 screens, 0 modals, 2 drawers |
| **Pattern sections** | Toast, Push, Email preview |
| **Primary personas** | P3 (Employee), P2 (Admin), P6 (Support Agent) |
| **Route prefix** | `/notifications`, `/settings/notifications` |

---

## 1. Purpose & Scope

Define notification delivery surfaces: in-app inbox, preference management, admin template tooling, digest configuration, toast patterns, push notification specs, and email preview. Aligns with `notifications.*` schema.

### In Scope

- Multi-channel preference UI (in-app, email, push, SMS, Slack, Teams)
- Per-module and per-event-type granularity
- Admin template management with versioning
- Real-time toast and push specifications
- Digest batching settings

### Out of Scope

- Notification provider configuration (ops console)
- SMS opt-in compliance flows (Phase 5 — TCPA)
- Slack/Teams app installation (Integrations module)

---

## 2. Navigation & Information Architecture

```
Global Shell
├── Notification Bell → Inbox dropdown (quick) / Full inbox (NT-S01)
└── Toast region (bottom-right, fixed)

Settings → Notifications (/settings/notifications)
├── Preferences (/settings/notifications)           → NT-S03
├── By Module (/settings/notifications/modules)     → NT-S04
├── Digest (/settings/notifications/digest)           → NT-S06
└── Channels (/settings/notifications/channels)     → Push/SMS setup

Admin → Notification Templates (/admin/notifications/templates)
├── Template List                                     → NT-S05
├── Template Editor                                   → NT-S06
└── Email Preview                                     → NT-S08
```

---

## 3. Screen Inventory

| ID | Screen | Route | Permission gate |
|----|--------|-------|-----------------|
| NT-S01 | Notification Center (Inbox) | `/notifications` | Authenticated |
| NT-S02 | Notification Detail | `/notifications/:id` | Owner of notification |
| NT-S03 | Notification Preferences | `/settings/notifications` | Authenticated |
| NT-S04 | Per-Module Preferences | `/settings/notifications/modules/:module` | Authenticated |
| NT-S05 | Template Management (Admin) | `/admin/notifications/templates` | `admin:notifications:manage` |
| NT-S06 | Template Editor | `/admin/notifications/templates/:id` | `admin:notifications:manage` |
| NT-S07 | Digest Settings | `/settings/notifications/digest` | Authenticated |
| NT-S08 | Email Preview | `/admin/notifications/templates/:id/preview` | `admin:notifications:manage` |

### Drawers

| ID | Surface | Trigger |
|----|---------|---------|
| NT-D01 | Quick Inbox | Bell icon click |
| NT-D02 | Notification Detail | Click item in NT-D01 or NT-S01 |

---

## 4. Global Patterns

### 4.1 Notification Bell (Shell Component)

```
[🔔]  ← Badge: unread count (max "99+")
```

| State | Behavior |
|-------|----------|
| Unread > 0 | Red badge, pulse on new (once per session) |
| Click | Open NT-D01 quick inbox |
| Shift+click | Navigate to NT-S01 full inbox |
| Keyboard | `Alt+N` opens quick inbox |

Real-time: SSE or WebSocket `notification.received` event increments badge.

### 4.2 Notification Item Component

```
┌────────────────────────────────────────────────────────┐
│ [Module icon]  Title of notification          2h ago  ●│
│                Preview text truncated to 80 chars...   │
│                [Action button]              [Dismiss]  │
└────────────────────────────────────────────────────────┘
```

| Property | Spec |
|----------|------|
| Unread indicator | Blue dot (●); not color-only — bold title |
| Priority `critical` | Left border red, pin to top |
| Avatar | For person-triggered notifications |
| Actions | Max 2 inline buttons (primary action + dismiss) |
| Swipe (mobile) | Right: mark read; Left: dismiss |

### 4.3 Channel Preference Matrix

Standard control per notification type:

| Channel | Control | Override rules |
|---------|---------|----------------|
| In-app | Toggle | Cannot disable `critical` |
| Email | Toggle | Transactional may override per policy |
| Push | Toggle | Requires device registration |
| SMS | Toggle | Requires verified phone |
| Slack | Toggle | Requires workspace connection |
| Digest | Checkbox | Only if `digest_eligible` |

---

## 5. Screen Specifications

### NT-S01 — Notification Center (Inbox)

**Route:** `/notifications`

#### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Notifications                    [Mark all read] [Settings] │
├──────────────┬──────────────────────────────────────────────┤
│ Filters      │ Notification list                            │
│ ───────────  │ ┌──────────────────────────────────────────┐│
│ All          │ │ Item                                      ││
│ Unread (12)  │ │ Item                                      ││
│ ───────────  │ │ ...                                       ││
│ By Module    │ │ [Load more]                               ││
│ CRM          │ └──────────────────────────────────────────┘│
│ Finance      │                                              │
│ Projects     │                                              │
│ ...          │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

#### Filters

| Filter | Behavior |
|--------|----------|
| All / Unread | Tab toggle |
| Module | Multi-select chips |
| Date | Today, 7d, 30d, Custom |
| Priority | Critical, High, Normal, Low |
| Search | Full-text on title + body |

#### Bulk Actions

- Mark selected as read
- Dismiss selected
- Select all on page

#### Pagination

- Cursor-based, 50 per page
- Infinite scroll on mobile

#### Empty States

| State | ID |
|-------|-----|
| No notifications | ES-NT-001 |
| No unread | ES-NT-002 |
| Filtered empty | ES-NT-003 |

---

### NT-S02 — Notification Detail

**Route:** `/notifications/:id`  
**Also:** NT-D02 drawer (right panel, 480px).

#### Content

- Full title, timestamp (absolute + relative)
- Module badge, priority indicator
- Rendered body (Markdown subset)
- Related entity link (e.g., "View invoice #1234")
- Action buttons (same as inbox item)
- Delivery log (admin only): channels attempted, status

#### Deep Linking

Notifications include `action_url` — primary CTA navigates and marks read.

---

### NT-S03 — Notification Preferences (Global)

**Route:** `/settings/notifications`

#### Sections

1. **Global toggles** — Master email, push, SMS off switches
2. **Quiet hours** — Start/end time, timezone, days of week
3. **Critical alerts** — Info: "Critical alerts always delivered in-app"
4. **Quick links** — Per-module preferences, Digest settings
5. **Channel setup** — Push devices, SMS phone, Slack/Teams

#### Quiet Hours UI

```
Quiet hours: [ON]
From: [10:00 PM ▼]  To: [7:00 AM ▼]  Timezone: [Auto-detect ▼]
Applies to: ☑ Email  ☑ Push  ☐ SMS  ☐ In-app
```

Non-critical notifications queued until quiet hours end (or next digest).

---

### NT-S04 — Per-Module Preferences

**Route:** `/settings/notifications/modules/:module`

#### Layout

Table of notification event types for module:

| Event | In-app | Email | Push | Digest |
|-------|--------|-------|------|--------|
| New lead assigned | ✓ | ✓ | ✓ | ☐ |
| Deal won | ✓ | ✓ | ☐ | ✓ |
| Contact updated | ✓ | ☐ | ☐ | ☐ |

- "Reset to defaults" per module
- Locked rows (🔒) for transactional/legal — tooltip explains override
- Bulk: "Enable all email for CRM"

---

### NT-S05 — Template Management (Admin)

**Route:** `/admin/notifications/templates`  
**Gate:** `admin:notifications:manage`

#### Table

| Column | Notes |
|--------|-------|
| Template code | e.g., `crm.deal_won` |
| Name | Human-readable |
| Channels | Icons for active channels |
| Version | Current version number |
| Status | `active`, `draft`, `deprecated` |
| Last updated | Timestamp |
| Actions | Edit, Preview, History |

#### Filters

- Module, channel, status, search

---

### NT-S06 — Template Editor

**Route:** `/admin/notifications/templates/:id`

#### Editor Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Template: Deal Won                    [Save draft] [Publish]│
├────────────────────────┬────────────────────────────────────┤
│ Subject line           │ Variables sidebar                  │
│ [{{deal.name}} won!]   │ • deal.name                        │
│                        │ • deal.amount                      │
│ Body (rich text)       │ • user.first_name                  │
│ [Editor area...]       │ • org.name                         │
│                        │                                    │
│ Channel: Email ▼       │ Preview → NT-S08                   │
│ Locale: en-US ▼        │                                    │
└────────────────────────┴────────────────────────────────────┘
```

#### Features

- Variable insertion via sidebar click
- Subject + body per channel (tabs: Email, Push, In-app, SMS)
- Character count for SMS (160/segment)
- Version history sidebar — diff view between versions
- Publish creates new immutable version; previous deprecated after grace period

#### Validation

- Unclosed `{{variables}}` highlighted
- Required variables per template schema enforced
- Test send to admin email

---

### NT-S07 — Digest Settings

**Route:** `/settings/notifications/digest`

#### Digest Options

| Setting | Control |
|---------|---------|
| Enable digest | Master toggle |
| Frequency | Daily, Weekly (day picker), Never |
| Delivery time | Time picker (local timezone) |
| Modules included | Multi-select checkboxes |
| Format | Summary (default), Detailed |

#### Preview

"Sample digest" button renders last 24h notifications grouped by module.

---

### NT-S08 — Email Preview

**Route:** `/admin/notifications/templates/:id/preview`

#### Features

- Rendered HTML email in iframe sandbox
- Sample data injection (editable JSON panel for admins)
- Device preview toggle: Desktop / Mobile (375px)
- Dark mode preview (if template supports)
- Send test email input
- Plain-text version tab

---

## 6. Toast Patterns

### 6.1 Toast Container

| Property | Value |
|----------|-------|
| Position | Bottom-right, 24px offset |
| Max visible | 3 stacked |
| Z-index | 9000 (below modals) |
| Animation | Slide in 200ms, auto-dismiss progress bar |

### 6.2 Toast Variants

| Variant | Icon | Duration | Dismissible |
|---------|------|----------|-------------|
| `success` | ✓ checkmark | 5s | Yes |
| `info` | ℹ info | 5s | Yes |
| `warning` | ⚠ warning | 8s | Yes |
| `error` | ✕ error | Persistent | Yes |
| `action` | — | 8s | Yes + action button |

### 6.3 Toast Anatomy

```
┌─────────────────────────────────────────────┐
│ [Icon] Title text                      [×]  │
│        Optional description line            │
│        [Action Label]                       │
│ ▓▓▓▓▓▓▓▓▓░░░░░░░░░░  (progress)            │
└─────────────────────────────────────────────┘
```

| Property | Spec |
|----------|------|
| Min width | 320px |
| Max width | 480px |
| Title | `text-body-md font-medium` |
| Description | `text-body-sm text-muted`, optional |
| Action | Text button, max 1 |
| Reduced motion | No slide; fade 150ms |

### 6.4 Toast vs In-App Notification

| Use toast | Use inbox notification |
|-----------|------------------------|
| Ephemeral confirmation ("Saved") | Persistent record needed |
| Non-actionable status | User may act later |
| Background operation complete | Audit trail desired |
| Error on current action | Cross-session relevance |

### 6.5 Accessibility

- `role="status"` for success/info; `role="alert"` for error/warning
- `aria-live="polite"` (assertive for errors)
- Focus not stolen; action button focusable
- Pause auto-dismiss on hover/focus

---

## 7. Push Notification Specifications

### 7.1 Web Push (PWA)

| Field | Spec |
|-------|------|
| Title | Max 50 chars; template variable support |
| Body | Max 120 chars |
| Icon | 192×192 app icon |
| Badge | Monochrome 72×72 |
| Image | Optional hero image 360×180 |
| Actions | Max 2 buttons, 15 chars each |
| Tag | Dedup key; replace existing same-tag |
| Require interaction | `true` for critical only |

### 7.2 Mobile Push (iOS/Android)

| Platform | Notes |
|----------|-------|
| iOS | Rich notification with category actions |
| Android | Notification channels map to modules |
| Both | Deep link to `action_url` |

### 7.3 Permission Prompt UX

- Never on first visit
- Trigger after user enables push in NT-S03
- Custom pre-prompt modal explaining value before browser prompt
- If denied: show manual enable instructions

### 7.4 Payload Structure (UI-relevant)

```json
{
  "title": "Deal won: {{deal.name}}",
  "body": "{{user.name}} closed {{deal.amount}}",
  "icon": "/assets/icons/modules/crm.png",
  "tag": "crm.deal_won.{{deal.id}}",
  "data": {
    "action_url": "/crm/deals/{{deal.id}}",
    "notification_id": "uuid"
  },
  "actions": [
    { "action": "view", "title": "View deal" },
    { "action": "dismiss", "title": "Dismiss" }
  ]
}
```

---

## 8. Email Preview (Cross-Reference)

See NT-S08. Additional requirements:

- CAN-SPAM footer: unsubscribe link (preferences), physical address
- Preheader text field in template editor (max 100 chars)
- Inline CSS only; tested clients: Gmail, Outlook, Apple Mail
- Localization: locale tabs in editor; fallback to `en-US`

---

## 9. Permissions & Visibility

| Surface | Permission | UI rule |
|---------|------------|---------|
| Inbox, preferences | Authenticated | — |
| Template admin | `admin:notifications:manage` | Hide admin nav |
| Org quiet hours | `admin:notifications:manage` | Org settings section |
| Transactional override notice | — | Show lock icon on locked prefs |

---

## 10. Responsive Behavior

| Breakpoint | Adaptation |
|------------|------------|
| Mobile | NT-S01: filters → bottom sheet; NT-D01 full-screen sheet |
| Tablet | Split view: list + detail (NT-S01 + NT-S02) |
| Desktop | Three-column inbox with inline detail |

---

## 11. Real-Time Behavior

| Event | UI Response |
|-------|-------------|
| `notification.received` | Badge +1; toast if `toast_enabled` on definition |
| `notification.read` | Remove unread dot; sync across tabs |
| `notification.dismissed` | Remove from list with fade |
| Connection lost | Banner; queue badge updates |

---

## 12. Telemetry Events

| Event | Properties |
|-------|------------|
| `notifications.inbox.viewed` | `filter`, `unread_count` |
| `notifications.item.clicked` | `notification_id`, `module` |
| `notifications.item.dismissed` | `notification_id` |
| `notifications.preferences.updated` | `channel`, `module`, `event_type` |
| `notifications.toast.shown` | `variant`, `source` |
| `notifications.push.permission` | `granted`, `denied`, `default` |

---

## 13. Open Questions

| ID | Question | Owner |
|----|----------|-------|
| OQ-UI-15-01 | Unified inbox include @mentions from Messaging? | Product |
| OQ-UI-15-02 | User-editable notification grouping rules? | v1.1 |
| OQ-UI-15-03 | WhatsApp channel in v1? | GTM |