---
title: Mobile & Tablet Responsive Specification
document_id: ATLAS-UI-18
version: 1.0.0
status: approved
phase: 4
last_updated: 2026-06-30
module: cross-cutting
related_documents:
  - ATLAS-UI-01
  - ATLAS-UI-13
  - ATLAS-UI-14
  - ATLAS-UI-15
  - ATLAS-UI-16
  - ATLAS-UI-17
  - ATLAS-UI-20
tags:
  - responsive
  - mobile
  - tablet
  - pwa
  - touch
  - offline
---

# Mobile & Tablet Responsive Specification

## Document Control

| Field | Value |
|-------|-------|
| **Scope** | Cross-cutting responsive behavior for all Atlas modules |
| **Screen count** | 0 screens (pattern library) |
| **Pattern count** | 47 patterns across 6 categories |
| **Breakpoints** | Mobile `<768px`, Tablet `768–1023px`, Desktop `≥1024px` |
| **PWA** | Installable; offline-capable read paths |

---

## 1. Purpose & Scope

Define responsive layout rules, mobile navigation patterns per module, tablet split-view behaviors, touch target standards, offline states, and PWA install prompt UX. Complements module-specific specs (13–17) and shell spec (`01-design-system.md`, pending).

### Design Principles

1. **Mobile-first progressive enhancement** — Core actions available on smallest viewport.
2. **Content over chrome** — Collapse navigation; prioritize task completion.
3. **Touch parity** — Every desktop action reachable via touch (no hover-only affordances).
4. **Graceful degradation** — Offline and slow network never blank-screen.
5. **Consistent breakpoints** — Single breakpoint system across modules.

---

## 2. Breakpoint System

| Token | Range | Layout column | Shell |
|-------|-------|---------------|-------|
| `xs` | 0–479px | 4 | Bottom nav |
| `sm` | 480–767px | 4 | Bottom nav |
| `md` | 768–1023px | 8 | Collapsible sidebar |
| `lg` | 1024–1439px | 12 | Full sidebar |
| `xl` | ≥1440px | 12 (max 1440 content) | Full sidebar |

### CSS Media Queries

```css
/* Mobile */
@media (max-width: 767px) { ... }

/* Tablet */
@media (min-width: 768px) and (max-width: 1023px) { ... }

/* Desktop */
@media (min-width: 1024px) { ... }
```

---

## 3. Touch Target Standards

| Element | Min size | Spacing |
|---------|----------|---------|
| Primary buttons | 44×44px | 8px between adjacent |
| Icon buttons | 44×44px hit area (icon may be 24px) | — |
| List rows | 48px height | — |
| Form inputs | 44px height | 16px vertical gap |
| Checkboxes/radios | 24px control, 44px tap area | — |
| Bottom nav items | 56px bar height | Equal width tabs |
| Swipe actions | Full row height | 80px reveal width |

### Touch Feedback

- `active` state: 150ms scale(0.98) or opacity 0.8
- Haptic: `navigator.vibrate(10)` on destructive confirm (supported devices)
- No `hover:`-only tooltips on touch — use long-press info popover

---

## 4. Shell Navigation Patterns

### 4.1 Mobile Shell (`<768px`)

```
┌─────────────────────────────────┐
│ [☰]  Atlas        [🔔] [👤]    │  ← Top bar (56px)
├─────────────────────────────────┤
│                                 │
│         Module Content          │
│                                 │
├─────────────────────────────────┤
│ [🏠] [💼] [📊] [💬] [⋯]        │  ← Bottom nav (56px + safe area)
└─────────────────────────────────┘
```

| Element | Behavior |
|---------|----------|
| Hamburger (☰) | Opens full-screen module drawer |
| Bottom nav | 4 primary modules + More |
| More | Overflow modules, Settings, Help |
| Safe area | `env(safe-area-inset-bottom)` padding |
| Scroll | Content scrolls; top + bottom bars fixed |

### 4.2 Tablet Shell (`768–1023px`)

```
┌──────┬──────────────────────────┐
│ Nav  │  Module Content          │
│ rail │                          │
│ 64px │                          │
│      │                          │
└──────┴──────────────────────────┘
```

- Icon-only sidebar (64px); expand to 240px on hover/pin
- No bottom nav
- Split views enabled (see §6)

### 4.3 Module Drawer (Mobile)

Full-screen overlay listing all enabled modules grouped by category:

| Group | Modules |
|-------|---------|
| Revenue | CRM, Sales, Marketing |
| Operations | Projects, ERP, Support |
| Finance | Finance, Legal |
| People | HR, Scheduling |
| Platform | Documents, Analytics, Marketplace |
| Admin | Settings (if permitted) |

Search at top; recently used section.

---

## 5. Mobile Navigation Patterns Per Module

### 5.1 Platform & Admin

| Module | Mobile nav | Primary FAB |
|--------|------------|-------------|
| Dashboard | Default bottom nav | — |
| Settings | Stack navigation (drill-down lists) | — |
| Search (global) | Full-screen overlay (`Cmd+K` → search icon) | — |
| AI Assistant | Bottom sheet (half → full) | Floating AI button |

### 5.2 CRM

| Screen | Mobile pattern |
|--------|----------------|
| Contact list | Full-width cards; swipe actions (call, email, edit) |
| Contact detail | Tab bar: Overview, Activity, Deals, Files |
| Pipeline | Horizontal scroll stages; deal cards stack vertically per stage |
| Deal detail | Collapsible sections; sticky action bar (Call, Email, Note) |

**FAB:** `+` New contact/deal (context-aware)

### 5.3 Finance

| Screen | Mobile pattern |
|--------|----------------|
| Invoice list | Cards with status badge; filter chips horizontal scroll |
| Invoice detail | PDF preview full-width; actions in bottom sheet |
| Expenses | Camera capture for receipt (native input) |

**FAB:** `+` New invoice/expense

### 5.4 Projects

| Screen | Mobile pattern |
|--------|----------------|
| Project list | Cards with progress bar |
| Board view | Single column; stage picker dropdown (not horizontal scroll) |
| Task detail | Full-screen with subtasks accordion |

**FAB:** `+` New task

### 5.5 Support

| Screen | Mobile pattern |
|--------|----------------|
| Case queue | Priority-sorted cards |
| Case detail | Conversation thread (chat layout); reply bar fixed bottom |
| KB | Search-first; article reader full-screen |

### 5.6 HR

| Screen | Mobile pattern |
|--------|----------------|
| Directory | Alphabetical list with sticky section headers |
| Time off | Calendar month view; request form full-screen |
| Profile | Self-service tabs |

### 5.7 Documents (DC)

| Screen | Mobile pattern |
|--------|----------------|
| File browser | List view default; folder drill-down (no tree) |
| Preview | Full-screen; share/download in top bar |
| Upload | FAB + native file picker; camera for images |

See `16-documents.md` § Responsive.

### 5.8 Analytics (AN)

| Screen | Mobile pattern |
|--------|----------------|
| Dashboard | Single-column widget stack |
| Charts | Simplified; tap for data table popup |
| Reports | Run only; builder desktop/tablet minimum |

**Restriction:** Report builder hidden on `<768px`; show "Use tablet or desktop" message.

### 5.9 Marketplace (MP)

| Screen | Mobile pattern |
|--------|----------------|
| Catalog | Single-column cards; filter bottom sheet |
| App detail | Accordion sections replace tabs |
| Install flow | Full-screen wizard |

See `13-marketplace.md` § Responsive.

### 5.10 Billing (BL)

| Screen | Mobile pattern |
|--------|----------------|
| Plan selection | Stacked plan cards |
| Checkout | Single column; sticky pay button footer |
| Invoices | Card list |

See `14-billing.md` § Responsive.

### 5.11 Notifications (NT)

| Screen | Mobile pattern |
|--------|----------------|
| Inbox | Full-screen list; swipe read/dismiss |
| Quick inbox | Full-screen bottom sheet (not dropdown) |
| Preferences | Standard settings drill-down |

See `15-notifications.md` § Responsive.

### 5.12 Messaging

| Screen | Mobile pattern |
|--------|----------------|
| Channel list | Full-screen; back nav to messages |
| Thread | Chat layout; keyboard pushes input bar |
| Compose | Full-screen modal |

---

## 6. Tablet Split-View Patterns

### 6.1 Master-Detail

Used when list + detail both valuable at tablet width.

```
┌────────────────┬─────────────────────┐
│  List (40%)    │  Detail (60%)       │
│  □ Item 1  ●   │  Item 1 content     │
│  □ Item 2      │                     │
│  □ Item 3      │                     │
└────────────────┴─────────────────────┘
```

| Module | Master | Detail |
|--------|--------|--------|
| CRM Contacts | Contact list | Contact detail |
| CRM Deals | Deal list | Deal detail |
| Support | Case queue | Case thread |
| Projects | Task list | Task detail |
| Documents | File list | Preview panel |
| Notifications | Inbox list | Notification detail |
| Messaging | Channel list | Thread |

**Behavior:**
- First item auto-selected on load (if exists)
- Empty detail: ES-MD-001 "Select an item"
- Orientation change: maintain selection
- `≥1024px`: optional third panel (context sidebar)

### 6.2 Split Editor

| Module | Left panel | Right panel |
|--------|------------|-------------|
| Report builder | Field config | Preview |
| Workflow builder | Node palette | Canvas |
| Email template | Editor | Preview |

### 6.3 Dashboard Split

Analytics tablet: 6-column grid with 2 side-by-side widgets per row (vs 1 on mobile).

---

## 7. Offline States

### 7.1 Offline Detection

```javascript
// Conceptual — implementation in Phase 6
navigator.onLine + heartbeat ping every 30s
```

| State | Banner | Location |
|-------|--------|----------|
| Offline | Red: "You're offline" | Global top below header |
| Reconnecting | Amber: "Reconnecting..." | Global top |
| Back online | Green toast: "Back online" (3s) | Toast |
| Slow connection | Amber: "Slow connection" | Global top (optional) |

See `20-empty-states-errors.md` § Offline Banner.

### 7.2 Offline Capability Matrix

| Module | Offline read | Offline write | Sync strategy |
|--------|--------------|---------------|---------------|
| CRM contacts | Cached recent | Queue mutations | Background sync |
| Projects tasks | Cached board | Queue status changes | Background sync |
| Documents | Cached previews | Queue uploads | Resume on reconnect |
| Messaging | Last 100 messages | Queue sends | FIFO sync |
| Notifications | Cached inbox | — | Read-only |
| Analytics | Last dashboard snapshot | — | Read-only |
| Finance | — | — | Online only |
| Billing | — | — | Online only |
| Marketplace | Cached catalog | — | Read-only |

### 7.3 Offline UI Patterns

#### Cached Data Indicator

```
┌─────────────────────────────────────────┐
│ ⓘ Showing cached data from 2h ago      │
│   [Retry connection]                    │
└─────────────────────────────────────────┘
```

#### Queued Mutation Indicator

```
┌─────────────────────────────────────────┐
│ ⏳ 3 changes waiting to sync             │
└─────────────────────────────────────────┘
```

- Badge on affected entities (e.g., "Pending sync" on task card)
- Conflict resolution modal on sync failure (keep local vs server)

#### Offline-Blocked Action

- Disable button with tooltip: "Unavailable offline"
- Or tap → toast: "This action requires an internet connection"

### 7.4 Service Worker Strategy

| Asset | Strategy |
|-------|----------|
| App shell | CacheFirst |
| API (read) | NetworkFirst with cache fallback |
| API (write) | NetworkOnly with IndexedDB queue |
| Static assets | CacheFirst (versioned) |
| User uploads | IndexedDB blob store until online |

---

## 8. PWA Install Prompt

### 8.1 Eligibility

- HTTPS required
- Valid `manifest.json` with icons 192 + 512
- Service worker registered
- User engagement: ≥2 visits, ≥5 min total session (custom criteria)

### 8.2 Prompt Timing

| Trigger | UI |
|---------|-----|
| `beforeinstallprompt` captured | Do NOT show immediately |
| 2nd session, after first value action | Bottom sheet prompt |
| User dismisses | Snooze 14 days |
| User installs | Thank you toast + onboarding tip |

### 8.3 Install Prompt Design

```
┌─────────────────────────────────────────┐
│ [Atlas icon]  Install Atlas              │
│                                         │
│ Add Atlas to your home screen for       │
│ quick access and offline support.       │
│                                         │
│ [Not now]              [Install]        │
└─────────────────────────────────────────┘
```

| Platform | Behavior |
|----------|----------|
| Android Chrome | Native install via `prompt()` |
| iOS Safari | Manual instructions sheet (Share → Add to Home Screen) |
| Desktop Chrome | Address bar install icon + optional in-app prompt |

### 8.4 iOS Manual Instructions Sheet

Step illustrations:
1. Tap Share button
2. Scroll to "Add to Home Screen"
3. Tap Add

### 8.5 Post-Install

- Standalone display mode (`display: standalone`)
- Splash screen per manifest
- Push notification permission: separate flow (not at install)
- Open installed PWA → skip install prompt

---

## 9. Responsive Data Tables

Tables wider than viewport use one of:

| Strategy | When |
|----------|------|
| Horizontal scroll | Few columns, wide content |
| Card transformation | Mobile default for most modules |
| Priority columns | Show 2–3 columns; expand row for rest |
| Sticky first column | Financial tables |

### Table → Card Transformation

```
Desktop row:
| Name | Status | Amount | Date | ⋮ |

Mobile card:
┌─────────────────────────────┐
│ Acme Corp          [Status] │
│ $12,500  •  Jun 28, 2026    │
│ [Actions]                   │
└─────────────────────────────┘
```

---

## 10. Form Patterns (Mobile)

| Pattern | Mobile adaptation |
|---------|-------------------|
| Multi-step wizard | Full-screen steps; progress dots |
| Long forms | Section accordion; sticky save |
| Date picker | Native `input[type=date]` where possible |
| Select | Bottom sheet picker (not tiny native dropdown) |
| Rich text | Simplified toolbar; expand to full-screen editor |
| File upload | Native picker + camera option |

---

## 11. Keyboard & Input (Tablet)

- External keyboard: standard shortcuts active (`Cmd+K`, `Cmd+S`)
- `virtualkeyboard` API: adjust viewport when on-screen keyboard opens
- iOS: `scrollIntoView` on focused input to prevent obscuring

---

## 12. Accessibility (Responsive)

| Requirement | Implementation |
|-------------|----------------|
| Zoom | Allow up to 200% without horizontal scroll break |
| Orientation | Support portrait + landscape on tablet |
| Motion | `prefers-reduced-motion` disables parallax, slide animations |
| Touch + screen reader | VoiceOver/TalkBack swipe actions match visual swipe |
| Focus | Skip link to main content on mobile |

---

## 13. Testing Matrix

| Device class | Test viewports | Priority |
|--------------|----------------|----------|
| iPhone SE | 375×667 | P0 |
| iPhone 15 Pro | 393×852 | P0 |
| iPad | 768×1024 | P0 |
| iPad Pro | 1024×1366 | P1 |
| Android phone | 360×800 | P0 |
| Android tablet | 800×1280 | P1 |

Test: offline mode, PWA install, split-view selection, touch targets, safe areas.

---

## 14. Open Questions

| ID | Question | Owner |
|----|----------|-------|
| OQ-UI-18-01 | Native mobile apps (React Native) timeline? | Product |
| OQ-UI-18-02 | Offline Finance read (cached invoices)? | Security |
| OQ-UI-18-03 | Foldable device layout rules? | v1.1 |