---
title: Marketplace UI Specification
document_id: ATLAS-UI-13
version: 1.0.0
status: approved
phase: 4
last_updated: 2026-06-30
module: marketplace
related_documents:
  - ATLAS-DB-15
  - ATLAS-ARCH-11
  - ATLAS-UI-19
  - ATLAS-UI-18
  - ATLAS-UI-20
tags:
  - marketplace
  - app-store
  - oauth
  - developer-portal
  - install-flow
---

# Marketplace UI Specification

## Document Control

| Field | Value |
|-------|-------|
| **Module** | Marketplace |
| **Screen count** | 12 screens, 4 modals, 2 drawers |
| **Primary personas** | P1 (SMB Owner), P2 (Enterprise Admin), Developer Partner |
| **Route prefix** | `/marketplace`, `/settings/integrations/apps`, `/developer` |
| **Design system** | Atlas DS v1 — see `01-design-system.md` (pending) |

---

## 1. Purpose & Scope

Define all user-facing surfaces for the Atlas App Store: discovery, installation, permission consent, installed app management, reviews, and the developer partner portal. Aligns with `marketplace.*` schema and OAuth scope model from `ATLAS-DB-15`.

### In Scope

- Consumer-facing catalog and install lifecycle
- Tenant admin installed-apps management
- Developer portal (submit, version, analytics)
- Permission grant / re-consent flows
- Review submission and moderation states

### Out of Scope

- Integration connector runtime UI (`11-integrations.md`)
- Stripe Connect payout UI for developers (Phase 5)
- App sandbox / test tenant provisioning (v1.1)

---

## 2. Navigation & Information Architecture

```
Marketplace (top-level nav item — Growth+ tiers)
├── Browse (/marketplace)
│   ├── Categories (/marketplace/categories/:slug)
│   └── Search results (/marketplace/search?q=)
├── App Detail (/marketplace/apps/:slug)
├── Installed Apps (/settings/integrations/apps)  [Admin nav]
│   └── App Settings (/settings/integrations/apps/:installationId)
└── Reviews (/marketplace/apps/:slug/reviews)

Developer Portal (/developer)  [Separate nav; requires developer account]
├── Dashboard (/developer)
├── My Apps (/developer/apps)
│   ├── New App (/developer/apps/new)
│   └── App Detail (/developer/apps/:appId)
│       ├── Versions (/developer/apps/:appId/versions)
│       ├── Permissions (/developer/apps/:appId/permissions)
│       └── Analytics (/developer/apps/:appId/analytics)
└── Account Settings (/developer/settings)
```

### Entry Points

| Source | Destination | Condition |
|--------|-------------|-----------|
| Main nav → Marketplace | MP-S01 Catalog | `marketplace:apps:browse` |
| Settings → Integrations → Apps | MP-S04 Installed Apps | `marketplace:installations:read` |
| App deep link | MP-S02 App Detail | Public for published apps |
| Developer signup CTA | `/developer/onboarding` | Authenticated user |
| Install CTA from module | MP-S03 Install Flow | Missing installation |

---

## 3. Screen Inventory

| ID | Screen | Route | Permission gate |
|----|--------|-------|-----------------|
| MP-S01 | App Catalog | `/marketplace` | `marketplace:apps:browse` |
| MP-S02 | App Detail | `/marketplace/apps/:slug` | `marketplace:apps:browse` |
| MP-S03 | Install Flow | `/marketplace/apps/:slug/install` | `marketplace:installations:create` |
| MP-S04 | Installed Apps | `/settings/integrations/apps` | `marketplace:installations:read` |
| MP-S05 | Installed App Settings | `/settings/integrations/apps/:id` | `marketplace:installations:manage` |
| MP-S06 | Developer Dashboard | `/developer` | `marketplace:developer:access` |
| MP-S07 | Submit App | `/developer/apps/new` | `marketplace:apps:create` |
| MP-S08 | Version Manager | `/developer/apps/:id/versions` | `marketplace:versions:manage` |
| MP-S09 | Developer Analytics | `/developer/apps/:id/analytics` | `marketplace:analytics:read` |
| MP-S10 | App Reviews List | `/marketplace/apps/:slug/reviews` | `marketplace:apps:browse` |
| MP-S11 | Write Review | `/marketplace/apps/:slug/reviews/new` | `marketplace:reviews:create` |
| MP-S12 | Permissions Grant | Step within MP-S03 | `marketplace:installations:create` |

### Modals & Drawers

| ID | Surface | Trigger |
|----|---------|---------|
| MP-M01 | Install App (quick confirm) | Install CTA when no new permissions |
| MP-M02 | Uninstall App | Uninstall action on MP-S05 |
| MP-M03 | Grant Permissions | Install step or upgrade re-consent |
| MP-M04 | Submit for Review | Developer version publish |
| MP-D01 | App Filters Drawer | Mobile filter on MP-S01 |
| MP-D02 | Webhook Config Drawer | MP-S05 webhooks tab |

---

## 4. Global Patterns

### 4.1 App Card Component

```
┌─────────────────────────────────────┐
│ [Icon 64×64]  App Name        ★4.2 │
│               by Publisher          │
│               Short tagline (2 ln)  │
│ [Category] [Free|Paid]  12k installs│
└─────────────────────────────────────┘
```

| Property | Spec |
|----------|------|
| Icon | 64×64, rounded-8, fallback initials |
| Title | `text-heading-sm`, truncate 1 line |
| Publisher | `text-body-sm text-muted`, verified badge if `verification_status = verified` |
| Rating | Star + numeric; hide if `< 3` reviews |
| Price badge | `Free`, `$X/mo`, `Usage-based` |
| Hover | Elevation +1, subtle border accent |
| Click | Navigate to MP-S02 |

### 4.2 Permission Manifest Display

Grouped by module with expand/collapse:

| Group | Example permissions | Risk level |
|-------|---------------------|------------|
| CRM | Read contacts, Write deals | Medium |
| Finance | Read invoices | High |
| Webhooks | Receive events on install | Low |

Risk levels drive icon color: Low (neutral), Medium (amber), High (red). High-risk permissions require explicit checkbox acknowledgment per permission on MP-S12.

### 4.3 Status Badges

| Status | Color | Context |
|--------|-------|---------|
| `published` | Green | Catalog |
| `pending_review` | Amber | Developer portal |
| `rejected` | Red | Developer portal |
| `installed` | Blue | Installed apps |
| `update_available` | Amber | Installed apps |
| `suspended` | Red | Installed apps (policy violation) |

---

## 5. Screen Specifications

### MP-S01 — App Catalog (Browse / Search)

**Route:** `/marketplace`  
**Layout:** Full-width content within app shell; max-width 1440px centered.

#### Wireframe (Desktop)

```
┌──────────────────────────────────────────────────────────────────┐
│ Marketplace                                    [Search...........] │
├────────────┬─────────────────────────────────────────────────────┤
│ Categories │ Featured carousel (3 apps)                          │
│ ─────────  ├─────────────────────────────────────────────────────┤
│ All        │ Popular Apps                    [Sort ▼] [View ⊞≡]  │
│ CRM        │ ┌────┐ ┌────┐ ┌────┐ ┌────┐                        │
│ Finance    │ │card│ │card│ │card│ │card│                        │
│ Projects   │ └────┘ └────┘ └────┘ └────┘                        │
│ ...        │ ... infinite scroll / pagination                    │
└────────────┴─────────────────────────────────────────────────────┘
```

#### Components

| Component | Behavior |
|-----------|----------|
| Search bar | Debounced 300ms; min 2 chars; redirects to `/marketplace/search?q=` |
| Category sidebar | Sticky; collapses to chips on tablet |
| Featured carousel | Auto-rotate 8s; pause on hover; keyboard navigable |
| Sort dropdown | `popular`, `newest`, `rating`, `name` |
| View toggle | Grid (default) / List |
| Filters | Price (free/paid), Publisher verified, Atlas-built, Rating ≥4 |
| Infinite scroll | Load 24 per page; skeleton on fetch |

#### States

| State | Treatment | Reference |
|-------|-----------|-----------|
| Loading | 12 card skeletons | `20-empty-states-errors.md` § Skeletons |
| Empty search | "No apps match your search" + clear filters CTA | ES-MKT-001 |
| Error | Inline banner + retry | ES-ERR-INLINE |
| Offline | Cached catalog if available; banner | `18-mobile-tablet.md` § Offline |

#### API

- `GET /v1/marketplace/apps?category=&sort=&cursor=`
- `GET /v1/marketplace/categories`
- `GET /v1/marketplace/featured`

---

### MP-S02 — App Detail

**Route:** `/marketplace/apps/:slug`

#### Sections (top to bottom)

1. **Hero** — Icon, name, publisher, rating, install count, primary CTA
2. **Tabs** — Overview | Permissions | Reviews | Changelog | Support
3. **Overview** — Screenshots carousel, long description, features list
4. **Permissions** — Full manifest with risk grouping (read-only preview)
5. **Reviews** — Summary histogram + top 5 reviews; link to MP-S10
6. **Changelog** — Last 5 versions; expandable
7. **Support** — Support email, docs URL, privacy policy link

#### Primary CTA Logic

| Condition | Button label | Action |
|-----------|--------------|--------|
| Not installed | `Install` | → MP-S03 |
| Installed, current | `Open` / `Configure` | → app entry or MP-S05 |
| Installed, update available | `Update available` | → MP-S03 (upgrade path) |
| Already installed by another admin | `Installed` (disabled) + tooltip | — |
| Plan insufficient | `Upgrade plan` | → BL-S01 |
| Missing permission | Hidden; show upgrade banner | Per `19-permissions-matrix.md` |

#### Screenshots

- Desktop: horizontal scroll, 3 visible
- Lightbox on click; swipe on mobile
- Video embed support (YouTube/Vimeo URL in manifest)

---

### MP-S03 — Install Flow

**Route:** `/marketplace/apps/:slug/install`  
**Type:** Full-page wizard (3 steps) with progress indicator.

#### Step 1 — Confirm App

- App summary card (icon, name, version, publisher)
- Plan compatibility check (modules required, tier minimum)
- Billing notice if paid app (price, billing interval)

#### Step 2 — Grant Permissions (MP-S12)

- Full permission manifest with risk indicators
- High-risk: individual checkboxes required
- "Learn what this means" expandable per permission
- Link to Atlas security docs
- **Cannot proceed** until all high-risk acknowledged

#### Step 3 — Configure & Install

| Field | Required | Notes |
|-------|----------|-------|
| Installation name | No | Default: app name |
| Webhook URL | If app declares webhooks | Validated HTTPS |
| Environment | If multi-env supported | `production` default |
| Pin version | No | Default: latest approved |

#### Completion

- Success toast: "App installed successfully"
- Redirect to app entry point or MP-S05
- Audit event: `marketplace.installation.created`

#### Error Handling

| Error | UI |
|-------|-----|
| Quota exceeded | Block with upgrade CTA |
| Permission denied | 403 page |
| Version deprecated | Force version select |
| OAuth failure | Retry + support link |

---

### MP-S04 — Installed Apps Management

**Route:** `/settings/integrations/apps`  
**Audience:** Org admins, integration managers.

#### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Installed Apps                          [Browse Marketplace] │
├─────────────────────────────────────────────────────────────┤
│ [Search apps...]  [Status ▼]  [Sort ▼]                     │
├─────────────────────────────────────────────────────────────┤
│ Table: App | Version | Status | Installed by | Date | ⋮     │
│ ─────────────────────────────────────────────────────────── │
│ Slack Connector  2.1.0  Active  Jane D.  Jun 1  [Configure] │
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘
```

#### Table Columns

| Column | Sortable | Notes |
|--------|----------|-------|
| App | Yes | Icon + name |
| Version | Yes | Badge if update available |
| Status | Yes | `active`, `suspended`, `error` |
| Installed by | Yes | User avatar + name |
| Installed at | Yes | Relative + absolute tooltip |
| Actions | — | Configure, Uninstall |

#### Bulk Actions

- Uninstall selected (max 10)
- Export installation manifest (JSON)

---

### MP-S05 — Installed App Settings

**Route:** `/settings/integrations/apps/:installationId`

#### Tabs

| Tab | Content |
|-----|---------|
| General | Name, status, version pin, auto-update toggle |
| Permissions | Granted vs current manifest diff; Re-consent CTA if drift |
| Webhooks | Endpoint URL, secret rotation, delivery log (last 50) |
| Activity | Install/update/uninstall audit trail |
| Danger zone | Uninstall, suspend |

#### Webhook Delivery Log

| Column | Description |
|--------|-------------|
| Event | Event type |
| Status | `delivered`, `failed`, `retrying` |
| Attempts | Count |
| Last attempt | Timestamp |
| Actions | View payload, Retry |

---

### MP-S06 — Developer Portal Dashboard

**Route:** `/developer`  
**Gate:** Verified `developer_accounts` record.

#### Widgets

| Widget | Metrics |
|--------|---------|
| Apps overview | Total apps, published, pending |
| Install trends | 30-day sparkline |
| Reviews | Avg rating, unread negative |
| Action items | Rejected versions, policy warnings |

#### Onboarding Empty State

If no developer account: guided CTA to complete verification (company name, support email, ToS acceptance).

---

### MP-S07 — Submit App

**Route:** `/developer/apps/new`  
**Form sections:**

1. **Basic info** — Name, slug (auto-generated, editable once), tagline, category
2. **Branding** — Icon (512×512 PNG), screenshots (min 1, max 8)
3. **Description** — Rich text (Markdown subset), features bullet list
4. **Links** — Privacy policy URL (required), support URL, documentation URL
5. **Pricing** — Free / Paid (Stripe Connect required for paid)
6. **Initial version** — Semver, release notes, manifest upload (JSON schema validated)

**Validation:** Real-time slug availability check. Save as draft anytime.

---

### MP-S08 — Version Manager

**Route:** `/developer/apps/:appId/versions`

#### Version Table

| Column | Notes |
|--------|-------|
| Version | Semver |
| Status | `draft`, `pending_review`, `approved`, `rejected`, `deprecated` |
| Submitted | Date |
| Permissions delta | Badge if changed from previous |
| Actions | Edit (draft), Submit, Deprecate |

#### Version Detail Panel

- Manifest viewer (JSON + human-readable permissions)
- Release notes editor
- Rejection reason (if rejected) with remediation checklist

---

### MP-S09 — Developer Analytics

**Route:** `/developer/apps/:appId/analytics`

#### Metrics (date range selector: 7d / 30d / 90d / custom)

| Metric | Visualization |
|--------|---------------|
| Installs | Line chart |
| Active installations | KPI |
| Uninstalls | Line chart |
| API calls (OAuth) | Bar chart by endpoint |
| Webhook deliveries | Success rate donut |
| Reviews | Rating trend |

Data delayed up to 24h (badge on page). Export CSV for Enterprise developers.

---

### MP-S10 — App Reviews List

**Route:** `/marketplace/apps/:slug/reviews`

- Rating histogram (5-star breakdown)
- Sort: `newest`, `highest`, `lowest`, `helpful`
- Filter: star rating, verified install only
- Pagination: 20 per page
- "Write a review" CTA if installed + `marketplace:reviews:create`

---

### MP-S11 — Write Review

**Route:** `/marketplace/apps/:slug/reviews/new`

| Field | Validation |
|-------|------------|
| Rating | 1–5 stars, required |
| Title | 5–100 chars |
| Body | 20–2000 chars |
| Recommend | Yes/No toggle |

One review per user per app. Edit within 30 days (shows "Edit review" on MP-S10 own review).

---

### MP-S12 — Permissions Grant Screen

Embedded in MP-S03 Step 2; also standalone for re-consent at `/settings/integrations/apps/:id/reconsent`.

See §4.2 Permission Manifest Display. Additional requirements:

- Side-by-side diff when upgrading (`Added`, `Removed`, `Unchanged`)
- Legal copy: "By granting these permissions, you allow [App] to access..."
- Admin-only: show which org members will be affected
- Audit: log consent timestamp, IP, user agent

---

## 6. Modal Specifications

### MP-M01 — Install App (Quick Confirm)

**When:** Install has zero new permissions vs previously granted template apps.

| Element | Spec |
|---------|------|
| Size | `sm` (480px) |
| Title | "Install {App Name}?" |
| Body | One-line description + version |
| Actions | Cancel (secondary), Install (primary, loading state) |
| Focus trap | Yes |
| ESC | Closes |

---

### MP-M02 — Uninstall App

| Element | Spec |
|---------|------|
| Size | `md` (560px) |
| Title | "Uninstall {App Name}?" |
| Body | Warning list: data access revoked, webhooks stop, integrations break |
| Checkbox | "I understand this cannot be undone" (required) |
| Actions | Cancel, Uninstall (destructive) |
| Post-action | Toast + redirect to MP-S04 |

---

### MP-M03 — Grant Permissions

Used for inline consent without full wizard.

| Element | Spec |
|---------|------|
| Size | `lg` (720px) |
| Body | Scrollable permission list with risk groups |
| High-risk | Individual acknowledgment checkboxes |
| Actions | Deny (secondary), Grant & Continue (primary) |

---

### MP-M04 — Submit for Review

| Element | Spec |
|---------|------|
| Size | `md` |
| Body | Checklist: icon, screenshots, privacy policy, permissions documented |
| Version summary | Semver + permission count |
| Actions | Cancel, Submit for Review |
| Post-submit | Status → `pending_review`; email to developer |

---

## 7. Permissions & Visibility

| Action | Permission key | UI rule |
|--------|----------------|---------|
| Browse catalog | `marketplace:apps:browse` | Hide nav if missing |
| Install app | `marketplace:installations:create` | Disable CTA + tooltip |
| Manage installations | `marketplace:installations:manage` | Hide settings link |
| Developer portal | `marketplace:developer:access` | Separate nav item |
| Submit app | `marketplace:apps:create` | — |
| Write review | `marketplace:reviews:create` | Hide write CTA |

Full matrix: `19-permissions-matrix.md` § Marketplace.

---

## 8. Responsive Behavior

| Breakpoint | Adaptation |
|------------|------------|
| `< 768px` | Category sidebar → filter drawer (MP-D01); single-column cards |
| `768–1024px` | 2-column grid; condensed app detail tabs → accordion |
| `≥ 1024px` | Full layout per wireframes |

See `18-mobile-tablet.md` § Marketplace.

---

## 9. Accessibility

| Requirement | Implementation |
|-------------|----------------|
| WCAG | 2.1 AA |
| Focus order | Logical tab through filters → cards → pagination |
| Screen reader | App cards announce name, publisher, rating, price |
| Permission list | Each item: `aria-describedby` for risk explanation |
| Wizard | `aria-current="step"` on progress indicator |
| Color | Risk levels never conveyed by color alone (icons + text) |

---

## 10. Telemetry Events

| Event | Properties |
|-------|------------|
| `marketplace.catalog.viewed` | `category`, `sort` |
| `marketplace.app.viewed` | `app_slug`, `source` |
| `marketplace.install.started` | `app_slug`, `version` |
| `marketplace.install.completed` | `app_slug`, `installation_id`, `duration_ms` |
| `marketplace.install.abandoned` | `app_slug`, `step` |
| `marketplace.uninstall.completed` | `app_slug` |
| `marketplace.review.submitted` | `app_slug`, `rating` |

---

## 11. Open Questions

| ID | Question | Owner |
|----|----------|-------|
| OQ-UI-13-01 | Paid app checkout inline vs redirect to billing? | Product |
| OQ-UI-13-02 | Developer portal separate subdomain (`developers.atlas.io`)? | Platform |
| OQ-UI-13-03 | App sandbox preview before install? | Security |