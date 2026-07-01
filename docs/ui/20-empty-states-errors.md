---
title: Empty States, Errors & Loading Patterns
document_id: ATLAS-UI-20
version: 1.0.0
status: approved
phase: 4
last_updated: 2026-06-30
module: cross-cutting
related_documents:
  - ATLAS-UI-18
  - ATLAS-UI-19
  - ATLAS-ARCH-21
tags:
  - empty-states
  - errors
  - loading
  - skeletons
  - offline
---

# Empty States, Errors & Loading Patterns

## Document Control

| Field | Value |
|-------|-------|
| **Scope** | Standard patterns for empty data, errors, loading, and offline states |
| **Error pages** | 5 full-page errors |
| **Empty state IDs** | 40+ cataloged |
| **Skeleton variants** | 12 |
| **Primary personas** | All |

---

## 1. Purpose & Scope

Define reusable UI patterns ensuring consistent, helpful experiences when data is absent, loading, failed, or inaccessible. Every module references these patterns by ID rather than inventing one-off designs.

### Design Principles

1. **Explain what happened** — Plain language, no error codes alone
2. **Guide next action** — Primary CTA when user can fix; secondary escape hatch
3. **Maintain context** — Don't destroy navigation on recoverable errors
4. **Reduce anxiety** — Friendly tone; illustrations optional, never frivolous on errors
5. **Accessibility** — Errors announced; empty states not confused with loading

---

## 2. Pattern Anatomy

### 2.1 Empty State

```
┌─────────────────────────────────────────┐
│           [Illustration 120×120]         │
│                                         │
│         Primary message (H3)            │
│    Secondary explanation (body)           │
│                                         │
│         [Primary CTA]  [Secondary]      │
│                                         │
│         Optional help link              │
└─────────────────────────────────────────┘
```

| Element | Spec |
|---------|------|
| Container | Centered; min-height 320px; max-width 480px |
| Illustration | Optional SVG; `prefers-reduced-motion`: static |
| Title | `text-heading-md` |
| Description | `text-body-md text-muted`; 1–2 sentences |
| Primary CTA | One action maximum |
| Secondary | Text link or ghost button |

### 2.2 Inline Error

```
┌─────────────────────────────────────────┐
│ ⚠ Error message                    [×]  │
│   Optional detail / retry link          │
└─────────────────────────────────────────┘
```

| Variant | Background | Icon |
|---------|------------|------|
| `error` | `bg-error-subtle` | ✕ circle |
| `warning` | `bg-warning-subtle` | ⚠ triangle |
| `info` | `bg-info-subtle` | ℹ circle |

`role="alert"` for errors; dismissible if non-blocking.

### 2.3 Loading Skeleton

- Pulse animation 1.5s; `prefers-reduced-motion`: static gray blocks
- Match final layout dimensions (prevent layout shift)
- Show within 100ms of request start
- Max skeleton duration: 10s → transition to timeout error

---

## 3. Full-Page Error Pages

### 3.1 ES-ERR-404 — Not Found

**Route:** `*` (unmatched)  
**HTTP:** 404

| Element | Content |
|---------|---------|
| Title | "Page not found" |
| Description | "The page you're looking for doesn't exist or has been moved." |
| Primary CTA | "Go to dashboard" → `/` |
| Secondary | "Search Atlas" → global search |
| Illustration | `illust-404-map` |

**Telemetry:** `error.page.viewed` `{ code: 404, path }`

---

### 3.2 ES-ERR-403 — Forbidden

**Route:** Any unauthorized  
**HTTP:** 403

| Element | Content |
|---------|---------|
| Title | "Access denied" |
| Description | "You don't have permission to view this page." |
| Primary CTA | "Go back" (history) |
| Secondary | "Request access" (enterprise) / "Contact admin" |
| Detail | Show required permission in dev mode only |

**Variants:**

| Context | Description override |
|---------|---------------------|
| Wrong org | "This resource belongs to another organization." + org switcher |
| Expired session | "Your session has expired." + login CTA |
| Plan gate | "This feature requires the {Plan} plan." + upgrade CTA |

---

### 3.3 ES-ERR-500 — Server Error

**HTTP:** 500

| Element | Content |
|---------|---------|
| Title | "Something went wrong" |
| Description | "We're having trouble loading this page. Our team has been notified." |
| Primary CTA | "Try again" (reload) |
| Secondary | "Go to dashboard" |
| Reference | Show `error_id` (UUID) for support tickets |

**Telemetry:** `error.page.viewed` `{ code: 500, error_id }`

---

### 3.4 ES-ERR-503 — Maintenance

**HTTP:** 503  
**Trigger:** Maintenance mode flag or scheduled window

| Element | Content |
|---------|---------|
| Title | "Scheduled maintenance" |
| Description | "Atlas is temporarily unavailable. We'll be back by {time} {timezone}." |
| Primary CTA | "Check status" → status page |
| Countdown | Optional live countdown to estimated completion |
| Illustration | `illust-maintenance-tools` |

No retry button during maintenance — auto-poll every 60s and redirect when healthy.

---

### 3.5 ES-ERR-OFFLINE — Offline (Full Page)

**Trigger:** Navigated while offline to uncached route

| Element | Content |
|---------|---------|
| Title | "You're offline" |
| Description | "Connect to the internet to view this page." |
| Primary CTA | "Try again" |
| Secondary | "View cached pages" → list of available offline routes |

---

## 4. Loading Skeleton Catalog

| ID | Use case | Layout |
|----|----------|--------|
| SKEL-01 | Card grid | 4 cards: image rect + 2 text lines |
| SKEL-02 | Table | 5 rows × 4 column bars |
| SKEL-03 | Detail page | Header bar + 3 content paragraphs |
| SKEL-04 | Dashboard widgets | 4 KPI boxes + 2 chart rects |
| SKEL-05 | List items | 8 rows: avatar circle + 2 lines |
| SKEL-06 | Form | Label + input × 4 |
| SKEL-07 | File browser | Tree sidebar + grid cards |
| SKEL-08 | Chat thread | Alternating left/right bubbles |
| SKEL-09 | Pipeline board | 4 columns × 3 cards each |
| SKEL-10 | Notification inbox | 10 notification rows |
| SKEL-11 | Chart | Axes + area fill gradient block |
| SKEL-12 | Profile header | Avatar + name + 2 stat boxes |

### Loading Indicators (Non-Skeleton)

| Type | When | Spec |
|------|------|------|
| Spinner | Button action, modal submit | 20px inline spinner; disable button |
| Progress bar | Determinate upload/export | 4px height; percentage label |
| Page loader | Route transition | Top progress bar (NProgress style) 2px |
| Shimmer | Image/thumbnail loading | CSS shimmer on placeholder |

---

## 5. Offline Banner (Per Module)

Global banner appears below shell header when `navigator.onLine === false`.

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠ You're offline. Some features are unavailable.  [Dismiss]│
└─────────────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Position | Fixed below header; pushes content down |
| Z-index | 8000 |
| Dismiss | Session-only; returns on next offline event |
| Color | `bg-warning-subtle` |
| `role` | `alert` |

### Module-Specific Offline Messages

| Module | Banner suffix when offline |
|--------|---------------------------|
| CRM | "Contact changes will sync when reconnected." |
| Documents | "Viewing cached files only." |
| Finance | "Finance requires an internet connection." |
| Billing | "Billing requires an internet connection." |
| Analytics | "Showing data from {cached_time}." |
| Messaging | "Messages will send when reconnected." |
| Marketplace | "Browsing cached catalog." |
| Projects | "Task updates will sync when reconnected." |

### Reconnect Toast

| Element | Content |
|---------|---------|
| Variant | `success` toast |
| Message | "Back online" |
| Duration | 3s |

---

## 6. Empty State Catalog

### 6.1 Global

| ID | Context | Title | CTA |
|----|---------|-------|-----|
| ES-GLOBAL-001 | Search no results | "No results found" | "Clear search" |
| ES-GLOBAL-002 | Filtered list empty | "No items match your filters" | "Clear filters" |
| ES-GLOBAL-003 | First-time user dashboard | "Welcome to Atlas" | "Complete setup" |
| ES-MD-001 | Master-detail no selection | "Select an item to view details" | — |

### 6.2 Marketplace (ATLAS-UI-13)

| ID | Context | Title | CTA |
|----|---------|-------|-----|
| ES-MKT-001 | Catalog search empty | "No apps found" | "Clear search" |
| ES-MKT-002 | No installed apps | "No apps installed yet" | "Browse marketplace" |
| ES-MKT-003 | Developer no apps | "Publish your first app" | "Create app" |
| ES-MKT-004 | No reviews | "No reviews yet" | "Be the first to review" |

### 6.3 Billing (ATLAS-UI-14)

| ID | Context | Title | CTA |
|----|---------|-------|-----|
| ES-BIL-001 | No invoices | "No invoices yet" | — |
| ES-BIL-002 | No payment methods | "No payment methods" | "Add payment method" |
| ES-BIL-003 | Checkout failed | "Payment couldn't be processed" | "Try again" |

### 6.4 Notifications (ATLAS-UI-15)

| ID | Context | Title | CTA |
|----|---------|-------|-----|
| ES-NT-001 | Inbox empty | "No notifications" | "Notification settings" |
| ES-NT-002 | No unread | "You're all caught up" | — |
| ES-NT-003 | Filtered empty | "No matching notifications" | "Clear filters" |

### 6.5 Documents (ATLAS-UI-16)

| ID | Context | Title | CTA |
|----|---------|-------|-----|
| ES-DC-001 | Empty folder | "This folder is empty" | "Upload files" |
| ES-DC-002 | No shared files | "No files shared with you" | — |
| ES-DC-003 | Preview unavailable | "Preview not available" | "Download file" |
| ES-DC-004 | Trash empty | "Trash is empty" | — |

### 6.6 Analytics (ATLAS-UI-17)

| ID | Context | Title | CTA |
|----|---------|-------|-----|
| ES-AN-001 | Empty dashboard | "Build your dashboard" | "Add widget" |
| ES-AN-002 | No reports | "No reports yet" | "Create report" |
| ES-AN-003 | No export jobs | "No scheduled exports" | "Schedule export" |
| ES-AN-004 | Metric no data | "No data for this period" | "Change date range" |

### 6.7 CRM (Representative)

| ID | Context | Title | CTA |
|----|---------|-------|-----|
| ES-CRM-001 | No contacts | "No contacts yet" | "Add contact" |
| ES-CRM-002 | No deals | "No deals in pipeline" | "Create deal" |
| ES-CRM-003 | No activity | "No activity yet" | "Log activity" |
| ES-CRM-004 | Empty pipeline stage | "No deals in this stage" | "Add deal" |

### 6.8 Finance (Representative)

| ID | Context | Title | CTA |
|----|---------|-------|-----|
| ES-FIN-001 | No invoices | "No invoices yet" | "Create invoice" |
| ES-FIN-002 | No expenses | "No expenses recorded" | "Add expense" |
| ES-FIN-003 | Reconciliation empty | "All caught up" | — |

### 6.9 Projects (Representative)

| ID | Context | Title | CTA |
|----|---------|-------|-----|
| ES-PRJ-001 | No projects | "No projects yet" | "Create project" |
| ES-PRJ-002 | No tasks | "No tasks yet" | "Add task" |
| ES-PRJ-003 | Board empty | "This board is empty" | "Add task" |

### 6.10 Support (Representative)

| ID | Context | Title | CTA |
|----|---------|-------|-----|
| ES-SUP-001 | No cases | "No open cases" | "Create case" |
| ES-SUP-002 | Queue empty | "Queue is empty" | — |

---

## 7. Error Handling by Context

### 7.1 API Error Mapping

| HTTP | UI treatment | User message |
|------|--------------|--------------|
| 400 | Inline field errors | Validation message per field |
| 401 | Redirect to login | "Session expired" |
| 403 | 403 page or inline | "Access denied" |
| 404 | 404 page or inline | "Not found" |
| 409 | Inline banner | "Conflict: {resource} was modified" |
| 422 | Inline field errors | Unprocessable entity details |
| 429 | Toast + retry-after | "Too many requests. Try again in {n}s." |
| 500 | Inline banner or page | "Something went wrong" |
| 503 | Maintenance page | Per ES-ERR-503 |

### 7.2 Form Submission Errors

```
┌─────────────────────────────────────────┐
│ ⚠ Couldn't save changes                 │
│   • Email is already in use             │
│   • Phone number is invalid             │
│                                         │
│   [Try again]                           │
└─────────────────────────────────────────┘
```

- Focus first error field
- `aria-invalid="true"` on fields
- Summary at form top with anchor links to fields

### 7.3 Partial Load Failure

When page has multiple data sources and one fails:

```
┌─────────────────────────────────────────┐
│ Widget: Revenue Trend                    │
│ ⚠ Couldn't load this widget    [Retry]  │
└─────────────────────────────────────────┘
```

Other widgets render normally. Page-level error only if primary data fails.

### 7.4 Timeout

After 30s without response:

| Context | Treatment |
|---------|-----------|
| Full page | ES-ERR-500 variant with "Request timed out" |
| Widget | Inline retry |
| Background | Toast notification |

---

## 8. Module Error Boundaries

React error boundaries (Phase 6) per module section:

| Boundary | Fallback |
|----------|----------|
| Module root | "Error loading {module}" + reload CTA |
| Widget | SKEL replacement → inline error |
| Modal | Error message in modal body + close |
| Shell | Full-page ES-ERR-500 |

Error boundary reports to observability with `error_id`, `module`, `component_stack`.

---

## 9. Empty vs Zero vs Error Decision Tree

```
Data fetch completed?
├── NO (loading) → Skeleton (SKEL-*)
├── NO (failed) → Inline error or error page
└── YES
    ├── Data.length > 0 → Normal render
    ├── Data.length = 0 AND filters active → ES-GLOBAL-002
    ├── Data.length = 0 AND search active → ES-GLOBAL-001
    └── Data.length = 0 → Module empty state (ES-{MODULE}-*)
```

---

## 10. Illustration Guidelines

| Rule | Spec |
|------|------|
| Style | Monoline or flat; brand palette |
| Size | 120×120 default; 200×200 hero empty states |
| Tone | Neutral-friendly; no characters on error pages |
| Dark mode | Separate `illust-*-dark` variants |
| Localization | No text in illustrations |
| Performance | SVG inline or lazy-loaded |

---

## 11. Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Empty states | `role="status"` when content loads into previously empty region |
| Errors | `role="alert"`; focus moved to error summary on form fail |
| Skeletons | `aria-busy="true"` on container; `aria-label="Loading"` |
| Error pages | Unique `<title>` per error type |
| Color | Error/warning not conveyed by color alone |
| Retry | Retry button always keyboard accessible |

---

## 12. Telemetry

| Event | Properties |
|-------|------------|
| `empty_state.viewed` | `state_id`, `module`, `screen` |
| `empty_state.cta.clicked` | `state_id`, `action` |
| `error.page.viewed` | `code`, `path`, `error_id` |
| `error.inline.viewed` | `code`, `context` |
| `error.retry.clicked` | `context`, `attempt` |
| `skeleton.timeout` | `skeleton_id`, `duration_ms` |
| `offline.banner.shown` | `module` |

---

## 13. Open Questions

| ID | Question | Owner |
|----|----------|-------|
| OQ-UI-20-01 | Custom empty state illustrations per module? | Design |
| OQ-UI-20-02 | User-dismissible error reporting widget? | Product |
| OQ-UI-20-03 | Animated empty states for onboarding? | Design |