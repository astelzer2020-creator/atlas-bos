---
title: Marketing Module — UI Specification
document_id: ATLAS-UI-09
version: 1.0.0
status: draft
phase: 4
last_updated: 2026-06-30
module: marketing
related_documents:
  - ATLAS-DB-10
  - ATLAS-ARCH-08
  - ATLAS-ARCH-16
tags:
  - ui
  - marketing
  - campaigns
  - email
  - segments
  - wireframes
---

# Marketing Module — UI Specification

## Purpose

Complete UI specification for the **Marketing** module: campaign management, visual campaign builder, email templates, audience segments, landing pages, attribution analytics, and subscriber lists. Aligns with `marketing` schema (DB-10).

## Screen ID Convention

```
UI-MKT-{NNN}       Screen
UI-MKT-MOD-{NNN}   Modal
```

## Module Navigation

| Route | Screen ID | Label |
|-------|-----------|-------|
| `/marketing` | UI-MKT-001 | Campaigns |
| `/marketing/campaigns/:id` | UI-MKT-002 | Campaign Builder |
| `/marketing/templates` | UI-MKT-003 | Email Templates |
| `/marketing/segments` | UI-MKT-004 | Segments |
| `/marketing/segments/:id` | UI-MKT-004 | Segment Builder |
| `/marketing/landing-pages` | UI-MKT-005 | Landing Pages |
| `/marketing/analytics` | UI-MKT-006 | Analytics |
| `/marketing/subscribers` | UI-MKT-007 | Subscriber Lists |

**Primary nav:** Marketing icon (position 11). Breadcrumbs: `Marketing` → subsection → entity name.

---

## Permissions Matrix

| Permission | UI Effect |
|------------|-----------|
| `marketing:campaigns:read` | View campaign list, builder (read-only) |
| `marketing:campaigns:write` | Create/edit campaigns, schedule, pause |
| `marketing:campaigns:send` | Launch/send campaigns (may require approval workflow) |
| `marketing:campaigns:delete` | Cancel/delete draft campaigns |
| `marketing:templates:read` | View email templates |
| `marketing:templates:write` | Create/edit templates |
| `marketing:segments:read` | View segments and audience counts |
| `marketing:segments:write` | Create/edit segment rules |
| `marketing:landing_pages:read` | View landing pages |
| `marketing:landing_pages:write` | Create/edit/publish pages |
| `marketing:subscribers:read` | View lists and subscribers |
| `marketing:subscribers:write` | Import, edit, unsubscribe management |
| `marketing:analytics:read` | View attribution dashboard |
| `marketing:settings:manage` | UTM defaults, sending domains, compliance |

**Compliance gates:** CAN-SPAM/GDPR — unsubscribe link required on templates; double opt-in enforced when list `require_confirmation = true` (BR-MKT-06).

---

## Responsive Breakpoints

| Token | Range | Notes |
|-------|-------|-------|
| xs | 0–479px | Campaign builder read-only preview; edit on md+ |
| sm | 480–767px | Simplified analytics cards |
| md | 768–1023px | Builder split view |
| lg | 1024px+ | Full builder + preview |
| xl | 1440px+ | Analytics multi-panel |

---

## UI-MKT-001 — Campaign List

**Route:** `/marketing`  
**Permissions:** `marketing:campaigns:read`

### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Marketing — Campaigns                    [🔍] [Status▾] [Channel▾] [+ Campaign]│
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Name              │ Type      │ Status    │ Audience │ Sent    │ Open Rate│ │
│ ├───────────────────┼───────────┼───────────┼──────────┼─────────┼──────────┤ │
│ │ Summer Promo 2026 │ One-time  │ ● Active  │ 12.4k    │ Jun 28  │ 24.3%    │ │
│ │ Onboarding Drip   │ Drip      │ ● Active  │ Segment  │ —       │ 41.2%    │ │
│ │ Subject Line Test │ A/B Test  │ ○ Draft   │ 8.1k     │ —       │ —        │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ Quick stats: 3 active │ 1 scheduled │ 2 drafts              [Analytics →]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Behavior |
|-----------|----------|
| Row click | Opens UI-MKT-002 |
| Status badge | `draft`, `scheduled`, `active`, `paused`, `completed`, `cancelled` |
| `+ Campaign` | UI-MKT-MOD-001 |
| Bulk actions | Pause, duplicate (write permission) |

### States

| State | Treatment |
|-------|-----------|
| Empty | "Create your first campaign" + template suggestions |
| Loading | Table skeleton |
| Filtered empty | Clear filters CTA |

### Responsive

| Breakpoint | Behavior |
|------------|----------|
| xs–sm | Card list (no table); key metrics only |
| md+ | Full data table with sortable columns |

---

## UI-MKT-002 — Campaign Builder (Visual)

**Route:** `/marketing/campaigns/:id`  
**Permissions:** `marketing:campaigns:read` (view); `marketing:campaigns:write` (edit)

### Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Campaigns / Summer Promo 2026        [Save draft] [Preview] [Schedule ▾]   │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Builder◉] [Settings] [Audience] [Analytics]                                 │
├────────────────────────────┬─────────────────────────────────────────────────┤
│ STEP PALETTE               │ CANVAS                                          │
│ ┌────────────────────────┐ │ ┌─────┐    ┌─────┐    ┌─────┐                  │
│ │ 📧 Send Email          │ │ │Start│───▶│Email│───▶│Wait │───▶ ...           │
│ │ ⏱ Wait                 │ │ └─────┘    └─────┘    │ 2d  │                  │
│ │ 🔀 Condition           │ │                     └─────┘                  │
│ │ ⚡ Action              │ │  [Selected: Email step — edit in right panel]   │
│ │ 🔗 Landing Page        │ ├─────────────────────────────────────────────────┤
│ └────────────────────────┘ │ PROPERTIES PANEL                                │
│                            │ Subject: [Summer sale — 20% off]                │
│                            │ Template: [Promo v3 ▾]  [Edit template]         │
│                            │ UTM: source=email medium=campaign               │
└────────────────────────────┴─────────────────────────────────────────────────┘
```

### Campaign Types

| Type | Builder Behavior |
|------|------------------|
| `one_time` | Linear or single email node |
| `drip` | Multi-step with wait/condition nodes |
| `triggered` | Entry trigger node (event/webhook) |
| `ab_test` | Split node → UI-MKT-MOD-002 |

### Interactions

| Action | Permission | Result |
|--------|------------|--------|
| Drag step from palette | write | Add node to canvas |
| Connect nodes | write | Validate DAG (no cycles) |
| `Preview` | read | UI-MKT-MOD-003 |
| `Schedule` | send | Datetime picker + audience confirmation |
| `Settings` tab | write | Goal, budget, UTM campaign tag |

### Validation

- Cannot schedule without audience (segment or list).
- Email steps require published template version.
- Unpublished changes show "Draft changes" badge.

### Responsive

| Breakpoint | Behavior |
|------------|----------|
| xs–sm | Tabbed list of steps (no canvas); read-only flow diagram image |
| md | Canvas 60% width; palette collapsed to icons |
| lg+ | Full three-panel builder |

---

## UI-MKT-003 — Email Templates

**Route:** `/marketing/templates`  
**Permissions:** `marketing:templates:read`

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Email Templates                              [+ New template]  [Import HTML] │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐                   │
│ │ [preview]  │ │ [preview]  │ │ [preview]  │ │ [preview]  │                   │
│ │ Welcome v2 │ │ Promo v3   │ │ Newsletter │ │ Receipt    │                   │
│ │ Published  │ │ Draft      │ │ Published  │ │ Published  │                   │
│ │ Jun 20     │ │ Jun 29     │ │ May 1      │ │ Apr 12     │                   │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Template Editor (sub-view)

Split: block palette | WYSIWYG canvas | HTML/code toggle.

Blocks: Header, Text, Image, Button, Divider, Footer (unsubscribe required block).

Version history sidebar (BR-MKT-03). Publish creates immutable version.

---

## UI-MKT-004 — Segments Builder

**Route:** `/marketing/segments` (list) / `/marketing/segments/:id` (builder)  
**Permissions:** `marketing:segments:read` / `write`

### Wireframe — Builder

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Segment: High-Value Leads                              [Save] [Preview count]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Match [All ▾] of the following groups:                                       │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Group 1                                                          [Remove]│ │
│ │ [Contact field ▾] [equals ▾] [Customer ▾]                              │ │
│ │ [+ Add condition]                                                       │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ [+ Add group (OR)]                                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ Estimated audience: 3,842 contacts (refreshed 2m ago) [↻ Refresh]            │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Conditions evaluate CRM contact attributes at send time (BR-MKT-02).
- Preview count debounced 500ms; server-side evaluation.

---

## UI-MKT-005 — Landing Pages

**Route:** `/marketing/landing-pages`  
**Permissions:** `marketing:landing_pages:read`

### List + Visual Editor

Similar to template editor with page sections: Hero, Form, CTA, FAQ, Footer.

| Field | Constraint |
|-------|------------|
| Slug | Unique per org (BR-MKT-04) |
| Status | `draft`, `published`, `archived` |
| Form | Maps to CRM lead capture + optional list subscription |

Publish → CDN URL: `{org}.pages.atlas.app/{slug}` or custom domain.

### Responsive

Page editor always shows mobile/desktop preview toggle.

---

## UI-MKT-006 — Analytics / Attribution Dashboard

**Route:** `/marketing/analytics`  
**Permissions:** `marketing:analytics:read`

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Marketing Analytics          Date: [Last 30 days ▾]  Compare: [Previous ▾]   │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                          │
│ │ Sends    │ │ Opens    │ │ Clicks   │ │ Conv.    │                          │
│ │ 48.2k    │ │ 12.1k    │ │ 3.4k     │ │ 412      │                          │
│ │ +12%     │ │ +8%      │ │ +5%      │ │ +18%     │                          │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ Attribution model: [Last touch ▾]                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐  │
│ │ Channel performance (bar chart)                                         │  │
│ └─────────────────────────────────────────────────────────────────────────┘  │
│ ┌──────────────────────────────┐ ┌────────────────────────────────────────┐  │
│ │ Campaign funnel              │ │ UTM source / medium breakdown          │  │
│ └──────────────────────────────┘ └────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Top campaigns by ROI                    Recent attribution events [table]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

Attribution events append-only (BR-MKT-05). Export CSV on lg+.

---

## UI-MKT-007 — Subscriber Lists

**Route:** `/marketing/subscribers`  
**Permissions:** `marketing:subscribers:read`

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Subscriber Lists                                    [+ New list] [Import CSV]│
├──────────────────────────────────────────────────────────────────────────────┤
│ List name          │ Subscribers │ Opt-in      │ Growth │ Last import        │
│ Newsletter         │ 24,102      │ Double      │ +2.1%  │ Jun 25             │
│ Product updates    │ 8,441       │ Single      │ +0.8%  │ Jun 10             │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Selected list: Newsletter]                                                  │
│ Search subscribers...  Status: [Subscribed▾]                                 │
│ email@example.com  Subscribed  Jun 1  Source: Form  [View] [Unsubscribe]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

Detail drawer: subscription history, consent timestamp, GDPR export/delete.

---

## Modals

### UI-MKT-MOD-001 — Create Campaign

**Trigger:** `+ Campaign` on UI-MKT-001  
**Permissions:** `marketing:campaigns:write`

```
┌─────────────────────────────────────────┐
│ Create campaign                    [×]  │
├─────────────────────────────────────────┤
│ Campaign name *                         │
│ [_________________________________]     │
│ Type:                                   │
│ ( ) One-time  ( ) Drip  ( ) Triggered   │
│ ( ) A/B Test                            │
│ Channel: [Email ▾]                      │
│ Goal: [Lead gen ▾]                      │
│ Start from:                             │
│ ( ) Blank  ( ) Template  ( ) Duplicate  │
├─────────────────────────────────────────┤
│ [Cancel]         [Create & open builder]│
└─────────────────────────────────────────┘
```

---

### UI-MKT-MOD-002 — A/B Test Setup

**Trigger:** Campaign builder → add/split A/B node, or create A/B campaign type  
**Permissions:** `marketing:campaigns:write`

```
┌─────────────────────────────────────────┐
│ A/B test configuration             [×]  │
├─────────────────────────────────────────┤
│ Test name: [Subject line test]          │
│ Variable: [Subject line ▾]              │
│ Variant A: [Summer sale — 20% off]      │
│ Variant B: [Save 20% this weekend]      │
│ Split: [50]% / [50]%                    │
│ Winner metric: [Open rate ▾]            │
│ Test duration: [4] hours                │
│ Auto-send winner: [☑]                   │
├─────────────────────────────────────────┤
│ [Cancel]                    [Apply]     │
└─────────────────────────────────────────┘
```

---

### UI-MKT-MOD-003 — Preview Email

**Trigger:** Builder `Preview`, template editor preview  
**Permissions:** `marketing:campaigns:read`

```
┌─────────────────────────────────────────────────────────┐
│ Email preview                                      [×]  │
├─────────────────────────────────────────────────────────┤
│ Send test to: [you@company.com]  [Send test]            │
│ Preview as: [Desktop◉] [Mobile]                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │  Rendered email (iframe sandbox)                    │ │
│ │  From: Marketing <noreply@company.com>              │ │
│ │  Subject: Summer sale — 20% off                     │ │
│ └─────────────────────────────────────────────────────┘ │
│ Personalization sample: [Contact ▾] Alice Example       │
├─────────────────────────────────────────────────────────┤
│ [Close]                                                 │
└─────────────────────────────────────────────────────────┘
```

---

## Cross-Cutting Requirements

### Accessibility

- Campaign canvas: keyboard-navigable step list alternative.
- Color contrast on analytics charts ≥ 4.5:1; patterns not color-only.
- Template editor: semantic heading blocks in exported HTML.

### Localization

- Multi-language templates: locale tabs in editor.
- Subscriber date formats per user locale.

### Performance

- Segment count: async job for > 50k contacts with progress indicator.
- Analytics: pre-aggregated metrics; drill-down on demand.

### Audit

- Campaign send logged to audit events with actor, audience size, template version.

---

## Screen Index

| ID | Name |
|----|------|
| UI-MKT-001 | Campaign List |
| UI-MKT-002 | Campaign Builder |
| UI-MKT-003 | Email Templates |
| UI-MKT-004 | Segments Builder |
| UI-MKT-005 | Landing Pages |
| UI-MKT-006 | Analytics / Attribution Dashboard |
| UI-MKT-007 | Subscriber Lists |
| UI-MKT-MOD-001 | Create Campaign |
| UI-MKT-MOD-002 | A/B Test Setup |
| UI-MKT-MOD-003 | Preview Email |