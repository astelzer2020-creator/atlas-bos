---
title: Atlas Design System
document_id: PHASE4-00
version: 1.0.0
status: Draft
last_updated: 2026-06-30
phase: 4
package: "@atlas/ui"
related_documents:
  - INDEX.md
  - ../architecture/phase-2/01-prd.md
---

# Atlas Design System

## Purpose

Define the visual language, component library, accessibility standards, and responsive rules for Atlas BOS. All product UI MUST consume tokens and primitives from `@atlas/ui`; no ad-hoc hex values or one-off components in feature modules.

## Design Principles

1. **Clarity over decoration** — Dense business data must remain scannable (Stripe/Linear influence).
2. **Consistent density** — Compact tables for power users; comfortable mode optional (user preference).
3. **Fail-closed permissions** — Disabled states are explicit, never invisible.
4. **Progressive disclosure** — Advanced actions in overflow menus; primary path ≤3 clicks.
5. **Accessible by default** — WCAG 2.2 AA minimum; AAA for critical financial confirmations.

---

## Color Tokens

Semantic tokens reference CSS custom properties. Light mode is default; dark mode via `data-theme="dark"` on `<html>`.

### Brand

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-brand-50` | `#EEF4FF` | `#0F1A33` | Subtle brand backgrounds |
| `--color-brand-100` | `#D9E6FF` | `#152447` | Hover on brand-tinted surfaces |
| `--color-brand-500` | `#3B6FE8` | `#5B8DEF` | Primary actions, links |
| `--color-brand-600` | `#2B5AD4` | `#4A7FE0` | Primary hover |
| `--color-brand-700` | `#1E47B8` | `#3B6FE8` | Primary active |
| `--color-brand-900` | `#0F2866` | `#A8C4FF` | Brand text on light |

### Neutral (Surface & Text)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-bg-canvas` | `#F8F9FB` | `#0D0F12` | App background |
| `--color-bg-surface` | `#FFFFFF` | `#16181D` | Cards, panels |
| `--color-bg-elevated` | `#FFFFFF` | `#1C1F26` | Modals, popovers |
| `--color-bg-subtle` | `#F1F3F6` | `#22262E` | Table zebra, sidebars |
| `--color-bg-inset` | `#E8EBF0` | `#2A2F38` | Input backgrounds |
| `--color-border-default` | `#D8DCE3` | `#2E3440` | Dividers, outlines |
| `--color-border-strong` | `#B8BFC9` | `#3D4554` | Focus rings (outer) |
| `--color-text-primary` | `#111318` | `#F4F5F7` | Headings, body |
| `--color-text-secondary` | `#5C6370` | `#9CA3AF` | Labels, meta |
| `--color-text-tertiary` | `#8B939F` | `#6B7280` | Placeholders |
| `--color-text-inverse` | `#FFFFFF` | `#111318` | Text on brand buttons |
| `--color-text-link` | `#2B5AD4` | `#7BA3FF` | Links |

### Semantic

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-success-500` | `#16A34A` | `#22C55E` | Success states |
| `--color-success-bg` | `#ECFDF3` | `#0D2818` | Success banners |
| `--color-warning-500` | `#D97706` | `#F59E0B` | Warnings |
| `--color-warning-bg` | `#FFFBEB` | `#2A1F0A` | Warning banners |
| `--color-error-500` | `#DC2626` | `#EF4444` | Errors, destructive |
| `--color-error-bg` | `#FEF2F2` | `#2A1212` | Error banners |
| `--color-info-500` | `#0EA5E9` | `#38BDF8` | Informational |
| `--color-info-bg` | `#F0F9FF` | `#0C1E2A` | Info banners |

### Module Accent Colors (Navigation)

Used for module icons and wayfinding only—not primary actions.

| Module | Token | Value |
|--------|-------|-------|
| CRM | `--color-module-crm` | `#6366F1` |
| Sales | `--color-module-sales` | `#8B5CF6` |
| Finance | `--color-module-finance` | `#059669` |
| HR | `--color-module-hr` | `#EC4899` |
| Projects | `--color-module-pm` | `#F97316` |
| Support | `--color-module-support` | `#14B8A6` |
| Docs | `--color-module-docs` | `#64748B` |
| Messages | `--color-module-msg` | `#3B82F6` |
| Marketing | `--color-module-mkt` | `#E11D48` |
| Inventory | `--color-module-inv` | `#84CC16` |
| Legal | `--color-module-legal` | `#7C3AED` |
| Analytics | `--color-module-ana` | `#06B6D4` |
| Website | `--color-module-web` | `#A855F7` |
| Scheduling | `--color-module-sch` | `#0D9488` |
| Knowledge Base | `--color-module-kb` | `#CA8A04` |
| Automation | `--color-module-aut` | `#F43F5E` |
| ERP | `--color-module-erp` | `#475569` |

### Focus Ring

```css
--focus-ring: 0 0 0 2px var(--color-bg-surface), 0 0 0 4px var(--color-brand-500);
```

---

## Typography Scale

**Font families:**
- `--font-sans`: `"Inter Variable", "Inter", system-ui, sans-serif`
- `--font-mono`: `"JetBrains Mono", "Fira Code", monospace`

| Token | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `--text-display-lg` | 36px / 2.25rem | 1.2 | 600 | Marketing hero |
| `--text-display-md` | 30px / 1.875rem | 1.25 | 600 | Page titles (mobile) |
| `--text-heading-lg` | 24px / 1.5rem | 1.3 | 600 | Page titles (desktop) |
| `--text-heading-md` | 20px / 1.25rem | 1.35 | 600 | Section headers |
| `--text-heading-sm` | 16px / 1rem | 1.4 | 600 | Card titles |
| `--text-body-lg` | 16px / 1rem | 1.5 | 400 | Comfortable body |
| `--text-body-md` | 14px / 0.875rem | 1.5 | 400 | Default body |
| `--text-body-sm` | 12px / 0.75rem | 1.45 | 400 | Captions, table meta |
| `--text-label-md` | 14px / 0.875rem | 1.4 | 500 | Form labels |
| `--text-label-sm` | 12px / 0.75rem | 1.4 | 500 | Badges, chips |
| `--text-mono-md` | 13px / 0.8125rem | 1.5 | 400 | Code, IDs |

**Numeric tabular figures:** Enable `font-variant-numeric: tabular-nums` on all financial tables and KPI displays.

---

## Spacing Scale

4px base grid.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-0` | 0 | — |
| `--space-1` | 4px | Tight icon gaps |
| `--space-2` | 8px | Inline spacing |
| `--space-3` | 12px | Form field gaps |
| `--space-4` | 16px | Card padding (compact) |
| `--space-5` | 20px | Section gaps |
| `--space-6` | 24px | Card padding (default) |
| `--space-8` | 32px | Section margins |
| `--space-10` | 40px | Page padding (mobile) |
| `--space-12` | 48px | Page padding (desktop) |
| `--space-16` | 64px | Marketing sections |

---

## Elevation

| Token | Shadow | Usage |
|-------|--------|-------|
| `--elevation-0` | none | Flat surfaces |
| `--elevation-1` | `0 1px 2px rgba(0,0,0,.06)` | Cards |
| `--elevation-2` | `0 4px 12px rgba(0,0,0,.08)` | Dropdowns |
| `--elevation-3` | `0 8px 24px rgba(0,0,0,.12)` | Modals |
| `--elevation-4` | `0 16px 48px rgba(0,0,0,.16)` | Command palette |

Dark mode shadows use `rgba(0,0,0,.4)` with subtle border `1px solid var(--color-border-default)`.

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Badges, chips |
| `--radius-md` | 6px | Buttons, inputs |
| `--radius-lg` | 8px | Cards |
| `--radius-xl` | 12px | Modals |
| `--radius-2xl` | 16px | Marketing cards |
| `--radius-full` | 9999px | Avatars, pills |

---

## Responsive Breakpoints

| Name | Range | Layout behavior |
|------|-------|-----------------|
| **Mobile** | 320–767px | Single column; bottom nav; full-screen modals |
| **Tablet** | 768–1023px | Collapsible sidebar; 2-column grids |
| **Desktop** | 1024–1439px | Persistent sidebar; 3-column grids |
| **Wide** | 1440px+ | Max content width 1280px; optional AI panel |

```css
--breakpoint-sm: 320px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1440px;

/* Mobile-first media queries */
@media (min-width: 768px) { /* tablet */ }
@media (min-width: 1024px) { /* desktop */ }
@media (min-width: 1440px) { /* wide */ }
```

**Touch targets:** Minimum 44×44px on mobile/tablet for all interactive elements.

---

## Component Library

### Button (`<Button />`)

| Variant | Usage |
|---------|-------|
| `primary` | Primary CTA (one per view) |
| `secondary` | Secondary actions |
| `ghost` | Tertiary / toolbar |
| `destructive` | Delete, revoke, cancel subscription |
| `link` | Inline text actions |

| Size | Height | Padding |
|------|--------|---------|
| `sm` | 32px | 8px 12px |
| `md` | 36px | 10px 16px |
| `lg` | 44px | 12px 20px |

**States:** default, hover, active, focus-visible, disabled, loading (spinner replaces label, maintains width).

**Permission pattern:**
```tsx
<Button disabled={!can('crm:contacts:write')} disabledReason={t('permissions.denied')}>
  Create Contact
</Button>
```

**Keyboard:** `Enter` / `Space` activates; disabled buttons removed from tab order.

---

### Input (`<Input />`, `<Textarea />`, `<SearchInput />`)

| Prop | Behavior |
|------|----------|
| `label` | Required visible label or `aria-label` |
| `error` | `aria-invalid="true"`, `aria-describedby` links to error text |
| `hint` | Helper text below field |
| `prefix/suffix` | Icons inside field bounds |

**Sizes:** `sm` (32px), `md` (36px), `lg` (44px).

**Validation:** Inline on blur; form-level on submit. Error color `--color-error-500`.

---

### Select (`<Select />`, `<Combobox />`, `<MultiSelect />`)

- Listbox pattern with `role="listbox"` / `role="option"`.
- Combobox for searchable selects (>10 options).
- MultiSelect shows `Badge` chips with remove affordance.
- Mobile: native `<select>` fallback for simple enums (<8 options) where UX permits.

---

### Table (`<DataTable />`)

| Feature | Spec |
|---------|------|
| Sorting | Click header; `aria-sort` |
| Filtering | Column filters via popover |
| Pagination | 25/50/100 rows; cursor-based API |
| Selection | Checkbox column; bulk action bar appears |
| Row actions | `⋯` overflow menu |
| Empty | Illustration + CTA |
| Loading | Skeleton rows (5) |
| Density | `compact` (40px row) / `comfortable` (52px row) |

**Responsive mobile:** Table transforms to `<CardList />` — each row becomes a stacked card.

---

### Card (`<Card />`)

```
┌─────────────────────────────────┐
│ [Header: title + optional action]│
├─────────────────────────────────┤
│ [Body]                          │
├─────────────────────────────────┤
│ [Footer: actions]               │
└─────────────────────────────────┘
```

Props: `header`, `footer`, `padding` (`sm`|`md`), `interactive` (hover elevation).

---

### Modal (`<Modal />`)

| Size | Width | Usage |
|------|-------|-------|
| `sm` | 400px | Confirmations |
| `md` | 560px | Forms |
| `lg` | 720px | Permission matrix |
| `xl` | 900px | Complex editors |
| `full` | 100% mobile | Mobile default |

**Behavior:**
- Focus trap via `focus-trap-react`
- `Escape` closes (unless `preventClose`)
- Return focus to trigger on close
- Scroll lock on body
- Stacked modals: max 2 deep; z-index scale +10 per level

---

### Drawer (`<Drawer />`)

| Position | Width | Usage |
|----------|-------|-------|
| `right` | 400px (desktop), 100% (mobile) | Notifications, filters, AI panel |
| `left` | 280px | Mobile navigation |
| `bottom` | 60vh max | Mobile action sheets |

Swipe-to-close on mobile (threshold 80px).

---

### Toast (`<Toaster />`)

| Variant | Duration | Usage |
|---------|----------|-------|
| `success` | 4s | Save confirmed |
| `error` | 8s (sticky option) | Failed mutation |
| `warning` | 6s | Reversible actions |
| `info` | 4s | Background job started |

Position: bottom-right desktop; bottom-center mobile. Max 3 visible; queue others.

Include optional action link (e.g., "View audit log", "Undo").

---

### Badge (`<Badge />`)

| Variant | Usage |
|---------|-------|
| `neutral` | Status default |
| `success` | Active, paid, resolved |
| `warning` | Pending, draft |
| `error` | Failed, overdue, breached |
| `brand` | New feature, trial |
| `module` | Module accent color |

---

### Avatar (`<Avatar />`)

Sizes: `xs` 20px, `sm` 24px, `md` 32px, `lg` 40px, `xl` 64px.

Fallback: initials on `--color-bg-subtle`. Group avatar: max 3 faces + overflow count.

Status indicator: online/away/offline dot (Messaging module).

---

### Tabs (`<Tabs />`)

- `role="tablist"` with arrow key navigation
- Lazy-load panel content on first activation
- Overflow: scroll horizontal on mobile; "More" dropdown on desktop if >6 tabs
- Persist selected tab in URL query `?tab=`

---

### Breadcrumb (`<Breadcrumb />`)

See [01-navigation-layout.md](./01-navigation-layout.md). Truncate middle segments on mobile (`Home › … › Current`).

---

### Sidebar (`<Sidebar />`)

See [01-navigation-layout.md](./01-navigation-layout.md). Collapsible to icon-only (64px) on desktop.

---

### Command Palette (`<CommandPalette />`)

See [01-navigation-layout.md](./01-navigation-layout.md). Invoked via `Cmd+K` / `Ctrl+K`.

---

## Additional Primitives

| Component | Purpose |
|-----------|---------|
| `<Checkbox />` | Multi-select, table selection |
| `<RadioGroup />` | Exclusive choices ≤5 options |
| `<Switch />` | Boolean settings |
| `<Slider />` | Numeric ranges |
| `<DatePicker />` | Single/range dates; locale-aware |
| `<TimePicker />` | Scheduling |
| `<FileUpload />` | Drag-drop + progress |
| `<Progress />` | Linear/circular loading |
| `<Skeleton />` | Content placeholders |
| `<Tooltip />` | Icon-only button labels; disabled reasons |
| `<Popover />` | Non-modal contextual |
| `<DropdownMenu />` | Action menus |
| `<Separator />` | Visual dividers |
| `<ScrollArea />` | Custom scrollbars |
| `<EmptyState />` | Illustrated zero states |
| `<ErrorState />` | Recoverable errors |
| `<PageHeader />` | Title + breadcrumbs + actions |
| `<StatCard />` | KPI display |
| `<PermissionGate />` | Conditional render wrapper |

---

## Accessibility (WCAG 2.2 AA)

### Requirements Matrix

| Criterion | Implementation |
|-----------|----------------|
| 1.4.3 Contrast | Text ≥4.5:1; large text ≥3:1; UI components ≥3:1 |
| 1.4.11 Non-text contrast | Icons, borders on inputs |
| 2.1.1 Keyboard | All functionality keyboard-operable |
| 2.4.3 Focus order | Logical DOM order; modals trap focus |
| 2.4.7 Focus visible | `--focus-ring` on all interactives |
| 2.4.11 Focus not obscured | Sticky headers offset focused elements |
| 2.5.8 Target size | 44×44px minimum touch |
| 3.3.1 Error identification | Text + `aria-invalid` |
| 3.3.2 Labels | Visible or `aria-label` |
| 4.1.2 Name, Role, Value | ARIA on custom widgets |

### Screen Reader Patterns

| Pattern | Announcement |
|---------|--------------|
| Route change | `aria-live="polite"`: "{Page title} loaded" |
| Toast | `role="status"` |
| Modal open | Focus title; `aria-modal="true"` |
| Table sort | "Sorted by {column}, {direction}" |
| Loading | `aria-busy="true"` on container |

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Keyboard Shortcuts (Global)

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd/Ctrl+K` | Open command palette | Authenticated app |
| `Cmd/Ctrl+/` | Show keyboard shortcuts | Authenticated app |
| `Cmd/Ctrl+.` | Toggle AI panel | Authenticated app |
| `G then H` | Go to Home | Authenticated app |
| `G then S` | Go to Settings | Authenticated app |
| `Escape` | Close overlay / drawer | Global |
| `?` | Help menu | Authenticated app |
| `Tab` / `Shift+Tab` | Navigate focusable | Global |
| Arrow keys | Navigate lists, menus, tabs | Contextual |

Module-specific shortcuts defined in module UI specs.

---

## Focus Management Rules

1. **Page navigation:** Move focus to `<h1>` on route change.
2. **Modal open:** Focus first focusable element (or title if no inputs).
3. **Modal close:** Return focus to trigger element.
4. **Drawer open:** Focus drawer title.
5. **Destructive confirm:** Focus "Cancel" by default; require typing entity name for org delete.
6. **Dynamic content:** Use `aria-live` for async validation, not focus steal.
7. **Skip link:** "Skip to main content" as first focusable element in app shell.

---

## Motion & Animation Guidelines

### Duration Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | 100ms | Hover, toggle |
| `--duration-normal` | 200ms | Dropdown, tooltip |
| `--duration-slow` | 300ms | Drawer, modal |
| `--duration-slower` | 400ms | Page transitions |

### Easing

| Token | Curve | Usage |
|-------|-------|-------|
| `--ease-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | General |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exit |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Enter |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful micro-interactions |

### Allowed Animations

- Opacity fade for modals/toasts
- Transform `translateY(8px)→0` for dropdown enter
- Skeleton shimmer (subtle, 1.5s loop)
- Progress bar width transition
- Sidebar width collapse (200ms)
- **Prohibited:** Auto-playing decorative animations; parallax on data screens

---

## Iconography

- **Library:** Lucide Icons (consistent 1.5px stroke)
- **Sizes:** 16px inline; 20px buttons; 24px navigation
- **Decorative icons:** `aria-hidden="true"`
- **Functional icons:** `aria-label` on icon-only buttons

---

## Internationalization UI Rules

1. All strings externalized to `packages/i18n/locales/{lang}.json`.
2. Allow 40% text expansion in button widths (German).
3. Date/number/currency via `Intl` APIs per user locale.
4. RTL: layout mirror post-GA; structure supports logical properties (`margin-inline-start`).

---

## Theme API

```typescript
interface AtlasTheme {
  colorScheme: 'light' | 'dark' | 'system';
  density: 'compact' | 'comfortable';
  sidebarCollapsed: boolean;
}
```

Persisted to `user_preferences.theme` in database; applied before first paint via inline script to prevent flash.

---

## Component File Structure

```
packages/ui/src/
├── tokens/
│   ├── colors.css
│   ├── typography.css
│   ├── spacing.css
│   └── motion.css
├── primitives/
│   ├── Button/
│   ├── Input/
│   └── ...
├── patterns/
│   ├── DataTable/
│   ├── PageHeader/
│   └── EmptyState/
└── index.ts
```

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-30 | Initial design system specification |

---

*Document owner: Design Systems · Package: `@atlas/ui`*