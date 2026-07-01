---
title: Knowledge Base Module — UI Specification
document_id: ATLAS-UI-11
version: 1.0.0
status: draft
phase: 4
last_updated: 2026-06-30
module: knowledge-base
related_documents:
  - ATLAS-DB-13
  - ATLAS-ARCH-18
  - ATLAS-ARCH-08
tags:
  - ui
  - knowledge-base
  - articles
  - help-center
  - wireframes
---

# Knowledge Base Module — UI Specification

## Purpose

Complete UI specification for the **Knowledge Base** module: spaces, articles, rich-text editor, category tree, public/internal viewers, search, feedback widget, analytics, and publish/archive/suggest-edit modals. Aligns with `knowledge_base` schema (DB-13).

## Screen ID Convention

```
UI-KB-{NNN}       Screen
UI-KB-MOD-{NNN}   Modal
UI-KB-WGT-{NNN}   Embeddable widget
```

## Module Navigation

| Route | Screen ID | Label |
|-------|-----------|-------|
| `/kb` | UI-KB-001 | Spaces |
| `/kb/:spaceSlug` | UI-KB-002 | Articles |
| `/kb/:spaceSlug/articles/:articleSlug` | UI-KB-005 | Article Viewer (internal) |
| `/kb/:spaceSlug/articles/:articleSlug/edit` | UI-KB-003 | Article Editor |
| `/kb/:spaceSlug/categories` | UI-KB-004 | Categories |
| `/kb/:spaceSlug/search` | UI-KB-006 | Search Results |
| `/kb/:spaceSlug/analytics` | UI-KB-008 | Analytics |
| `/help/:spaceSlug` | UI-KB-005 | Article Viewer (public) |
| `/help/:spaceSlug/search` | UI-KB-006 | Public Search |

**Primary nav:** Knowledge icon (position 14). Public help center uses separate branded layout (no app shell).

---

## Permissions Matrix

| Permission | UI Effect |
|------------|-----------|
| `kb:spaces:read` | View space list and internal spaces |
| `kb:spaces:write` | Create/edit spaces, branding |
| `kb:articles:read` | View draft and published articles |
| `kb:articles:write` | Create/edit articles |
| `kb:articles:publish` | Publish, archive (workflow transitions) |
| `kb:articles:delete` | Permanent delete (admin) |
| `kb:categories:manage` | Edit category tree |
| `kb:analytics:read` | View search and article analytics |
| `kb:feedback:read` | View feedback inbox |
| `kb:feedback:resolve` | Resolve feedback items |
| Public (`visibility: public`) | Read published articles only; submit feedback via widget |

**Space types:** `internal`, `help_center`, `partner`, `api_docs` (BR-KB-01).

---

## Responsive Breakpoints

| Token | Range | Layout |
|-------|-------|--------|
| xs | 0–479px | Single column; category tree in drawer |
| sm | 480–767px | Article reader optimized typography |
| md | 768–1023px | Editor toolbar wraps |
| lg | 1024px+ | Three-column editor (tree / content / meta) |
| xl | 1440px+ | Max article width 720px for readability |

---

## UI-KB-001 — Space List

**Route:** `/kb`  
**Permissions:** `kb:spaces:read`

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Knowledge Base                                      [+ New space]  [🔍]      │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐         │
│ │ 📘 Internal Wiki   │ │ 🌐 Help Center     │ │ 🤝 Partner Portal  │         │
│ │ 142 articles       │ │ 89 articles        │ │ 24 articles        │         │
│ │ Organization       │ │ Public             │ │ Partner            │         │
│ │ Updated 2h ago     │ │ Updated 1d ago     │ │ Updated 1w ago     │         │
│ └────────────────────┘ └────────────────────┘ └────────────────────┘         │
└──────────────────────────────────────────────────────────────────────────────┘
```

Click card → UI-KB-002. `+ New space` → create dialog (name, slug, type, visibility).

---

## UI-KB-002 — Article List

**Route:** `/kb/:spaceSlug`  
**Permissions:** `kb:articles:read`

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Internal Wiki › Articles                    [+ New article]  [Categories →]  │
├──────────────────┬───────────────────────────────────────────────────────────┤
│ CATEGORIES       │ Status: [All▾] Author: [All▾]  Sort: [Updated▾]          │
│ ▼ Getting Started│ ┌───────────────────────────────────────────────────────┐ │
│   Account setup  │ │ Title          │ Category    │ Status   │ Updated    │ │
│   Billing        │ ├────────────────┼─────────────┼──────────┼────────────┤ │
│ ▼ Product        │ │ Quick start    │ Getting...  │ Published│ Jun 29     │ │
│   Features       │ │ API auth guide │ API docs    │ Draft    │ Jun 28     │ │
│                  │ │ Refund policy  │ Billing     │ Review   │ Jun 25     │ │
│                  │ └───────────────────────────────────────────────────────┘ │
└──────────────────┴───────────────────────────────────────────────────────────┘
```

Row click → viewer (published) or editor (draft). Status: `draft`, `review`, `published`, `archived`.

---

## UI-KB-003 — Article Editor (Rich Text)

**Route:** `/kb/:spaceSlug/articles/:articleSlug/edit`  
**Permissions:** `kb:articles:write`

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Articles / Quick start          [Save draft] [Preview] [Publish] [⋮]       │
├──────────────────┬─────────────────────────────────────────┬─────────────────┤
│ Outline          │ Title: [Quick start guide________]      │ Metadata        │
│ H1 Introduction  │ ┌─────────────────────────────────────┐ │ Slug: quick-sta │
│ H2 Step 1        │ │ B I U │ H1 H2 │ 🔗 📷 │ Code │ Callout│ │ Category: [▾]   │
│ H2 Step 2        │ ├─────────────────────────────────────┤ │ Tags: [+ add]   │
│                  │ │                                     │ │ Locale: [en ▾]  │
│                  │ │  Rich text editing area             │ │ SEO title       │
│                  │ │                                     │ │ SEO description │
│                  │ │                                     │ │ Owner: Alice    │
│                  │ └─────────────────────────────────────┘ │ Reviewers: [▾]  │
└──────────────────┴─────────────────────────────────────────┴─────────────────┘
```

### Editor Features

| Feature | Notes |
|---------|-------|
| Blocks | Paragraph, heading, list, code, callout, image, video embed, table |
| Slash commands | `/heading`, `/code`, `/callout` |
| Auto-save | Every 30s + on blur; conflict detection via `version` |
| Collaborators | Presence cursors (md+); comments inline |
| AI assist | "Improve clarity", "Generate summary" (optional, `ai:agents:execute`) |

**Publish** → UI-KB-MOD-001. Creates immutable version snapshot (BR-KB-02).

---

## UI-KB-004 — Category Tree

**Route:** `/kb/:spaceSlug/categories`  
**Permissions:** `kb:categories:manage`

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Categories — Internal Wiki                              [+ Root category]    │
├──────────────────────────────────────────────────────────────────────────────┤
│ ≡ Getting Started                                    12 articles  [Edit][×]  │
│   ≡ Account setup                                     4 articles  [Edit][×]  │
│   ≡ Billing                                           8 articles  [Edit][×]  │
│ ≡ Product                                            45 articles  [Edit][×]  │
│   ≡ Features                                         30 articles  [Edit][×]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Max depth: 5 levels (BR-KB-04)     Drag to reorder                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

Drag-drop reorder. Delete category → reassign articles prompt.

---

## UI-KB-005 — Article Viewer (Public + Internal)

**Routes:**
- Internal: `/kb/:spaceSlug/articles/:articleSlug`
- Public: `/help/:spaceSlug/articles/:articleSlug`

**Permissions:** `kb:articles:read` (internal); public for published + `visibility: public` spaces

### Wireframe — Internal

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Internal Wiki › Getting Started › Quick start          [Edit] [Suggest edit] │
├──────────────────┬───────────────────────────────────────────────────────────┤
│ On this page     │  Quick start guide                                          │
│ • Introduction   │  Last updated Jun 29, 2026 by Alice                       │
│ • Step 1         │  ─────────────────────────────────────────────────────────  │
│ • Step 2         │  (Rendered article content — max-width 720px)               │
│                  │                                                             │
│ Related articles │  ┌─────────────────────────────────────────────────────┐   │
│ • Account setup  │  │ Was this helpful?  [👍 Yes]  [👎 No]  UI-KB-WGT-001 │   │
│                  │  └─────────────────────────────────────────────────────┘   │
└──────────────────┴───────────────────────────────────────────────────────────┘
```

### Wireframe — Public Help Center

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Logo]  Help Center          [🔍 Search help articles...]        [Contact]   │
├──────────────────┬───────────────────────────────────────────────────────────┤
│ Browse topics    │  Quick start guide                                          │
│ Getting Started  │  (Same content — public branding from space.branding)       │
│ Billing          │  Feedback widget (UI-KB-WGT-001)                            │
└──────────────────┴───────────────────────────────────────────────────────────┘
```

No `Edit` on public view. `Suggest edit` available if space settings allow anonymous feedback.

---

## UI-KB-006 — Search Results

**Routes:** `/kb/:spaceSlug/search?q=` (internal), `/help/:spaceSlug/search?q=` (public)

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Search: "payment refund"                              24 results (0.12s)       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Filters: [Category▾] [Updated▾] [Type▾]                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ ★ Refund policy — Billing                                                    │
│   ...request a refund within 30 days of **payment**...                       │
│ ★ Payment methods — Account setup                                            │
│   ...accepted **payment** types include...                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

Highlight snippets. Empty → "No results" + suggest create article (internal, write perm). Logs query to analytics (BR-KB-06).

---

## UI-KB-WGT-001 — Feedback Widget

**Embedded in:** UI-KB-005 viewer footer  
**Permissions:** None (public); authenticated users attach `user_id`

### Wireframe — Collapsed

```
Was this helpful?  [👍 Yes]  [👎 No]
```

### Wireframe — Expanded (after No)

```
┌─────────────────────────────────────────┐
│ What went wrong?                        │
│ ( ) Outdated  ( ) Incorrect  ( ) Unclear│
│ Comment (optional)                      │
│ [_________________________________]     │
│ [Submit feedback]                       │
└─────────────────────────────────────────┘
```

Linked to `kb_feedback` with `article_version_id` (BR-KB-05).

---

## UI-KB-008 — Analytics

**Route:** `/kb/:spaceSlug/analytics`  
**Permissions:** `kb:analytics:read`

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ KB Analytics — Internal Wiki               Date: [Last 30 days ▾]            │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                          │
│ │ Views    │ │ Searches │ │ Helpful %│ │ Zero-hit │                          │
│ │ 12.4k    │ │ 3.2k     │ │ 78%      │ │ 142      │                          │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ Top articles by views          Top zero-result searches    Feedback backlog  │
│ 1. Quick start (2.1k)          "sso login" (45)            8 unresolved      │
│ 2. Refund policy (1.8k)        "api webhook" (32)          [View all →]      │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Modals

### UI-KB-MOD-001 — Publish

**Trigger:** Editor `Publish` button  
**Permissions:** `kb:articles:publish`

```
┌─────────────────────────────────────────┐
│ Publish article                    [×]  │
├─────────────────────────────────────────┤
│ Article: Quick start guide              │
│ Version: v4 (new snapshot)            │
│ Publish to:                             │
│ ( ) Internal only                       │
│ (●) Internal + Help Center (public)     │
│ Scheduled publish: [Now ▾]              │
│ ☑ Notify subscribers                    │
│ ☑ Trigger AI memory ingest (BR-KB-07)   │
│ Review checklist:                       │
│ [☑] Links verified [☑] SEO filled       │
├─────────────────────────────────────────┤
│ [Cancel]              [Publish now]     │
└─────────────────────────────────────────┘
```

---

### UI-KB-MOD-002 — Archive

**Trigger:** Article `⋮` → Archive, editor archive action  
**Permissions:** `kb:articles:publish`

```
┌─────────────────────────────────────────┐
│ Archive article                    [×]  │
├─────────────────────────────────────────┤
│ Archive "Refund policy"?                │
│ • Removed from public help center       │
│ • Redirect: [301 to replacement ▾]      │
│ • Replacement article: [Search... ▾]    │
│ Reason (optional):                      │
│ [_________________________________]     │
├─────────────────────────────────────────┤
│ [Cancel]              [Archive]         │
└─────────────────────────────────────────┘
```

---

### UI-KB-MOD-003 — Suggest Edit

**Trigger:** Viewer `Suggest edit` (internal or public if enabled)  
**Permissions:** Any authenticated user (internal); public optional per space setting

```
┌─────────────────────────────────────────┐
│ Suggest an edit                    [×]  │
├─────────────────────────────────────────┤
│ Article: Quick start guide              │
│ Section: [Step 2 — Installation ▾]      │
│ Suggested change *                      │
│ [_________________________________]     │
│ [_________________________________]     │
│ [_________________________________]     │
│ Your email (public only):               │
│ [_________________________________]     │
├─────────────────────────────────────────┤
│ [Cancel]              [Submit]          │
└─────────────────────────────────────────┘
```

Creates feedback item type `suggested_edit` for editorial workflow.

---

## Cross-Cutting Requirements

### Accessibility

- Article content: proper heading hierarchy enforced in editor.
- Public help: skip link, focus visible on search.
- Feedback widget: keyboard-operable thumbs up/down.

### Localization

- `supported_locales` per space; locale switcher in viewer header.
- Fallback chain: requested locale → default_locale → en.

### SEO (Public)

- Canonical URLs, Open Graph from SEO fields.
- Sitemap generation per public space.

### Performance

- Public pages: ISR/CDN cache; stale-while-revalidate.
- Search: OpenSearch < 200ms p95.

### AI Integration

- Publish triggers `memory.ingest.requested` (BR-KB-07).
- AI panel can cite KB articles with version badge.

---

## Screen Index

| ID | Name |
|----|------|
| UI-KB-001 | Space List |
| UI-KB-002 | Article List |
| UI-KB-003 | Article Editor |
| UI-KB-004 | Category Tree |
| UI-KB-005 | Article Viewer |
| UI-KB-006 | Search Results |
| UI-KB-008 | Analytics |
| UI-KB-WGT-001 | Feedback Widget |
| UI-KB-MOD-001 | Publish |
| UI-KB-MOD-002 | Archive |
| UI-KB-MOD-003 | Suggest Edit |