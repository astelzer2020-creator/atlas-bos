---
title: Billing & Subscription UI Specification
document_id: ATLAS-UI-14
version: 1.0.0
status: approved
phase: 4
last_updated: 2026-06-30
module: billing
related_documents:
  - ATLAS-DB-16
  - ATLAS-ARCH-12
  - ADR-0008
  - ATLAS-UI-19
  - ATLAS-UI-20
tags:
  - billing
  - subscriptions
  - stripe
  - checkout
  - dunning
---

# Billing & Subscription UI Specification

## Document Control

| Field | Value |
|-------|-------|
| **Module** | Billing & Subscription (Plane A — Atlas-to-tenant) |
| **Screen count** | 10 screens, 3 modals, 1 drawer |
| **Primary personas** | P1 (SMB Owner), P2 (Enterprise Admin), `billing_admin` role |
| **Route prefix** | `/settings/billing`, `/checkout`, `/upgrade` |
| **Payment provider** | Stripe Elements (PCI SAQ A) |

---

## 1. Purpose & Scope

Define all UI for Atlas platform subscription management: plan selection, checkout, subscription lifecycle, usage metering display, invoices, payment methods, upgrade/downgrade, dunning recovery, and billing settings. Aligns with `billing.*` schema and `ADR-0008`.

### In Scope

- Self-serve plan changes (Starter → Growth → Business)
- Stripe-hosted payment element embedding
- Usage dashboard for metered features
- Invoice history and PDF download
- Dunning states and payment retry UX

### Out of Scope

- Tenant commerce invoicing (Plane B — Finance module)
- Enterprise custom contract negotiation UI (sales-assisted v1)
- Tax ID validation for all countries (Phase 5)

---

## 2. Navigation & Information Architecture

```
Settings → Billing (/settings/billing)
├── Overview (default)
├── Plans (/settings/billing/plans)
├── Usage (/settings/billing/usage)
├── Invoices (/settings/billing/invoices)
│   └── Invoice Detail (/settings/billing/invoices/:id)
├── Payment Methods (/settings/billing/payment-methods)
└── Settings (/settings/billing/settings)

Checkout Flow (/checkout)
├── Plan Selection (/checkout/plan)        [also /upgrade]
├── Payment (/checkout/payment)
└── Confirmation (/checkout/confirmation)

Dunning (/settings/billing/payment-required)  [banner + dedicated screen]
```

### Entry Points

| Source | Destination | Trigger |
|--------|-------------|---------|
| Trial expiring banner | BL-S01 Plan Selection | `trial_days_remaining ≤ 7` |
| Feature gate | BL-S08 Upgrade flow | Missing plan feature |
| Settings nav | BL-S03 Subscription Management | Always for billing admins |
| Failed payment email | BL-S09 Dunning | `subscription.status = past_due` |
| Usage limit warning | BL-S04 Usage Dashboard | `usage ≥ 80%` threshold |

---

## 3. Screen Inventory

| ID | Screen | Route | Permission gate |
|----|--------|-------|-----------------|
| BL-S01 | Plan Selection | `/settings/billing/plans`, `/upgrade` | `admin:billing:read` |
| BL-S02 | Checkout | `/checkout` | `admin:billing:manage` |
| BL-S03 | Subscription Management | `/settings/billing` | `admin:billing:read` |
| BL-S04 | Usage Dashboard | `/settings/billing/usage` | `admin:billing:read` |
| BL-S05 | Invoice History | `/settings/billing/invoices` | `admin:billing:read` |
| BL-S06 | Invoice Detail | `/settings/billing/invoices/:id` | `admin:billing:read` |
| BL-S07 | Payment Methods | `/settings/billing/payment-methods` | `admin:billing:manage` |
| BL-S08 | Upgrade/Downgrade Flow | `/settings/billing/change-plan` | `admin:billing:manage` |
| BL-S09 | Dunning / Retry Payment | `/settings/billing/payment-required` | `admin:billing:manage` |
| BL-S10 | Billing Settings | `/settings/billing/settings` | `admin:billing:manage` |

### Modals

| ID | Surface | Trigger |
|----|---------|---------|
| BL-M01 | Add Payment Method | Add card/bank on BL-S07 or checkout |
| BL-M02 | Cancel Subscription | Cancel action on BL-S03 |
| BL-M03 | Change Plan | Quick plan switch from BL-S03 |

---

## 4. Global Patterns

### 4.1 Plan Card Component

```
┌─────────────────────────────────┐
│ Growth                    POPULAR│
│ $49/mo                           │
│ Billed annually ($39/mo)         │
│ ─────────────────────────────── │
│ ✓ 10 users included              │
│ ✓ CRM + Finance                  │
│ ✓ 50 GB storage                  │
│ [Current Plan] / [Select Plan]   │
└─────────────────────────────────┘
```

| State | Button |
|-------|--------|
| Current plan | `Current plan` (disabled, green outline) |
| Upgrade | `Upgrade` (primary) |
| Downgrade | `Downgrade` (secondary) |
| Contact sales | Enterprise tier → `Contact sales` link |

### 4.2 Billing Interval Toggle

- Segmented control: `Monthly` | `Annual (save 20%)`
- Persists in session; default from current subscription
- Price animation on toggle (150ms)

### 4.3 Currency Display

- Format per org `billing_currency` setting
- Show tax line item when `tax_calculation_enabled`
- FX note for non-USD: "Charged in USD; bank may convert"

### 4.4 Status Banners (Global Shell)

| Subscription status | Banner | Severity |
|---------------------|--------|----------|
| `trialing` | "X days left in trial" + upgrade CTA | Info |
| `past_due` | "Payment failed — update payment method" | Error |
| `canceled` | "Subscription ends {date}" | Warning |
| `unpaid` | "Account suspended — pay now" | Critical |

---

## 5. Screen Specifications

### BL-S01 — Plan Selection

**Routes:** `/settings/billing/plans`, `/upgrade`

#### Layout

- Hero: "Choose the right plan for your team"
- Interval toggle (monthly/annual)
- 4 plan cards: Starter, Growth, Business, Enterprise
- Feature comparison table (expandable below cards)
- FAQ accordion

#### Feature Comparison Table

| Feature | Starter | Growth | Business | Enterprise |
|---------|---------|--------|----------|------------|
| Users | 3 | 10 | 50 | Unlimited |
| Modules | CRM, PM | +Finance | +HR, ERP | All |
| Storage | 5 GB | 50 GB | 500 GB | Custom |
| AI actions/mo | 100 | 1,000 | 10,000 | Unlimited |
| SSO | — | — | ✓ | ✓ |
| API rate limit | 1K/min | 5K/min | 20K/min | Custom |

#### Interactions

- Hover plan card: subtle highlight
- Click `Select Plan`: if no subscription → BL-S02; if existing → BL-S08
- Enterprise: opens contact form drawer (name, email, company size)

---

### BL-S02 — Checkout

**Route:** `/checkout?plan=growth&interval=annual`

#### Steps (single page, 2 columns desktop)

```
┌────────────────────────┬──────────────────────┐
│ Payment Details        │ Order Summary        │
│ ─────────────────────  │ Growth (Annual)      │
│ [Stripe Payment Element]│ $468/yr              │
│ Billing email          │ Tax: $37.44          │
│ Billing address        │ ─────────────────    │
│ Tax ID (optional)      │ Total: $505.44       │
│                        │ [Complete Purchase]  │
└────────────────────────┴──────────────────────┘
```

#### Stripe Integration

| Element | Spec |
|---------|------|
| Payment Element | Card, Apple Pay, Google Pay, Link |
| 3DS | Handled by Stripe; show spinner overlay |
| Error display | Inline below element; map Stripe codes to friendly messages |
| Loading | Disable submit; skeleton on summary |

#### Validation

- Email: required, valid format
- Address: required for tax calculation countries
- Terms checkbox: "I agree to Atlas Terms and Privacy Policy"

#### Success

- Redirect to BL-S02 confirmation sub-route or BL-S03 with success toast
- Confetti animation (reduced motion: static checkmark only)

---

### BL-S03 — Subscription Management

**Route:** `/settings/billing` (overview)

#### Sections

1. **Current plan card** — Plan name, price, renewal date, manage CTA
2. **Seats** — Used / included; add seats CTA (if applicable)
3. **Add-ons** — List of active add-ons with remove option
4. **Payment method** — Last 4, brand icon; update link → BL-S07
5. **Next invoice preview** — Estimated amount, date
6. **Quick actions** — Change plan, Cancel, Download latest invoice

#### Subscription States UI

| Status | Primary display |
|--------|-----------------|
| `active` | Green "Active" badge |
| `trialing` | Blue "Trial" + days remaining |
| `past_due` | Red banner + "Update payment" CTA |
| `canceled` | Gray "Cancels on {date}" |
| `paused` | Amber "Paused" (enterprise only) |

---

### BL-S04 — Usage Dashboard

**Route:** `/settings/billing/usage`

#### Meter Cards

| Meter | Display | Threshold behavior |
|-------|---------|-------------------|
| AI actions | Progress bar + count/limit | Warning at 80%, block at 100% |
| API calls | Sparkline 30d | — |
| Storage | GB used / limit | Link to Documents module |
| Seats | Avatars + count | Upgrade CTA at limit |
| Email sends | Monthly count | — |

#### Date Range

- Default: current billing period
- Selector: current period, last period, last 90 days

#### Overage Display

If plan allows overage: show projected overage charge on next invoice.

---

### BL-S05 — Invoice History

**Route:** `/settings/billing/invoices`

#### Table

| Column | Sortable |
|--------|----------|
| Invoice # | Yes |
| Date | Yes |
| Amount | Yes |
| Status | Yes (`paid`, `open`, `void`, `uncollectible`) |
| Actions | Download PDF, View |

- Filter by status, date range
- Pagination: 25 per page
- Empty state: ES-BIL-001

---

### BL-S06 — Invoice Detail

**Route:** `/settings/billing/invoices/:id`

#### Content

- Invoice header: number, date, status, due date
- Bill-to / Bill-from addresses
- Line items table: description, quantity, unit price, amount
- Subtotal, tax, credits, total
- Payment history (if partial payments)
- Actions: Download PDF, Pay now (if open), Contact support

---

### BL-S07 — Payment Methods

**Route:** `/settings/billing/payment-methods`

#### Payment Method List

| Element | Spec |
|---------|------|
| Card row | Brand icon, •••• 4242, exp MM/YY, default badge |
| Bank (ACH) | Account •••• 6789 |
| Actions | Set default, Remove |
| Add | Opens BL-M01 |

#### Rules

- Cannot remove sole payment method if subscription active
- Default method used for renewals and dunning retries
- Max 5 payment methods per tenant

---

### BL-S08 — Upgrade/Downgrade Flow

**Route:** `/settings/billing/change-plan`

#### Wizard Steps

1. **Select new plan** — Plan cards with current highlighted
2. **Review changes** — Proration breakdown, effective date
3. **Confirm** — Summary + confirm button

#### Proration Display

```
┌─────────────────────────────────────────┐
│ Plan change summary                     │
│ Current: Growth ($49/mo)                │
│ New: Business ($149/mo)                 │
│ ─────────────────────────────────────── │
│ Credit for unused Growth time  -$24.50  │
│ Charge for Business (prorated)  $89.25  │
│ Due today                      $64.75   │
│ Next renewal (Jul 30)         $149.00  │
└─────────────────────────────────────────┘
```

#### Downgrade Rules

- Show feature loss warning list (modules, limits)
- Effective: end of current period (default) or immediate (toggle)
- Data retention warning if over new limits

---

### BL-S09 — Dunning / Retry Payment

**Route:** `/settings/billing/payment-required`  
**Also:** Persistent banner on all pages when `past_due`.

#### Dedicated Screen

```
┌─────────────────────────────────────────────────────────┐
│ ⚠ Payment Required                                      │
│                                                         │
│ We couldn't process your payment of $49.00 on Jun 28.   │
│ Your account will be suspended in 5 days.               │
│                                                         │
│ [Stripe Payment Element — update or retry]              │
│                                                         │
│ Attempt 2 of 4 in dunning sequence                      │
│ [Retry Payment]  [Contact Support]                    │
└─────────────────────────────────────────────────────────┘
```

#### Dunning Timeline

| Stage | Days past due | UI severity | Feature access |
|-------|---------------|-------------|----------------|
| 1 | 0–3 | Warning banner | Full |
| 2 | 4–7 | Error banner + email | Full |
| 3 | 8–14 | Dedicated screen on login | Read-only |
| 4 | 15+ | Suspension screen | Blocked (except billing) |

#### Retry Behavior

- Primary button triggers Stripe `confirmPayment`
- Show last failure reason from `dunning_attempts`
- Success: clear banner, restore access, toast

---

### BL-S10 — Billing Settings

**Route:** `/settings/billing/settings`

| Setting | Control | Notes |
|---------|---------|-------|
| Billing email | Email input | Invoice delivery |
| Billing contacts | Multi-email chips | Max 5 |
| Company legal name | Text | On invoices |
| Tax ID / VAT | Text + validate button | VIES for EU |
| Billing address | Address form | Tax calculation |
| Invoice memo | Textarea | Appears on invoices |
| Auto-renew | Toggle | Off → cancel at period end warning |
| Receive usage alerts | Toggle + threshold % | Default 80% |

---

## 6. Modal Specifications

### BL-M01 — Add Payment Method

| Element | Spec |
|---------|------|
| Size | `md` (560px) |
| Title | "Add payment method" |
| Body | Stripe Payment Element (setup mode) |
| Checkbox | "Set as default payment method" (checked default) |
| Actions | Cancel, Add |
| Success | Close modal, refresh list, toast |

---

### BL-M02 — Cancel Subscription

| Element | Spec |
|---------|------|
| Size | `md` |
| Title | "Cancel your subscription?" |
| Body | Loss of access date, data export reminder, feedback survey (optional) |
| Retention offer | If eligible: discount offer card |
| Confirm | Type `CANCEL` to enable button (enterprise) or checkbox (SMB) |
| Actions | Keep subscription (primary), Cancel subscription (destructive) |
| Post-cancel | Email confirmation; status → `canceled` at period end |

---

### BL-M03 — Change Plan

Quick plan switch without full wizard.

| Element | Spec |
|---------|------|
| Size | `lg` |
| Body | 4 plan cards inline |
| Footer | Proration preview + Confirm change |
| Use case | From BL-S03 quick action |

---

## 7. Permissions & Visibility

| Surface | Permission | UI rule |
|---------|------------|---------|
| All billing screens | `admin:billing:read` | Hide Settings → Billing nav |
| Checkout, payment, cancel | `admin:billing:manage` | Read-only view for read-only billing viewers (future) |
| Owner | Implicit all | — |

Non-billing users: no billing nav item; feature gates show "Contact your administrator."

---

## 8. Responsive Behavior

| Breakpoint | Adaptation |
|------------|------------|
| Mobile | Plan cards stack; checkout single column; sticky summary footer |
| Tablet | 2-column plan grid |
| Desktop | Full layouts |

Stripe Elements: mobile-optimized wallet buttons prioritized.

---

## 9. Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Stripe iframe | Title attribute; error announcements via `aria-live` |
| Plan comparison | Table has `scope` headers; responsive card fallback |
| Dunning banner | `role="alert"` |
| Price changes | Announce via screen reader on interval toggle |
| Cancel flow | Destructive action requires explicit confirmation |

---

## 10. Telemetry Events

| Event | Properties |
|-------|------------|
| `billing.plans.viewed` | `source`, `current_plan` |
| `billing.checkout.started` | `plan`, `interval` |
| `billing.checkout.completed` | `plan`, `amount`, `payment_method_type` |
| `billing.checkout.failed` | `error_code` |
| `billing.plan.changed` | `from_plan`, `to_plan`, `proration_amount` |
| `billing.subscription.canceled` | `plan`, `reason` |
| `billing.dunning.retry` | `attempt_number`, `success` |

---

## 11. Error & Empty States

| ID | Context | Reference |
|----|---------|-----------|
| ES-BIL-001 | No invoices | `20-empty-states-errors.md` |
| ES-BIL-002 | No payment methods | Add CTA |
| ES-BIL-003 | Checkout payment failed | Inline Stripe error + retry |
| ES-403 | Non-billing user | Standard 403 page |

---

## 12. Open Questions

| ID | Question | Owner |
|----|----------|-------|
| OQ-UI-14-01 | Annual-only Enterprise — hide monthly toggle? | GTM |
| OQ-UI-14-02 | Usage-based AI overage: real-time or daily? | Engineering |
| OQ-UI-14-03 | Multi-currency checkout for EU orgs? | Finance |