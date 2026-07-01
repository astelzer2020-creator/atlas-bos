---
title: Messaging UI Specification
document_id: ATLAS-UI-21
version: 1.0.0
status: approved
phase: 4
last_updated: 2026-06-30
module: messaging
related_documents:
  - ATLAS-DB-18
  - ATLAS-ARCH-13
  - ATLAS-UI-19
  - ATLAS-UI-18
  - ATLAS-UI-20
  - ATLAS-UI-15
tags:
  - messaging
  - channels
  - dms
  - threads
  - chat-widget
  - email-inbox
  - real-time
  - wireframes
---

# Messaging UI Specification

## Document Control

| Field | Value |
|-------|-------|
| **Module** | Messaging |
| **Screen count** | 9 screens, 3 modals, 1 panel |
| **Pattern sections** | Message composer, Emoji picker, @mentions |
| **Primary personas** | P3 (Employee), P4 (Sales Rep), P6 (Support Agent), P1 (SMB Owner) |
| **Route prefix** | `/app/{org}/messages`, `/portal/chat`, `/settings/messaging` |

---

## 1. Purpose & Scope

Define all user-facing surfaces for Atlas unified messaging: internal team collaboration (channels, DMs, threads), external communications (email inbox, customer chat widget), search, and per-channel notification preferences. Aligns with `messaging.*` schema and `ATLAS-ARCH-13`.

### In Scope

- Channel list and conversation views with real-time delivery
- Direct messages (1:1 and group)
- Thread panel, message composer, attachments, emoji, @mentions
- Full-text message search (permission-aware)
- Channel settings and notification overrides
- Embedded customer chat widget (agent + config surfaces)
- Shared email inbox integration view

### Out of Scope

- Video/voice calls (future Meetings module)
- SMS compose UI (Notification + Messaging bridge — Phase 5)
- E2E encryption key management UX (enterprise addendum v1.1)
- Slack/Teams bidirectional sync (Integrations module — doc 23)

---

## 2. Navigation & Information Architecture

```
Messages (primary nav — all tiers)
├── Channels (/app/{org}/messages)
│   ├── Channel list (sidebar)                    → UI-MSG-001
│   ├── Channel view                              → UI-MSG-002
│   │   ├── Thread panel                          → UI-MSG-P001
│   │   └── Channel settings                      → UI-MSG-006
│   └── Create channel modal                      → UI-MSG-M001
├── Direct Messages (/app/{org}/messages/dms)
│   ├── DM list                                   → UI-MSG-003
│   └── DM conversation                           → UI-MSG-004
├── Search (/app/{org}/messages/search)           → UI-MSG-005
├── Email Inbox (/app/{org}/messages/email)       → UI-MSG-009
└── Settings
    ├── Per-channel notification prefs            → UI-MSG-007
    └── Chat widget config                        → UI-MSG-008 (admin)

Customer Portal (external)
└── Embedded chat widget                          → UI-MSG-008 (widget)
```

### Entry Points

| Source | Destination | Condition |
|--------|-------------|-----------|
| Main nav → Messages | UI-MSG-001 / last active channel | `msg:channels:read` |
| @mention notification | UI-MSG-002 or UI-MSG-004 | Deep link to message |
| CRM contact sidebar → Message | UI-MSG-004 (new DM) | `msg:dms:write` |
| Support ticket → Customer thread | UI-MSG-009 email or widget | `msg:email:read` |
| Global search (⌘K) → Messages tab | UI-MSG-005 | `msg:search:read` |

---

## 3. Screen Inventory

| ID | Screen | Route | Permission gate |
|----|--------|-------|-----------------|
| UI-MSG-001 | Channel List | `/app/{org}/messages` | `msg:channels:read` |
| UI-MSG-002 | Channel View | `/app/{org}/messages/channels/:channelId` | `msg:channels:read` + channel membership |
| UI-MSG-003 | DM List | `/app/{org}/messages/dms` | `msg:dms:read` |
| UI-MSG-004 | DM Conversation | `/app/{org}/messages/dms/:conversationId` | `msg:dms:read` + participant |
| UI-MSG-005 | Search Messages | `/app/{org}/messages/search` | `msg:search:read` |
| UI-MSG-006 | Channel Settings | `/app/{org}/messages/channels/:channelId/settings` | `msg:channels:manage` or channel admin |
| UI-MSG-007 | Notification Prefs (per channel) | `/settings/messaging/notifications` | Authenticated |
| UI-MSG-008 | Customer Chat Widget | Embedded + `/settings/messaging/widget` | Widget: public; Config: `msg:widget:manage` |
| UI-MSG-009 | Email Inbox Integration | `/app/{org}/messages/email` | `msg:email:read` |

### Modals & Panels

| ID | Surface | Trigger |
|----|---------|---------|
| UI-MSG-M001 | Create Channel | `+` in channel list, or empty state CTA |
| UI-MSG-M002 | File Attach | Paperclip in composer |
| UI-MSG-M003 | Invite Members | Channel settings or create flow |
| UI-MSG-P001 | Thread Panel | Click thread reply count on message |

---

## 4. Permissions Matrix

| Permission | UI Effect |
|------------|-----------|
| `msg:channels:read` | View channel list and public channels |
| `msg:channels:write` | Post messages in channels; join public channels |
| `msg:channels:manage` | Create/edit/archive channels; manage members |
| `msg:channels:delete` | Delete channels (org admin) |
| `msg:messages:read` | Read message history in permitted conversations |
| `msg:messages:write` | Send and edit own messages |
| `msg:messages:delete` | Delete any message (moderator) |
| `msg:dms:read` | View DM list and conversations |
| `msg:dms:write` | Start DMs and group DMs |
| `msg:threads:read` | View thread replies |
| `msg:threads:write` | Reply in threads |
| `msg:search:read` | Access message search |
| `msg:email:read` | View shared email inbox |
| `msg:email:write` | Send/reply from shared inbox |
| `msg:widget:manage` | Configure customer chat widget |
| `msg:settings:manage` | Org-level messaging settings |

Channel-level overrides: private channel membership gates read/write regardless of `msg:channels:read`.

---

## 5. Global Patterns

### 5.1 Message Item Component

```
┌────────────────────────────────────────────────────────────────┐
│ [Avatar] Jane Smith  10:42 AM                    [⋯] [🧵 3]   │
│          Hey team — updated the proposal doc.                  │
│          [📎 proposal-v2.pdf  2.4 MB]                          │
│          👍 2  ❤️ 1                              [Reply in thread]│
└────────────────────────────────────────────────────────────────┘
```

| Property | Spec |
|----------|------|
| Grouping | Consecutive messages from same author within 5 min collapse avatar |
| Edited | `(edited)` suffix; tooltip with edit timestamp |
| Deleted | "Message deleted" placeholder; moderator sees original strikethrough |
| System messages | Centered, muted, no avatar (joins, channel renames) |
| Entity link card | CRM contact/deal/ticket preview when `entity_ref` present |
| Unread divider | "New messages" red line on scroll position |

### 5.2 Presence & Typing

| Indicator | Location | Behavior |
|-----------|----------|----------|
| Online dot | Avatar, member list | Green = active <5m; yellow = away; gray = offline |
| Typing | Channel header / DM header | "Jane and 2 others are typing…" debounced 3s |
| Read receipts | DM only (v1) | ✓ sent, ✓✓ read below last own message |

Real-time via WebSocket `WS /v1/messaging/connect`.

### 5.3 Message Composer (Pattern)

Persistent footer in UI-MSG-002, UI-MSG-004, UI-MSG-P001, UI-MSG-009.

```
┌────────────────────────────────────────────────────────────────┐
│ [B][I][S] [🔗] [📎] [😀] [@]                    [Send ⏎]      │
├────────────────────────────────────────────────────────────────┤
│ Write a message…                                               │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

| Feature | Spec |
|---------|------|
| Rich text | Bold, italic, strikethrough, inline code, links |
| Markdown | Optional; `Ctrl+Shift+M` toggle; preview on send |
| Draft persistence | LocalStorage per conversation; sync on reconnect |
| Send | Enter = send; Shift+Enter = newline |
| Character limit | 40,000 chars; counter at 38,000 |
| Attachments | UI-MSG-M002; max 10 files, 25 MB each |
| @mentions | Autocomplete pattern (§5.5) |
| Emoji | Picker pattern (§5.4) |
| Schedule send | v1.1 — hidden in v1 |
| Permission | `msg:messages:write` or `msg:email:write` |

### 5.4 Emoji Picker (Pattern)

| Property | Value |
|----------|-------|
| Trigger | 😀 button or `:shortcode:` autocomplete |
| Position | Popover above composer, 320×360px |
| Tabs | Frequent, Smileys, People, Nature, Food, Objects, Symbols |
| Search | Filter by name/shortcode |
| Skin tone | Persisted per user for supported emoji |
| Recent | Last 24 used emoji |
| Custom emoji | v1.1 — org emoji upload |

### 5.5 @Mentions (Pattern)

| Type | Trigger | Result |
|------|---------|--------|
| User | `@` + name | Notify user; link to profile |
| Channel | `@` + channel name in composer | Cross-post preview (confirm modal) |
| Here / Channel | `@here`, `@channel` | Broadcast; gated by `msg:channels:manage` |
| Entity | `#` + entity search | Link deal/contact/ticket inline |

Autocomplete popover: max 8 results; keyboard ↑↓ Enter; shows avatar + role badge.

---

## 6. Screen Specifications

### UI-MSG-001 — Channel List

**Route:** `/app/{org}/messages`  
**Layout:** Three-column shell (list | conversation | optional thread)

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Messages                              [🔍 Search]  [⚙]  [+ Channel]          │
├────────────────┬─────────────────────────────────────────────────────────────┤
│ CHANNELS       │ Select a channel or start a conversation                    │
│ ─────────────  │                                                             │
│ # general    ●2│                    [Illustration]                           │
│ # sales        │              Welcome to Atlas Messages                      │
│ # engineering  │         Pick a channel from the left or create one.       │
│ ─────────────  │                                                             │
│ DIRECT MESSAGES│                    [Browse channels]                        │
│ Jane Smith   ● │                                                             │
│ Project Alpha  │                                                             │
│ ─────────────  │                                                             │
│ STARRED        │                                                             │
│ # announcements│                                                             │
└────────────────┴─────────────────────────────────────────────────────────────┘
```

#### Sidebar Sections

| Section | Behavior |
|---------|----------|
| Channels | Public + joined private; unread badge; mute icon if muted |
| Direct Messages | Sorted by last activity; presence dot |
| Starred | User-pinned channels/DMs |
| External | Email inbox link (Growth+); badge for unassigned |

#### Actions

| Action | Permission |
|--------|------------|
| Create channel | `msg:channels:manage` |
| Join public channel | `msg:channels:write` |
| Star/unstar | Authenticated member |
| Mute channel | Authenticated member → UI-MSG-007 shortcut |

#### Empty States

| State | ID |
|-------|-----|
| No channels | ES-MSG-001 |
| No DMs | ES-MSG-002 |

#### Responsive

| Breakpoint | Adaptation |
|------------|------------|
| Mobile | Single column; list full-screen; tap navigates to UI-MSG-002 |
| Tablet | Two columns: list + conversation |
| Desktop | Three columns with optional thread panel |

---

### UI-MSG-002 — Channel View

**Route:** `/app/{org}/messages/channels/:channelId`

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ # sales                              [📌] [🔔] [👥 12] [ℹ️] [⚙ Settings]    │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Pinned message bar — collapsible]                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Message list — virtualized, infinite scroll up]                            │
│                                                                              │
│  ─── New messages ───                                                        │
│  [Message items...]                                                          │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Message Composer]                                                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Header Actions

| Action | Permission | Destination |
|--------|------------|-------------|
| Channel info | Member | Drawer: description, created, linked entity |
| Members | Member | Member list drawer; invite if manage |
| Pin message | `msg:channels:manage` | Pin up to 5 messages |
| Notification override | Member | Quick mute menu → UI-MSG-007 |
| Settings | `msg:channels:manage` | UI-MSG-006 |

#### Message Actions (⋯ menu)

| Action | Permission |
|--------|------------|
| Reply in thread | `msg:threads:write` |
| React | `msg:messages:write` |
| Copy link | Member |
| Edit (15 min window) | Author |
| Delete | Author or `msg:messages:delete` |
| Report | Member |

#### Real-Time

| Event | UI Response |
|-------|-------------|
| `message.created` | Append if in view; else increment unread |
| `message.updated` | In-place replace |
| `message.deleted` | Show placeholder |
| `reaction.added` | Update reaction row |
| `member.joined` | System message |

---

### UI-MSG-003 — DM List

**Route:** `/app/{org}/messages/dms`

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Direct Messages                                    [🔍]  [+ New message]     │
├────────────────┬─────────────────────────────────────────────────────────────┤
│ CONVERSATIONS  │                                                             │
│ ┌────────────┐ │                                                             │
│ │● Jane Smith│ │         Select a conversation                               │
│ │  Thanks!   │ │                                                             │
│ ├────────────┤ │                                                             │
│ │  Project α │ │                                                             │
│ │  You: Done │ │                                                             │
│ └────────────┘ │                                                             │
└────────────────┴─────────────────────────────────────────────────────────────┘
```

#### List Item

- Avatar stack for group DMs (max 3 faces + count)
- Preview: last message truncated 60 chars
- Unread bold + blue dot
- Muted: bell-off icon

#### Actions

| Action | Permission |
|--------|------------|
| New message | `msg:dms:write` → user picker modal |
| Archive conversation | Authenticated participant |
| Block user | Org policy; admin notification |

---

### UI-MSG-004 — DM Conversation

**Route:** `/app/{org}/messages/dms/:conversationId`

Same layout as UI-MSG-002 minus channel-specific header. Additional features:

- Read receipts on own messages
- Group DM: editable name, add/remove members (`msg:dms:write`)
- 1:1: "View profile" link to HR/CRM card
- E2E badge if encrypted conversation (enterprise)

---

### UI-MSG-005 — Search Messages

**Route:** `/app/{org}/messages/search?q=`

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [🔍 Search messages, files, and people...........................]  [Filters]│
├──────────────────────────────────────────────────────────────────────────────┤
│ Filters: [In: Any channel ▼] [From: Anyone ▼] [Date: Any time ▼] [Has: File]│
├──────────────────────────────────────────────────────────────────────────────┤
│ 24 results for "proposal"                                                      │
│ ┌──────────────────────────────────────────────────────────────────────────┐│
│ │ # sales · Jane · Mar 12                                                  ││
│ │ …updated the **proposal** doc attached below…                            ││
│ └──────────────────────────────────────────────────────────────────────────┘│
│ ┌──────────────────────────────────────────────────────────────────────────┐│
│ │ DM Jane Smith · You · Mar 10                                             ││
│ │ Can you review the **proposal** before Friday?                           ││
│ └──────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Filters

| Filter | Options |
|--------|---------|
| In | Channel picker, DMs, Email, All |
| From | User autocomplete |
| Date | Today, 7d, 30d, Custom range |
| Has | File, Link, Reaction, Thread |
| Type | Messages, Files (tab) |

#### Result Click

Navigate to conversation; scroll to message; highlight 3s yellow flash.

Permission-aware: results only from conversations user can access.

---

### UI-MSG-006 — Channel Settings

**Route:** `/app/{org}/messages/channels/:channelId/settings`  
**Gate:** Channel admin or `msg:channels:manage`

#### Sections

1. **General** — Name, description, topic, emoji icon
2. **Privacy** — Public / Private (immutable after create in v1)
3. **Members** — Table with role (Admin, Member); invite/remove
4. **Permissions** — Who can post (@everyone, admins only)
5. **Integrations** — Incoming webhooks, linked CRM entity
6. **Retention** — Message retention policy (org default or override)
7. **Archive** — Archive channel (soft delete); confirm destructive

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← # sales    Channel Settings                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│ General │ Members │ Permissions │ Integrations │ Retention                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Channel name    [# sales        ]                                            │
│ Description     [Q1 pipeline discussion                    ]                 │
│ Linked entity   [Deal: Acme Renewal ▼]  [Clear]                            │
│                                              [Save changes]                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### UI-MSG-007 — Notification Prefs (Per Channel)

**Route:** `/settings/messaging/notifications`

#### Layout

Global default at top; per-channel overrides table below.

| Channel / DM | Desktop | Mobile | Email | Mentions only |
|--------------|---------|--------|-------|---------------|
| # general | All | All | Off | ☐ |
| # sales | Mentions | All | Off | ☑ |
| Jane Smith | All | Mentions | Off | ☐ |

| Setting | Behavior |
|---------|----------|
| All | Every message notifies |
| Mentions | Only @me, @here (if member) |
| Off | Muted; badge still increments unless "hide badge" |
| Email digest | Optional daily summary for external/email channels |

Links to NT-S03 global notification prefs for channel master toggles.

---

### UI-MSG-008 — Customer Chat Widget

**Surfaces:** Embedded widget (customer) + Admin config (`/settings/messaging/widget`)

#### Widget Wireframe (Embedded — 380×520px default)

```
┌─────────────────────────────────────┐
│ Atlas Support          [─] [×]      │
├─────────────────────────────────────┤
│ Hi! How can we help you today?      │
│                                     │
│ [Agent avatar] Thanks for reaching  │
│ out — I'll look into that order.    │
│                                     │
├─────────────────────────────────────┤
│ [📎] [Type your message...    ] [➤] │
│ Powered by Atlas                    │
└─────────────────────────────────────┘
```

#### Widget States

| State | UI |
|-------|-----|
| Pre-chat form | Name, email, optional custom fields |
| Queued | Position in queue, estimated wait |
| Active chat | Real-time messages; file upload |
| Offline | Leave message form → creates Support ticket |
| Resolved | CSAT thumbs + optional comment |

#### Admin Config Sections

| Section | Controls |
|---------|----------|
| Appearance | Colors, logo, position (bottom-right/left), greeting |
| Hours | Business hours; offline behavior |
| Routing | Default queue, auto-assign rules (link UI-SUP-007) |
| Pre-chat fields | Required/optional field builder |
| Embed code | `<script>` snippet + domain allowlist |
| Preview | Live preview pane |

**Gate:** `msg:widget:manage`

---

### UI-MSG-009 — Email Inbox Integration

**Route:** `/app/{org}/messages/email`  
**Gate:** `msg:email:read` (Growth+)

Unified shared inbox for `support@`, `sales@`, and connected Gmail/Outlook accounts.

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Email Inbox          [support@acme.com ▼]  [Unassigned (4)] [Mine] [All]    │
├────────────────┬─────────────────────────────────────────────────────────────┤
│ THREADS        │ RE: Invoice #4521 — Beta Corp                               │
│ ─────────────  │ From: jane@betacorp.com · 2h ago    [🎫 Create ticket]     │
│ ● RE: Invoice  ├─────────────────────────────────────────────────────────────┤
│   Beta Corp    │ [Email body — HTML sanitized]                               │
│ FW: Contract   │                                                             │
│   Gamma LLC    │ [Customer 360 sidebar — CRM account, open tickets]          │
│ ─────────────  ├─────────────────────────────────────────────────────────────┤
│ Assigned to me │ [Reply] [Reply all] [Forward] [Internal note] [Assign]      │
│ (3)            │ [Message Composer — email mode: CC/BCC fields]              │
└────────────────┴─────────────────────────────────────────────────────────────┘
```

#### Email-Specific Composer

- To, CC, BCC fields (collapsible)
- Subject line (reply: `Re:` locked prefix)
- Signature picker
- Template insert (link UI-SUP-006 canned responses)
- Send vs Send & create ticket

#### Actions

| Action | Permission |
|--------|------------|
| View threads | `msg:email:read` |
| Reply/send | `msg:email:write` |
| Assign to agent | `support:cases:assign` |
| Create ticket | `support:cases:write` |
| Link to CRM contact | `crm:contacts:write` |

---

## 7. Modal Specifications

### UI-MSG-M001 — Create Channel

| Field | Required | Validation |
|-------|----------|------------|
| Name | Yes | 2–80 chars; lowercase slug auto-generated |
| Description | No | Max 250 chars |
| Privacy | Yes | Public (default) / Private radio |
| Add members | No | Multi-select autocomplete |
| Link entity | No | Optional CRM/PM entity |

Primary CTA: **Create channel** → navigate to UI-MSG-002.

### UI-MSG-M002 — File Attach

```
┌─────────────────────────────────────────────────┐
│ Attach files                              [×]   │
├─────────────────────────────────────────────────┤
│ [Drop zone — drag files here or Browse]         │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📄 proposal.pdf  2.4 MB            [Remove]│ │
│ └─────────────────────────────────────────────┘ │
│ ☑ Compress images   ☐ Mark as confidential    │
│                        [Cancel]  [Attach (1)]   │
└─────────────────────────────────────────────────┘
```

- Progress bar per file on upload
- Inline preview for images before send
- Virus scan pending state: spinner + "Scanning…"

### UI-MSG-M003 — Invite Members

Multi-select user picker; optional message; shows current member count vs plan limit.

---

## 8. Panel Specifications

### UI-MSG-P001 — Thread Panel

**Trigger:** Click thread count or "Reply in thread"  
**Width:** 400px right panel (desktop); full-screen sheet (mobile)

```
┌─────────────────────────────────────┐
│ Thread                         [×]  │
│ 3 replies · # sales                 │
├─────────────────────────────────────┤
│ [Parent message — pinned top]       │
│ ─────────────────────────────────── │
│ [Thread replies — chronological]    │
├─────────────────────────────────────┤
│ [Message Composer — thread mode]    │
│ Also send to # sales ☐              │
└─────────────────────────────────────┘
```

- "Also send to channel" checkbox posts reply to main channel
- Unread thread count badge on parent message
- Close panel: `Esc` or ×

---

## 9. Responsive Behavior

| Breakpoint | Adaptation |
|------------|------------|
| Mobile (xs–sm) | Single-pane navigation stack; bottom composer fixed; swipe back |
| Tablet (md) | Two-pane: list + conversation; thread as overlay sheet |
| Desktop (lg+) | Three-pane optional; thread panel docked |
| Widget | Responsive 100% width on mobile web; min 320px |

See `18-mobile-tablet.md` patterns MP-MSG-01 through MP-MSG-06.

---

## 10. Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Keyboard | `Alt+↑/↓` channel nav; `Ctrl+K` search; `R` focus composer |
| Screen reader | Messages as list items; author + time announced |
| Live regions | New messages `aria-live="polite"` when focused away |
| Color | Unread not color-only — bold text + badge count |
| Reduced motion | No slide animations on message append |

---

## 11. Telemetry Events

| Event | Properties |
|-------|------------|
| `messaging.channel.viewed` | `channel_id`, `type` |
| `messaging.message.sent` | `conversation_type`, `has_attachment`, `has_mention` |
| `messaging.thread.opened` | `parent_message_id` |
| `messaging.search.executed` | `query_length`, `result_count`, `filters` |
| `messaging.widget.session_started` | `org_id`, `queue_wait_seconds` |
| `messaging.email.reply_sent` | `thread_id`, `created_ticket` |

---

## 12. Open Questions

| ID | Question | Owner |
|----|----------|-------|
| OQ-UI-21-01 | Guest/external channel access for clients? | v1.1 |
| OQ-UI-21-02 | Message scheduling in composer? | v1.1 |
| OQ-UI-21-03 | WhatsApp channel in email inbox sidebar? | Product |