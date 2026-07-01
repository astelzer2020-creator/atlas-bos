---
title: Analytics UI Specification
document_id: ATLAS-UI-17
version: 1.0.0
status: approved
phase: 4
last_updated: 2026-06-30
module: analytics
related_documents:
  - ATLAS-DB-19
  - ADR-0009
  - ATLAS-UI-19
  - ATLAS-UI-18
  - ATLAS-UI-20
tags:
  - analytics
  - dashboards
  - reports
  - widgets
  - metrics
---

# Analytics UI Specification

## Document Control

| Field | Value |
|-------|-------|
| **Module** | Analytics |
| **Screen count** | 6 screens, 0 modals, 3 drawers |
| **Widget types** | chart, table, KPI, funnel, map |
| **Primary personas** | P1 (Owner), P4 (Accountant), P5 (Sales) |
| **Route prefix** | `/analytics` |

---

## 1. Purpose & Scope

Define business intelligence UI: customizable home dashboard, report builder, metric explorer, dashboard gallery, export scheduler, and embedded analytics patterns within other modules. Aligns with `analytics.*` schema.

### In Scope

- Widget-based dashboard composition
- Five widget types with configuration panels
- Report builder with scheduling
- Metric catalog exploration
- CSV/PDF export
- Embedded analytics slots in CRM, Finance, Projects

### Out of Scope

- Raw SQL query interface (enterprise v1.1)
- ML forecasting widgets (AI module integration — Phase 5)
- Real-time sub-second streaming dashboards

---

## 2. Navigation & Information Architecture

```
Analytics (/analytics)
├── Home Dashboard (/analytics)                    → AN-S01
├── Dashboard Gallery (/analytics/dashboards)      → AN-S04
├── Dashboard Editor (/analytics/dashboards/:id)   → AN-S01 (edit mode)
├── Report Builder (/analytics/reports/builder)    → AN-S02
├── Reports (/analytics/reports)                   → List + AN-S02
├── Metric Explorer (/analytics/metrics)           → AN-S03
├── Metric Detail (/analytics/metrics/:code)        → AN-S03
└── Export Scheduler (/analytics/exports)          → AN-S05

Embedded (module slots)
├── CRM: Pipeline dashboard widget
├── Finance: Revenue KPI strip
├── Projects: Burndown embed
└── Support: SLA metrics embed
```

---

## 3. Screen Inventory

| ID | Screen | Route | Permission gate |
|----|--------|-------|-----------------|
| AN-S01 | Home Dashboard | `/analytics`, `/analytics/dashboards/:id` | `analytics:dashboards:read` |
| AN-S02 | Report Builder | `/analytics/reports/builder`, `/analytics/reports/:id` | `analytics:reports:write` |
| AN-S03 | Metric Explorer | `/analytics/metrics`, `/analytics/metrics/:code` | `analytics:metrics:read` |
| AN-S04 | Dashboard Gallery | `/analytics/dashboards` | `analytics:dashboards:read` |
| AN-S05 | Export Scheduler | `/analytics/exports` | `analytics:exports:manage` |
| AN-S06 | Embedded Analytics | Module routes (pattern) | Module read + `analytics:embed:read` |

### Drawers

| ID | Surface | Trigger |
|----|---------|---------|
| AN-D01 | Widget Config | Add/edit widget |
| AN-D02 | Dashboard Settings | Dashboard metadata |
| AN-D03 | Export Config | Schedule export from dashboard |

---

## 4. Widget Type Specifications

### 4.1 KPI Widget

```
┌─────────────────────┐
│ Revenue (MTD)       │
│ $124,500            │
│ ▲ 12.3% vs last mo  │
└─────────────────────┘
```

| Property | Options |
|----------|---------|
| Metric | Single metric from catalog |
| Comparison | Previous period, YoY, target |
| Format | Currency, number, percent, duration |
| Size | 1×1, 2×1 grid units |
| Thresholds | Green/amber/red bands |
| Sparkline | Optional 30-day mini chart |

### 4.2 Chart Widget

| Chart type | Use case |
|------------|----------|
| Line | Time series trends |
| Bar | Category comparison |
| Stacked bar | Composition over time |
| Area | Volume trends |
| Pie/Donut | Part-to-whole (max 8 slices) |
| Combo | Dual-axis line + bar |

| Config | Options |
|--------|---------|
| Metrics | 1–3 series |
| Dimension | Group by field (owner, stage, region) |
| Date range | Inherited from dashboard or override |
| Granularity | Hour, day, week, month |
| Legend | Bottom or right; toggle series |

### 4.3 Table Widget

| Property | Options |
|----------|---------|
| Data source | Metric + dimensions or report query |
| Columns | Drag-reorder, show/hide |
| Sort | Default sort column |
| Pagination | 10/25/50 rows |
| Row click | Drill-through to entity |
| Conditional format | Rules on cell values |

### 4.4 Funnel Widget

```
  Leads ████████████████  1,200
    ↓ 45%
  Qualified ██████████      540
    ↓ 32%
  Proposal ████             173
    ↓ 28%
  Won ██                     48
```

| Property | Options |
|----------|---------|
| Stages | 3–8 ordered stages |
| Metric | Count or sum per stage |
| Conversion | Show % between stages |
| Time window | Filter funnel cohort |
| Compare | Overlay previous period (ghost bars) |

### 4.5 Map Widget

| Property | Options |
|----------|---------|
| Geo field | Country, state, city, custom lat/lng |
| Metric | Aggregated value per region |
| Map type | Choropleth, bubble map |
| Basemap | Light, dark (match theme) |
| Interaction | Hover tooltip, click drill-down |

---

## 5. Screen Specifications

### AN-S01 — Home Dashboard

**Routes:** `/analytics` (default dashboard), `/analytics/dashboards/:id`

#### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ Executive Dashboard    [Date: Last 30 days ▼]  [Edit] [Share] [⋮]│
├──────────────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                   │
│ │ KPI     │ │ KPI     │ │ KPI     │ │ KPI     │                   │
│ │ Revenue │ │ Deals   │ │ NPS     │ │ Churn   │                   │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘                   │
│ ┌──────────────────────────────┐ ┌──────────────────────────────┐  │
│ │ Chart: Revenue trend         │ │ Chart: Pipeline by stage    │  │
│ │                              │ │                              │  │
│ └──────────────────────────────┘ └──────────────────────────────┘  │
│ ┌──────────────────────────────┐ ┌──────────┐ ┌──────────┐       │
│ │ Table: Top deals             │ │ Funnel   │ │ Map      │       │
│ └──────────────────────────────┘ └──────────┘ └──────────┘       │
└──────────────────────────────────────────────────────────────────┘
```

#### Grid System

| Property | Value |
|----------|-------|
| Columns | 12 |
| Row height | 80px |
| Gap | 16px |
| Min widget size | 2×2 units |
| Max widget size | 12×8 units |
| Drag resize | Edit mode only |

#### Global Date Range

- Presets: Today, 7d, 30d, 90d, YTD, Custom
- Applies to all widgets unless widget has override (badge icon)
- Comparison toggle: "Compare to previous period"

#### Edit Mode

- Toggle via `Edit` button or `analytics:dashboards:write`
- Drag widgets to reposition; resize handles
- `+ Add widget` opens widget type picker
- Widget header menu: Configure, Duplicate, Remove
- Save / Cancel / Revert

#### Dashboard Switcher

- Dropdown in header: list user's dashboards + shared + system templates
- Star default dashboard

#### Empty Dashboard

ES-AN-001: "Add your first widget" with template suggestions.

---

### AN-S02 — Report Builder

**Routes:** `/analytics/reports/builder`, `/analytics/reports/:id`

#### Builder Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ Report Builder: Monthly Sales Summary              [Save] [Run] │
├──────────────┬───────────────────────────────────────────────────┤
│ Data         │ Preview                                           │
│ ───────────  │ ┌───────────────────────────────────────────────┐ │
│ Source       │ │ Live preview table/chart                      │ │
│ CRM Deals ▼  │ │                                               │ │
│              │ └───────────────────────────────────────────────┘ │
│ Fields       │                                                   │
│ ☑ Amount     │ Filters: Stage = Won, Date = This month          │
│ ☑ Owner      │ Group by: Owner                                   │
│ ☑ Close date │ Sort: Amount DESC                                 │
│              │                                                   │
│ Schedule     │ [Configure schedule →]                            │
└──────────────┴───────────────────────────────────────────────────┘
```

#### Data Source Picker

| Source type | Examples |
|-------------|----------|
| Module entities | Deals, Invoices, Tasks, Cases |
| Metrics | Pre-aggregated from catalog |
| Custom report | Saved report as sub-query (v1.1) |

#### Field Selector

- Dimensions: groupable fields
- Measures: aggregatable numeric fields
- Calculated fields: formula builder (sum, avg, count, custom)

#### Filters

- Visual filter builder: field, operator, value
- AND/OR groups
- Relative date filters: "last N days", "this quarter"

#### Output Formats

| Format | Delivery |
|--------|----------|
| Table | In-app preview |
| Chart | Select chart type |
| PDF | Scheduled export |
| CSV | Download or scheduled |
| Email body | Summary in digest |

#### Schedule (links to AN-S05)

- Cron builder UI (friendly: daily, weekly, monthly)
- Recipients: users, teams, external emails (admin)
- Timezone aware

---

### AN-S03 — Metric Explorer

**Routes:** `/analytics/metrics`, `/analytics/metrics/:code`

#### Catalog View

```
┌──────────────────────────────────────────────────────────────────┐
│ Metric Explorer                              [🔍 Search metrics] │
├──────────────┬───────────────────────────────────────────────────┤
│ Categories   │ ┌─────────────────────────────────────────────┐   │
│ ───────────  │ │ crm.pipeline_value                         │   │
│ Revenue      │ │ Total open pipeline value                   │   │
│ Sales        │ │ Unit: USD  •  Source: CRM Deals            │   │
│ Support      │ └─────────────────────────────────────────────┘   │
│ Operations   │ ...                                               │
│ Custom       │                                                   │
└──────────────┴───────────────────────────────────────────────────┘
```

#### Metric Detail Page

- Definition: name, description, formula (human-readable)
- Current value KPI with trend
- Historical chart (configurable range)
- Breakdown by dimension (table)
- "Add to dashboard" CTA
- Related metrics sidebar
- Lineage: source events, upstream modules

---

### AN-S04 — Dashboard Gallery

**Route:** `/analytics/dashboards`

#### Sections

| Section | Content |
|---------|---------|
| My dashboards | User-created |
| Shared with me | Team/tenant shared |
| Atlas templates | Pre-built by module (CRM Executive, Finance Close, etc.) |
| Recent | Last 5 viewed |

#### Dashboard Card

- Thumbnail preview (auto-generated screenshot or widget mosaic)
- Title, owner, last modified
- Visibility badge: Private, Team, Organization
- Actions: Open, Duplicate, Delete (owner only)

#### Template Gallery

- Filter by module, role persona
- "Use template" → creates copy in My dashboards

---

### AN-S05 — Export Scheduler

**Route:** `/analytics/exports`

#### Export Jobs Table

| Column | Notes |
|--------|-------|
| Name | Report or dashboard name |
| Source | Report/Dashboard link |
| Format | CSV, PDF, XLSX |
| Schedule | Human-readable cron |
| Recipients | Count + tooltip list |
| Last run | Status + timestamp |
| Next run | Scheduled time |
| Actions | Edit, Run now, Pause, Delete |

#### Export Job Editor (AN-D03)

| Field | Spec |
|-------|------|
| Source | Report or dashboard picker |
| Format | CSV, PDF, XLSX |
| Schedule | Visual cron builder |
| Recipients | Email chips |
| Filename pattern | Template with date tokens |
| Expiry notice | "Exports available 7 days" |

#### Run History

Expandable row: last 10 runs with status (`success`, `failed`, `running`), download link if within TTL.

---

### AN-S06 — Embedded Analytics (Pattern)

Not a standalone route — specification for embedding in module pages.

#### Embed Slot Component

```
┌─────────────────────────────────────────────────────────────┐
│ Pipeline Overview                           [Open in Analytics]│
├─────────────────────────────────────────────────────────────┤
│ [KPI strip: 3-4 compact KPIs]                               │
│ [Single chart or table — max height 320px]                  │
└─────────────────────────────────────────────────────────────┘
```

| Property | Spec |
|----------|------|
| Registration | Module declares `analytics_embed_id` in config |
| Data scope | Inherits module context filters (e.g., current workspace) |
| Height | Fixed 320px default; expandable to fullscreen |
| Interactions | Click drill-through to module entity or full dashboard |
| Loading | Skeleton matching widget layout |
| Permission | Module read + `analytics:embed:read` |
| Empty | Hide slot if no permission or no data (no broken UI) |

#### Registered Embeds (v1)

| Module | Location | Widgets |
|--------|----------|---------|
| CRM | Pipeline page header | KPI strip + funnel |
| Finance | Overview | Revenue KPI + AR aging chart |
| Projects | Project detail | Burndown chart |
| Support | Dashboard | SLA KPI + case volume |
| HR | Overview | Headcount KPI + hiring funnel |

---

## 6. Widget Configuration Drawer (AN-D01)

| Section | Fields |
|---------|--------|
| General | Title, subtitle |
| Data | Metric/query picker, dimensions |
| Appearance | Chart type, colors, legend |
| Filters | Widget-level filter overrides |
| Thresholds | KPI bands |
| Size | Grid size readout |

Live preview updates as config changes (debounced 500ms).

---

## 7. Permissions & Visibility

| Action | Permission | UI rule |
|--------|------------|---------|
| View dashboards | `analytics:dashboards:read` | Hide Analytics nav |
| Edit dashboards | `analytics:dashboards:write` | View-only mode |
| Share dashboards | `analytics:dashboards:share` | Hide share button |
| Build reports | `analytics:reports:write` | — |
| Manage exports | `analytics:exports:manage` | — |
| View metrics catalog | `analytics:metrics:read` | — |
| Embedded widgets | `analytics:embed:read` | Hide embed slots |

Row-level: metrics respect module data permissions (user sees only their deals in CRM widgets).

---

## 8. Responsive Behavior

| Breakpoint | Adaptation |
|------------|------------|
| Mobile | Single column widget stack; simplified charts |
| Tablet | 6-column grid; drawer config full-screen |
| Desktop | 12-column grid |

Charts: touch-friendly tooltips; pinch zoom on time series.

---

## 9. Performance Requirements

| Metric | Target |
|--------|--------|
| Dashboard load P95 | < 2s (cached snapshots) |
| Widget refresh | Stale-while-revalidate; skeleton on fetch |
| Report preview | < 5s for 10K rows |
| Export generation | Async; notify on completion |

Cache indicator: "Data as of 15 min ago" with manual refresh button.

---

## 10. Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Charts | Data table alternative toggle per widget |
| Color | Colorblind-safe palette; pattern fills |
| KPI | `aria-label` with value + trend direction |
| Dashboard edit | Keyboard drag alternative (position inputs) |
| Tables | Sortable headers with `aria-sort` |

---

## 11. Telemetry Events

| Event | Properties |
|-------|------------|
| `analytics.dashboard.viewed` | `dashboard_id`, `widget_count` |
| `analytics.widget.added` | `widget_type`, `dashboard_id` |
| `analytics.report.run` | `report_id`, `row_count`, `duration_ms` |
| `analytics.export.scheduled` | `format`, `schedule` |
| `analytics.metric.explored` | `metric_code` |
| `analytics.embed.clicked` | `embed_id`, `module` |

---

## 12. Open Questions

| ID | Question | Owner |
|----|----------|-------|
| OQ-UI-17-01 | Custom SQL reports for Enterprise? | Product |
| OQ-UI-17-02 | Dashboard TV mode / kiosk? | v1.1 |
| OQ-UI-17-03 | Real-time websocket widget updates? | Engineering |