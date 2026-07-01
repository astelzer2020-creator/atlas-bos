---
title: Finance UI Specification
document_id: ATLAS-UI-06
version: 1.0.0
status: draft
phase: 4
last_updated: 2026-06-30
module: finance
bounded_context: ledger
related_documents:
  - ATLAS-DB-07
  - ATLAS-UI-04
  - ATLAS-UI-05
  - ADR-0008-stripe-payments.md
tags:
  - ui
  - finance
  - accounting
  - wireframes
  - permissions
---

# Finance UI Specification

## Purpose

Complete UI specification for the **Ledger** (Finance) module: general ledger, invoicing, payments, banking, budgets, and financial reporting.

## Route Prefix

```
/app/:orgSlug/:workspaceSlug/finance/{resource}/:id?/{action}?
```

---

## Navigation Structure

```
Finance
├── General Ledger
│   ├── Chart of Accounts         → /finance/accounts
│   └── Journal Entries           → /finance/journal-entries
│       └── Detail                → /finance/journal-entries/:id
├── Receivables
│   ├── Invoices                  → /finance/invoices
│   ├── Create Invoice            → /finance/invoices/new
│   └── Invoice Detail            → /finance/invoices/:id
├── Payments                      → /finance/payments
├── Banking
│   ├── Bank Accounts             → /finance/bank-accounts
│   └── Reconciliation            → /finance/reconciliation
├── Planning
│   └── Budgets                   → /finance/budgets
└── Reports
    ├── Profit & Loss             → /finance/reports/profit-loss
    ├── Balance Sheet             → /finance/reports/balance-sheet
    └── Cash Flow                 → /finance/reports/cash-flow
```

---

## Screen Inventory

| Screen ID | Name | Route | Primary Permission |
|-----------|------|-------|-------------------|
| UI-FIN-001 | Chart of Accounts | `/finance/accounts` | `finance:accounts:read` |
| UI-FIN-002 | Journal Entries List | `/finance/journal-entries` | `finance:journal_entries:read` |
| UI-FIN-003 | Journal Entry Detail | `/finance/journal-entries/:id` | `finance:journal_entries:read` |
| UI-FIN-004 | Invoices List | `/finance/invoices` | `finance:invoices:read` |
| UI-FIN-005 | Invoice Create | `/finance/invoices/new` | `finance:invoices:write` |
| UI-FIN-006 | Invoice Detail | `/finance/invoices/:id` | `finance:invoices:read` |
| UI-FIN-007 | Payments List | `/finance/payments` | `finance:payments:read` |
| UI-FIN-008 | Bank Accounts | `/finance/bank-accounts` | `finance:bank_accounts:read` |
| UI-FIN-009 | Reconciliation | `/finance/reconciliation` | `finance:reconciliation:read` |
| UI-FIN-010 | Budgets | `/finance/budgets` | `finance:budgets:read` |
| UI-FIN-011 | Profit & Loss Report | `/finance/reports/profit-loss` | `finance:reports:read` |
| UI-FIN-012 | Balance Sheet | `/finance/reports/balance-sheet` | `finance:reports:read` |
| UI-FIN-013 | Cash Flow Statement | `/finance/reports/cash-flow` | `finance:reports:read` |

### Modal Inventory

| Modal ID | Name | Permission |
|----------|------|------------|
| UI-FIN-M001 | Record Payment | `finance:payments:write` |
| UI-FIN-M002 | Create Invoice from Deal | `finance:invoices:write` |
| UI-FIN-M003 | Tax Settings | `finance:tax:manage` |
| UI-FIN-M004 | Send Invoice | `finance:invoices:send` |
| UI-FIN-M005 | Void Invoice | `finance:invoices:void` |
| UI-FIN-M006 | Create Journal Entry | `finance:journal_entries:write` |
| UI-FIN-M007 | Post Journal Entry | `finance:journal_entries:post` |
| UI-FIN-M008 | Reverse Journal Entry | `finance:journal_entries:reverse` |
| UI-FIN-M009 | Add GL Account | `finance:accounts:write` |
| UI-FIN-M010 | Import Bank Statement | `finance:reconciliation:write` |
| UI-FIN-M011 | Match Transaction | `finance:reconciliation:write` |
| UI-FIN-M012 | Create Budget Line | `finance:budgets:write` |
| UI-FIN-M013 | Export Report | `finance:reports:export` |
| UI-FIN-M014 | Payment Allocation | `finance:payments:write` |

---

## Screen Specifications

---

### UI-FIN-001 — Chart of Accounts

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/finance/accounts` |
| **Layout** | Expandable tree table |

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Chart of Accounts                              [Import COA] [+ Add Account]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ [🔍 Search code or name...] [Type ▼] [Active only ☑]                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ Code    │ Account Name          │ Type      │ Balance     │ Status  │ ⋮     │
│ 1000    │ ▼ Assets              │ Header    │ $1,245,000  │ Active  │       │
│ 1100    │   ▼ Current Assets    │ Header    │ $845,000    │ Active  │       │
│ 1110    │     Cash              │ Asset     │ $125,000    │ Active  │ ⋮     │
│ 1200    │   Accounts Receivable │ Asset     │ $320,000    │ System  │ ⋮     │
│ 2000    │ ▼ Liabilities         │ Header    │ $420,000    │ Active  │       │
│ 4000    │ ▼ Revenue             │ Header    │ $2,100,000  │ Active  │       │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View COA | `finance:accounts:read` |
| Add account | `finance:accounts:write` → M009 |
| Edit account | `finance:accounts:write` |
| Deactivate | `finance:accounts:write` |
| Delete | `finance:accounts:delete` | System accounts blocked |
| View balance | `finance:accounts:read` |
| Drill to journal | `finance:journal_entries:read` |

**System accounts**: Badge + no delete; edit limited to description.

#### Responsive

| Breakpoint | Layout |
|------------|--------|
| **Desktop** | Full tree indent |
| **Tablet** | 2-level expand; balance column hidden |
| **Mobile** | Flat searchable list; type filter chips |

---

### UI-FIN-002 — Journal Entries List

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/finance/journal-entries` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Journal Entries                                   [+ New Journal Entry]      │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Date range ▼] [Status ▼] [Source ▼] [🔍 Search memo...]                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ Entry #  │ Date       │ Memo              │ Debit     │ Credit    │ Status  │
│ JE-8821  │ Jun 30     │ Invoice INV-1042  │ $5,000    │ $5,000    │ Posted  │
│ JE-8820  │ Jun 29     │ Payroll accrual   │ $12,400   │ $12,400   │ Posted  │
│ JE-8819  │ Jun 29     │ Bank fee          │ $25       │ $25       │ Draft   │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View list | `finance:journal_entries:read` |
| Create | `finance:journal_entries:write` → M006 |
| View detail | `finance:journal_entries:read` |
| Post | `finance:journal_entries:post` |
| Delete (draft) | `finance:journal_entries:delete` |

---

### UI-FIN-003 — Journal Entry Detail

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/finance/journal-entries/:entryId` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Journal Entries  JE-8821  [Posted]        [Reverse] [Print] [⋮]           │
├──────────────────────────────────────────────────────────────────────────────┤
│ Date: Jun 30, 2026   Memo: Invoice INV-1042 revenue recognition             │
│ Source: Invoice INV-1042   Posted by: Jane Admin   Posted: Jun 30 10:15     │
├──────────────────────────────────────────────────────────────────────────────┤
│ Account Code │ Account Name        │ Debit      │ Credit     │ Description  │
│ 1200         │ Accounts Receivable │ $5,000.00  │ —          │ INV-1042     │
│ 4100         │ Product Revenue     │ —          │ $4,500.00  │              │
│ 2200         │ Sales Tax Payable   │ —          │ $500.00    │              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Totals:                          │ $5,000.00  │ $5,000.00  │ ✓ Balanced    │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission | State |
|--------|------------|-------|
| View | `finance:journal_entries:read` | — |
| Edit | `finance:journal_entries:write` | `draft` only |
| Post | `finance:journal_entries:post` → M007 | `draft` |
| Reverse | `finance:journal_entries:reverse` → M008 | `posted` |
| Print | `finance:journal_entries:read` | — |

**Posted entries**: Immutable; edit controls hidden.

---

### UI-FIN-004 — Invoices List

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/finance/invoices` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Invoices (312)              [Export] [+ New Invoice] [From Deal]            │
├──────────────────────────────────────────────────────────────────────────────┤
│ [🔍] [Status ▼] [Customer ▼] [Date ▼] [Overdue only ☐]                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Invoice # │ Customer    │ Issue Date │ Due Date │ Total    │ Balance │ Status│
│ INV-1042  │ Acme Corp   │ Jun 28     │ Jul 28   │ $5,000   │ $5,000  │ Sent  │
│ INV-1041  │ Beta Inc    │ Jun 15     │ Jul 15   │ $2,400   │ $0      │ Paid  │
│ INV-1038  │ Gamma LLC   │ May 01     │ May 31   │ $8,100   │ $8,100  │Overdue│
└──────────────────────────────────────────────────────────────────────────────┘
```

Status badges: `draft`, `sent`, `partial`, `paid`, `overdue`, `void`

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View | `finance:invoices:read` |
| Create | `finance:invoices:write` → 005 |
| From deal | `finance:invoices:write` → M002 |
| Send | `finance:invoices:send` → M004 |
| Record payment | `finance:payments:write` → M001 |
| Void | `finance:invoices:void` → M005 |
| Export | `finance:exports:read` |

---

### UI-FIN-005 — Invoice Create

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/finance/invoices/new` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Create Invoice                                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ Customer *     [Search CRM account/contact ▼]                                │
│ Issue date     [Jun 30, 2026]    Due date  [Jul 30, 2026]                  │
│ Payment terms  [Net 30 ▼]        Currency   [USD ▼]                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ LINE ITEMS                                              [+ Add Line]         │
│ Description        │ Qty │ Unit Price │ Discount │ Tax     │ Line Total    │
│ Widget Pro license │ 10  │ $450.00    │ 0%       │ 10%     │ $4,950.00     │
├──────────────────────────────────────────────────────────────────────────────┤
│ Subtotal: $4,500.00   Tax: $450.00   Total: $4,950.00                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Notes to customer: [________________________________]                        │
│              [Cancel]  [Save Draft]  [Save & Send]                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| Create/save | `finance:invoices:write` |
| Save & send | `finance:invoices:send` |
| Add ERP product line | `erp:products:read` |
| Override tax | `finance:tax:manage` |

---

### UI-FIN-006 — Invoice Detail

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/finance/invoices/:invoiceId` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Invoices  INV-1042  [Sent]   [Record Payment] [Send] [Void] [PDF] [Edit]  │
├──────────────────────────────┬───────────────────────────────────────────────┤
│ INVOICE PREVIEW              │ PAYMENT SUMMARY                               │
│ [Rendered PDF preview]       │ Total:      $5,000.00                         │
│                              │ Paid:       $0.00                             │
│                              │ Balance due:$5,000.00                         │
│                              │                                               │
│                              │ PAYMENTS (0)                  [Record →]      │
│                              │                                               │
│                              │ ACTIVITY                                      │
│                              │ Jun 28 — Sent to billing@acme.com             │
│                              │ Jun 28 — Created from SO-5010                 │
├──────────────────────────────┴───────────────────────────────────────────────┤
│ LINE ITEMS (read-only when not draft)                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission | State Gate |
|--------|------------|------------|
| View | `finance:invoices:read` | — |
| Edit | `finance:invoices:write` | `draft` |
| Send | `finance:invoices:send` | `draft`, `sent` (resend) |
| Record payment | `finance:payments:write` | not `void`, `paid` |
| Void | `finance:invoices:void` | not `paid` |
| Download PDF | `finance:invoices:read` | — |
| View CRM customer | `crm:accounts:read` | — |

---

### UI-FIN-007 — Payments List

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/finance/payments` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Payments (89)                                           [+ Record Payment]   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Payment # │ Date       │ Customer   │ Method    │ Amount   │ Applied │ Ref   │
│ PMT-441   │ Jun 30     │ Beta Inc   │ ACH       │ $2,400   │ $2,400  │ ...   │
│ PMT-440   │ Jun 28     │ Acme Corp  │ Wire      │ $5,000   │ $3,000  │ ...   │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View | `finance:payments:read` |
| Record | `finance:payments:write` → M001 |
| Allocate | `finance:payments:write` → M014 |
| Refund | `finance:payments:refund` |
| Void | `finance:payments:void` |

---

### UI-FIN-008 — Bank Accounts

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/finance/bank-accounts` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Bank Accounts (3)                                    [+ Link Bank Account]   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Name           │ Institution │ Account (masked) │ GL Link  │ Balance  │ ⋮    │
│ Operating      │ Chase       │ ••••4521         │ 1110     │ $125,000 │ ⋮    │
│ Payroll        │ Chase       │ ••••8832         │ 1120     │ $42,000  │ ⋮    │
│ Stripe Clearing│ Stripe      │ —                │ 1130     │ $8,200   │ ⋮    │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View | `finance:bank_accounts:read` |
| Link account | `finance:bank_accounts:write` |
| Sync (Plaid/Stripe) | `finance:bank_accounts:sync` |
| Reconcile | `finance:reconciliation:read` → 009 |
| View full account number | `finance:bank_accounts:read_sensitive` | ABAC |

---

### UI-FIN-009 — Reconciliation

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/finance/reconciliation` |

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Bank Reconciliation — Operating (••••4521)    [Import Statement] [Complete] │
├──────────────────────────────────────────────────────────────────────────────┤
│ Period: [Jun 1 – Jun 30, 2026 ▼]   Statement balance: [$124,500.00]         │
│ Atlas balance: $125,000.00   Difference: -$500.00 (3 unmatched)             │
├──────────────────────────────┬───────────────────────────────────────────────┤
│ BANK STATEMENT LINES         │ ATLAS TRANSACTIONS                            │
│ ☐ Jun 28  ACH DEP  +$5,000  │ ○ INV-1042 payment    $5,000    [Match]      │
│ ☐ Jun 29  BANK FEE    -$25   │ ○ JE-8819 bank fee       $25    [Match]      │
│ ☐ Jun 30  CHECK     -$475   │ ○ Unmatched            $475    [Create JE]   │
│                              │                                               │
│ [Auto-match] [Split] [Exclude]                                               │
└──────────────────────────────┴───────────────────────────────────────────────┘
```

#### Workflow

1. Select bank account + period
2. Import statement (M010) or sync feed
3. Auto-match by amount/date/reference
4. Manual match (M011) or create adjusting JE
5. Complete when difference = $0

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View | `finance:reconciliation:read` |
| Import statement | `finance:reconciliation:write` |
| Match | `finance:reconciliation:write` |
| Complete period | `finance:reconciliation:close` |
| Reopen | `finance:reconciliation:admin` |

#### Responsive

- **Mobile**: Single-column; statement line first; match via bottom sheet

---

### UI-FIN-010 — Budgets

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/finance/budgets` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Budgets — FY 2026                    [Fiscal Year ▼] [+ Add Budget Line]     │
├──────────────────────────────────────────────────────────────────────────────┤
│ Account      │ Annual     │ Q1 Actual │ Q1 Budget │ Q1 Var  │ Q2 Budget │... │
│ 5100 Payroll │ $600,000   │ $148,000  │ $150,000  │ +$2,000 │ $150,000  │    │
│ 5200 Rent    │ $120,000   │ $30,000   │ $30,000   │ $0      │ $30,000   │    │
│ 5300 Marketing│ $80,000   │ $22,000   │ $20,000   │ -$2,000 │ $20,000   │    │
├──────────────────────────────────────────────────────────────────────────────┤
│ Variance legend: green under budget, red over budget                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View | `finance:budgets:read` |
| Edit budget amounts | `finance:budgets:write` |
| Import budget | `finance:budgets:write` |
| Lock period | `finance:budgets:lock` |

---

### UI-FIN-011 — Profit & Loss Report

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/finance/reports/profit-loss` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Profit & Loss                    [Export] [Compare] [Save View]              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Period: [Q2 2026 ▼]  Basis: [Accrual ▼]  Compare: [Q1 2026 ▼]               │
├──────────────────────────────────────────────────────────────────────────────┤
│                              │ Current    │ Prior      │ Change            │
│ Revenue                      │            │            │                   │
│   Product Revenue            │ $450,000   │ $420,000   │ +7.1%             │
│   Service Revenue            │ $85,000    │ $72,000    │ +18.1%            │
│ Total Revenue                │ $535,000   │ $492,000   │ +8.7%             │
│                              │            │            │                   │
│ Cost of Goods Sold           │ $180,000   │ $175,000   │ +2.9%             │
│ Gross Profit                 │ $355,000   │ $317,000   │ +12.0%            │
│                              │            │            │                   │
│ Operating Expenses           │ $210,000   │ $198,000   │ +6.1%             │
│ Net Income                   │ $145,000   │ $119,000   │ +21.8%            │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View report | `finance:reports:read` |
| Drill down to JE | `finance:journal_entries:read` |
| Export PDF/CSV | `finance:reports:export` → M013 |
| Compare periods | `finance:reports:read` |
| View departmental P&L | `finance:reports:read_dept` | ABAC |

---

### UI-FIN-012 — Balance Sheet

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/finance/reports/balance-sheet` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Balance Sheet                              As of: [Jun 30, 2026 ▼] [Export]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ ASSETS                           │ LIABILITIES & EQUITY                      │
│ Current Assets                   │ Current Liabilities                       │
│   Cash              $125,000     │   Accounts Payable    $85,000            │
│   AR                $320,000     │   Tax Payable         $42,000            │
│ Total Current       $445,000     │ Total Current         $127,000           │
│                                  │                                           │
│ Fixed Assets        $800,000     │ Long-term Debt        $200,000           │
│                                  │ Equity                $918,000           │
│ TOTAL ASSETS      $1,245,000     │ TOTAL L&E           $1,245,000  ✓        │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Validation UI**: Assets = Liabilities + Equity; show error banner if imbalanced (data issue).

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View | `finance:reports:read` |
| Export | `finance:reports:export` |
| Drill to account | `finance:accounts:read` |

---

### UI-FIN-013 — Cash Flow Statement

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/finance/reports/cash-flow` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Cash Flow Statement              Period: [Q2 2026 ▼]            [Export]     │
├──────────────────────────────────────────────────────────────────────────────┤
│ Operating Activities                                                         │
│   Net Income                                        $145,000                 │
│   Adjustments: Depreciation                          $12,000                 │
│   Changes in AR                                     -$28,000                 │
│ Net cash from operating                             $129,000                 │
│                                                                              │
│ Investing Activities                                                         │
│   Equipment purchases                               -$45,000                 │
│ Net cash from investing                             -$45,000                 │
│                                                                              │
│ Financing Activities                                                         │
│   Loan proceeds                                      $50,000                 │
│ Net cash from financing                              $50,000                 │
│                                                                              │
│ Net change in cash                                    $134,000                 │
│ Cash at beginning                                     $91,000                 │
│ Cash at end                                          $225,000                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View | `finance:reports:read` |
| Export | `finance:reports:export` |
| Switch method (direct/indirect) | `finance:reports:read` |

---

## Modals Catalog

### UI-FIN-M001 — Record Payment

```
┌─────────────────────────────────────┐
│ Record Payment                   [×]│
├─────────────────────────────────────┤
│ Customer:  [Acme Corp          ▼]   │
│ Amount:    [$5,000.00____________]  │
│ Date:      [Jun 30, 2026]           │
│ Method:    [Wire transfer      ▼]   │
│ Bank acct: [Operating ••4521   ▼]   │
│ Reference: [WT-2026-8834_______]    │
├─────────────────────────────────────┤
│ Apply to invoices:                  │
│ ☑ INV-1042  Balance $5,000  [$5000] │
│ ☐ INV-1035  Balance $1,200  [$    ] │
├─────────────────────────────────────┤
│ Unapplied: $0.00                    │
│         [Cancel]  [Record Payment]  │
└─────────────────────────────────────┘
```

**Permission**: `finance:payments:write`  
**Validation**: Allocations ≤ payment amount; ≤ invoice balance.

### UI-FIN-M002 — Create Invoice from Deal

```
┌──────────────────────────────────────────────────────────┐
│ Create Invoice from Deal                              [×]│
├──────────────────────────────────────────────────────────┤
│ Deal: Acme Enterprise License ($50,000)                  │
│ Customer: Acme Corp / Jane Smith                         │
├──────────────────────────────────────────────────────────┤
│ ☑ Include deal amount as line item                       │
│ ☑ Include ERP products from deal (2 items)             │
│ Payment terms: [Net 30 ▼]                                │
│ Issue date:    [Today]   Due: [Auto-calculated]          │
├──────────────────────────────────────────────────────────┤
│ Preview total: $50,000.00                                  │
│              [Cancel]  [Create Draft]  [Create & Send] │
└──────────────────────────────────────────────────────────┘
```

**Trigger**: CRM Deal Detail, Finance Invoices list  
**Permission**: `finance:invoices:write` + `crm:deals:read`

### UI-FIN-M003 — Tax Settings

```
┌──────────────────────────────────────────────────────────┐
│ Tax Settings                                          [×]│
├──────────────────────────────────────────────────────────┤
│ [Tax Rates] [Tax Rules] [Nexus]                          │
├──────────────────────────────────────────────────────────┤
│ Code    │ Name         │ Rate   │ Effective   │ Status  │
│ US-CA   │ California   │ 7.25%  │ Jan 1 2026  │ Active  │
│ US-NY   │ New York     │ 8.00%  │ Jan 1 2026  │ Active  │
│ [+ Add Tax Rate]                                         │
├──────────────────────────────────────────────────────────┤
│ Default tax on invoices: [Auto by customer address ▼]    │
│                              [Cancel]  [Save]          │
└──────────────────────────────────────────────────────────┘
```

**Permission**: `finance:tax:manage`  
**Validation**: Overlapping effective dates blocked per DB invariant.

### UI-FIN-M004 — Send Invoice

Email template preview, recipient(s), CC, attach PDF, payment link (Stripe).  
**Permission**: `finance:invoices:send`

### UI-FIN-M005 — Void Invoice

Requires void reason; confirm impact on GL (reversal JE preview).  
**Permission**: `finance:invoices:void`

---

## Cross-Module Integration

| Source | Target | UI |
|--------|--------|-----|
| CRM Deal | Invoice | M002 |
| ERP Sales Order | Invoice | SO Detail → Create Invoice |
| Invoice Sent | Journal Entry | Auto; show link on JE-xxx |
| Payment Recorded | Bank Reconciliation | Suggest match in 009 |
| Stripe Webhook | Payments | Auto-record; visible in 007 |

---

## Accessibility & Security

- Masked bank numbers everywhere except `read_sensitive` permission
- Financial amounts: `aria-live` on totals when lines change
- Report tables: sticky headers; keyboard-navigable drill-down
- Void/delete: type-to-confirm pattern for amounts > $10,000

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-30 | Initial Finance UI specification |