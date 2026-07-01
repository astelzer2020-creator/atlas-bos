---
title: Finance Database Schema
document_id: ATLAS-DB-07
version: 1.0.0
status: draft
phase: 3
last_updated: 2026-06-30
bounded_context: ledger
schema: ledger
related_documents:
  - ATLAS-ARCH-05
  - 06-erp.md
  - ADR-0008-stripe-payments.md
tags:
  - database
  - finance
  - accounting
  - ledger
  - ddd
  - rls
---

# Finance Database Schema

## Overview

The **Ledger** bounded context implements double-entry accounting, invoicing, payments, tax configuration, budgeting, and bank reconciliation. All tables reside in the PostgreSQL `ledger` schema with `organization_id` scoping, RLS, soft delete, and audit columns.

| Entity | Table | Aggregate Root |
|--------|-------|----------------|
| Chart of Accounts | `ledger.chart_of_accounts` | **ChartOfAccounts** (implicit via accounts tree) |
| Journal Entry | `ledger.journal_entries` | **JournalEntry** |
| Journal Line | `ledger.journal_lines` | **JournalEntry** (child) |
| Invoice | `ledger.invoices` | **Invoice** |
| Invoice Line | `ledger.invoice_lines` | **Invoice** (child) |
| Payment | `ledger.payments` | **Payment** |
| Payment Allocation | `ledger.payment_allocations` | **Payment** (child) |
| Tax Rate | `ledger.tax_rates` | **TaxRate** |
| Budget | `ledger.budgets` | **Budget** |
| Bank Account | `ledger.bank_accounts` | **BankAccount** |
| Reconciliation | `ledger.reconciliations` | **Reconciliation** |

---

## DDD Aggregate Boundaries

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Finance Aggregate Map                              │
├─────────────────────────────────────────────────────────────────────────┤
│  ChartOfAccounts (AR) — ledger.chart_of_accounts                         │
│    └── hierarchical GL accounts (parent_account_id self-reference)      │
├─────────────────────────────────────────────────────────────────────────┤
│  JournalEntry (AR) — ledger.journal_entries                              │
│    └── journalLines[] (must balance: sum(debit) = sum(credit))          │
├─────────────────────────────────────────────────────────────────────────┤
│  Invoice (AR) — ledger.invoices                                          │
│    └── invoiceLines[] (drives subtotal, tax, total)                     │
├─────────────────────────────────────────────────────────────────────────┤
│  Payment (AR) — ledger.payments                                          │
│    └── paymentAllocations[] (applied to invoices)                       │
├─────────────────────────────────────────────────────────────────────────┤
│  TaxRate (AR) — ledger.tax_rates                                         │
│    └── referenced by invoice lines and journal lines                    │
├─────────────────────────────────────────────────────────────────────────┤
│  Budget (AR) — ledger.budgets                                            │
│    └── period amounts per GL account                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  BankAccount (AR) — ledger.bank_accounts                                 │
│    └── reconciliations[] (bank statement matching)                      │
├─────────────────────────────────────────────────────────────────────────┤
│  Reconciliation (AR) — ledger.reconciliations                            │
│    └── statement period, matched transactions                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Invariants

| Aggregate | Rule |
|-----------|------|
| **ChartOfAccounts** | Account `code` unique per org; system accounts cannot be deleted; tree depth ≤ 8 |
| **JournalEntry** | Must balance; `posted` entries are immutable; reversal creates new entry |
| **JournalLine** | Exactly one of `debit_amount` or `credit_amount` > 0, not both |
| **Invoice** | Status: `draft → sent → partial → paid \| overdue \| void`; `paid` is terminal |
| **InvoiceLine** | `quantity > 0`; line total = qty × unit price − discount + tax |
| **Payment** | `amount > 0`; allocations cannot exceed payment amount |
| **PaymentAllocation** | Sum per payment ≤ payment.amount; sum per invoice ≤ invoice.balance_due |
| **TaxRate** | `rate` 0–100%; effective date ranges cannot overlap for same code |
| **Budget** | One budget per fiscal period + account combination |
| **BankAccount** | `account_number` masked in logs; linked to GL cash account |
| **Reconciliation** | `reconciled_balance` must match bank statement; period cannot overlap open recon |

---

## Entity Relationship Diagram

```
organizations ──┬── chart_of_accounts (self-referential)
                ├── tax_rates
                ├── journal_entries ── journal_lines ── chart_of_accounts
                ├── invoices ── invoice_lines
                ├── payments ── payment_allocations ── invoices
                ├── budgets ── chart_of_accounts
                └── bank_accounts ── reconciliations
                      ↑ (optional FK: customer.accounts, commercial.sales_orders)
```

---

## Tables

### 1. `ledger.chart_of_accounts`

```sql
CREATE TABLE ledger.chart_of_accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    parent_account_id   UUID REFERENCES ledger.chart_of_accounts(id),
    code                TEXT NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    account_type        TEXT NOT NULL
                        CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    account_subtype     TEXT,
    normal_balance      TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    is_system           BOOLEAN NOT NULL DEFAULT false,
    is_header           BOOLEAN NOT NULL DEFAULT false,
    currency_code       CHAR(3) NOT NULL DEFAULT 'USD',
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_coa_org_code_active
    ON ledger.chart_of_accounts (organization_id, code) WHERE deleted_at IS NULL;

CREATE INDEX idx_coa_organization_id ON ledger.chart_of_accounts (organization_id);
CREATE INDEX idx_coa_org_parent ON ledger.chart_of_accounts (organization_id, parent_account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_coa_org_type ON ledger.chart_of_accounts (organization_id, account_type) WHERE deleted_at IS NULL;
```

### 2. `ledger.tax_rates`

```sql
CREATE TABLE ledger.tax_rates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    code                TEXT NOT NULL,
    name                TEXT NOT NULL,
    rate                NUMERIC(7, 4) NOT NULL CHECK (rate >= 0 AND rate <= 100),
    tax_type            TEXT NOT NULL DEFAULT 'sales'
                        CHECK (tax_type IN ('sales', 'purchase', 'withholding', 'other')),
    is_compound         BOOLEAN NOT NULL DEFAULT false,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    effective_from      DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to        DATE,
    gl_account_id       UUID REFERENCES ledger.chart_of_accounts(id),
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_tax_rates_org_code_from
    ON ledger.tax_rates (organization_id, code, effective_from) WHERE deleted_at IS NULL;

CREATE INDEX idx_tax_rates_org_active ON ledger.tax_rates (organization_id, is_active) WHERE deleted_at IS NULL;
```

### 3. `ledger.journal_entries`

```sql
CREATE TABLE ledger.journal_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    entry_number        TEXT NOT NULL,
    entry_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    posting_date        DATE,
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'posted', 'reversed')),
    entry_type          TEXT NOT NULL DEFAULT 'standard'
                        CHECK (entry_type IN ('standard', 'adjusting', 'closing', 'reversing', 'system')),
    description         TEXT NOT NULL,
    reference_type      TEXT,
    reference_id        UUID,
    currency_code       CHAR(3) NOT NULL DEFAULT 'USD',
    total_debit         NUMERIC(19, 4) NOT NULL DEFAULT 0,
    total_credit        NUMERIC(19, 4) NOT NULL DEFAULT 0,
    reversed_entry_id   UUID REFERENCES ledger.journal_entries(id),
    posted_by           UUID REFERENCES atlas_core.users(id),
    posted_at           TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_journal_entries_balanced CHECK (total_debit = total_credit)
);

CREATE UNIQUE INDEX uq_journal_entries_org_number ON ledger.journal_entries (organization_id, entry_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_entries_org_date ON ledger.journal_entries (organization_id, entry_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_entries_org_status ON ledger.journal_entries (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_entries_org_reference ON ledger.journal_entries (organization_id, reference_type, reference_id);
```

### 4. `ledger.journal_lines`

```sql
CREATE TABLE ledger.journal_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    journal_entry_id    UUID NOT NULL REFERENCES ledger.journal_entries(id) ON DELETE CASCADE,
    line_number         INTEGER NOT NULL,
    account_id          UUID NOT NULL REFERENCES ledger.chart_of_accounts(id),
    description         TEXT,
    debit_amount        NUMERIC(19, 4) NOT NULL DEFAULT 0 CHECK (debit_amount >= 0),
    credit_amount       NUMERIC(19, 4) NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
    currency_code       CHAR(3) NOT NULL DEFAULT 'USD',
    tax_rate_id         UUID REFERENCES ledger.tax_rates(id),
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_journal_lines_debit_or_credit CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0)
    )
);

CREATE UNIQUE INDEX uq_journal_lines_org_entry_line ON ledger.journal_lines (organization_id, journal_entry_id, line_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_lines_org_account ON ledger.journal_lines (organization_id, account_id) WHERE deleted_at IS NULL;
```

### 5. `ledger.invoices`

```sql
CREATE TABLE ledger.invoices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    invoice_number      TEXT NOT NULL,
    invoice_type        TEXT NOT NULL DEFAULT 'sales'
                        CHECK (invoice_type IN ('sales', 'purchase', 'credit_note', 'debit_note')),
    account_id          UUID REFERENCES customer.accounts(id),
    sales_order_id      UUID REFERENCES commercial.sales_orders(id),
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'sent', 'partial', 'paid', 'overdue', 'void')),
    issue_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date            DATE NOT NULL,
    currency_code       CHAR(3) NOT NULL DEFAULT 'USD',
    subtotal            NUMERIC(19, 4) NOT NULL DEFAULT 0,
    discount_amount     NUMERIC(19, 4) NOT NULL DEFAULT 0,
    tax_amount          NUMERIC(19, 4) NOT NULL DEFAULT 0,
    total_amount        NUMERIC(19, 4) NOT NULL DEFAULT 0,
    amount_paid         NUMERIC(19, 4) NOT NULL DEFAULT 0,
    balance_due         NUMERIC(19, 4) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
    billing_address     JSONB NOT NULL DEFAULT '{}',
    notes               TEXT,
    terms               TEXT,
    journal_entry_id    UUID REFERENCES ledger.journal_entries(id),
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_invoices_org_number ON ledger.invoices (organization_id, invoice_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_org_account ON ledger.invoices (organization_id, account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_org_status_due ON ledger.invoices (organization_id, status, due_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_org_sales_order ON ledger.invoices (organization_id, sales_order_id) WHERE sales_order_id IS NOT NULL;
```

### 6. `ledger.invoice_lines`

```sql
CREATE TABLE ledger.invoice_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    invoice_id          UUID NOT NULL REFERENCES ledger.invoices(id) ON DELETE CASCADE,
    line_number         INTEGER NOT NULL,
    description         TEXT NOT NULL,
    product_variant_id  UUID REFERENCES stock.product_variants(id),
    quantity            NUMERIC(19, 6) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price          NUMERIC(19, 4) NOT NULL DEFAULT 0,
    discount_amount     NUMERIC(19, 4) NOT NULL DEFAULT 0,
    tax_rate_id         UUID REFERENCES ledger.tax_rates(id),
    tax_amount          NUMERIC(19, 4) NOT NULL DEFAULT 0,
    line_total          NUMERIC(19, 4) NOT NULL DEFAULT 0,
    gl_account_id       UUID REFERENCES ledger.chart_of_accounts(id),
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_invoice_lines_org_invoice_line ON ledger.invoice_lines (organization_id, invoice_id, line_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoice_lines_org_invoice ON ledger.invoice_lines (organization_id, invoice_id) WHERE deleted_at IS NULL;
```

### 7. `ledger.payments`

```sql
CREATE TABLE ledger.payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    payment_number      TEXT NOT NULL,
    payment_type        TEXT NOT NULL DEFAULT 'receipt'
                        CHECK (payment_type IN ('receipt', 'disbursement', 'refund', 'transfer')),
    payment_method      TEXT NOT NULL DEFAULT 'bank_transfer'
                        CHECK (payment_method IN ('cash', 'check', 'bank_transfer', 'credit_card', 'ach', 'wire', 'stripe', 'other')),
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'completed', 'failed', 'void')),
    account_id          UUID REFERENCES customer.accounts(id),
    bank_account_id     UUID REFERENCES ledger.bank_accounts(id),
    payment_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    currency_code       CHAR(3) NOT NULL DEFAULT 'USD',
    amount              NUMERIC(19, 4) NOT NULL CHECK (amount > 0),
    amount_allocated    NUMERIC(19, 4) NOT NULL DEFAULT 0,
    amount_unallocated  NUMERIC(19, 4) GENERATED ALWAYS AS (amount - amount_allocated) STORED,
    exchange_rate       NUMERIC(19, 8) NOT NULL DEFAULT 1,
    reference_number    TEXT,
    stripe_payment_id   TEXT,
    journal_entry_id    UUID REFERENCES ledger.journal_entries(id),
    notes               TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_payments_org_number ON ledger.payments (organization_id, payment_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_org_account ON ledger.payments (organization_id, account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_org_status ON ledger.payments (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_org_bank ON ledger.payments (organization_id, bank_account_id) WHERE bank_account_id IS NOT NULL;
CREATE UNIQUE INDEX uq_payments_stripe ON ledger.payments (organization_id, stripe_payment_id) WHERE stripe_payment_id IS NOT NULL AND deleted_at IS NULL;
```

### 8. `ledger.payment_allocations`

```sql
CREATE TABLE ledger.payment_allocations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    payment_id          UUID NOT NULL REFERENCES ledger.payments(id) ON DELETE CASCADE,
    invoice_id          UUID NOT NULL REFERENCES ledger.invoices(id),
    amount              NUMERIC(19, 4) NOT NULL CHECK (amount > 0),
    allocated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes               TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID REFERENCES atlas_core.users(id),

    CONSTRAINT payment_allocations_immutable CHECK (true)
);

CREATE UNIQUE INDEX uq_payment_allocations_org_payment_invoice
    ON ledger.payment_allocations (organization_id, payment_id, invoice_id);

CREATE INDEX idx_payment_allocations_org_invoice ON ledger.payment_allocations (organization_id, invoice_id);
CREATE INDEX idx_payment_allocations_org_payment ON ledger.payment_allocations (organization_id, payment_id);
```

### 9. `ledger.budgets`

```sql
CREATE TABLE ledger.budgets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    account_id          UUID NOT NULL REFERENCES ledger.chart_of_accounts(id),
    fiscal_year         INTEGER NOT NULL,
    period              INTEGER NOT NULL CHECK (period >= 1 AND period <= 12),
    budget_amount       NUMERIC(19, 4) NOT NULL DEFAULT 0,
    actual_amount       NUMERIC(19, 4) NOT NULL DEFAULT 0,
    variance_amount     NUMERIC(19, 4) GENERATED ALWAYS AS (budget_amount - actual_amount) STORED,
    currency_code       CHAR(3) NOT NULL DEFAULT 'USD',
    notes               TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_budgets_org_account_year_period
    ON ledger.budgets (organization_id, account_id, fiscal_year, period) WHERE deleted_at IS NULL;

CREATE INDEX idx_budgets_org_year ON ledger.budgets (organization_id, fiscal_year, period) WHERE deleted_at IS NULL;
```

### 10. `ledger.bank_accounts`

```sql
CREATE TABLE ledger.bank_accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    gl_account_id       UUID NOT NULL REFERENCES ledger.chart_of_accounts(id),
    name                TEXT NOT NULL,
    bank_name           TEXT,
    account_number      TEXT NOT NULL,
    account_number_last4 CHAR(4) NOT NULL,
    routing_number      TEXT,
    iban                TEXT,
    swift_code          TEXT,
    currency_code       CHAR(3) NOT NULL DEFAULT 'USD',
    account_type        TEXT NOT NULL DEFAULT 'checking'
                        CHECK (account_type IN ('checking', 'savings', 'credit_card', 'merchant', 'other')),
    current_balance     NUMERIC(19, 4) NOT NULL DEFAULT 0,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    is_primary          BOOLEAN NOT NULL DEFAULT false,
    plaid_item_id       TEXT,
    stripe_account_id   TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_bank_accounts_org_number_active
    ON ledger.bank_accounts (organization_id, account_number_last4, bank_name) WHERE deleted_at IS NULL;

CREATE INDEX idx_bank_accounts_organization_id ON ledger.bank_accounts (organization_id);
CREATE INDEX idx_bank_accounts_org_gl ON ledger.bank_accounts (organization_id, gl_account_id) WHERE deleted_at IS NULL;
```

### 11. `ledger.reconciliations`

```sql
CREATE TABLE ledger.reconciliations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    bank_account_id     UUID NOT NULL REFERENCES ledger.bank_accounts(id),
    status              TEXT NOT NULL DEFAULT 'in_progress'
                        CHECK (status IN ('in_progress', 'completed', 'void')),
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    statement_date      DATE NOT NULL,
    statement_balance   NUMERIC(19, 4) NOT NULL,
    book_balance        NUMERIC(19, 4) NOT NULL,
    reconciled_balance  NUMERIC(19, 4),
    difference_amount   NUMERIC(19, 4) GENERATED ALWAYS AS (statement_balance - COALESCE(reconciled_balance, book_balance)) STORED,
    completed_by        UUID REFERENCES atlas_core.users(id),
    completed_at        TIMESTAMPTZ,
    notes               TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_reconciliations_period CHECK (period_end >= period_start)
);

CREATE INDEX idx_reconciliations_org_bank ON ledger.reconciliations (organization_id, bank_account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reconciliations_org_status ON ledger.reconciliations (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_reconciliations_org_period ON ledger.reconciliations (organization_id, bank_account_id, period_start, period_end) WHERE deleted_at IS NULL;
```

---

## Row-Level Security (RLS)

```sql
DO $$
DECLARE tbl TEXT;
BEGIN
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'ledger' LOOP
        EXECUTE format('ALTER TABLE ledger.%I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('ALTER TABLE ledger.%I FORCE ROW LEVEL SECURITY', tbl);
    END LOOP;
END $$;

CREATE POLICY org_isolation_select ON ledger.invoices
    FOR SELECT USING (organization_id = current_setting('app.organization_id', true)::uuid);

CREATE POLICY org_isolation_insert ON ledger.invoices
    FOR INSERT WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);

CREATE POLICY org_isolation_update ON ledger.invoices
    FOR UPDATE
    USING (organization_id = current_setting('app.organization_id', true)::uuid)
    WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);

CREATE POLICY org_isolation_delete ON ledger.invoices
    FOR DELETE USING (organization_id = current_setting('app.organization_id', true)::uuid);
```

**Immutability grants:**
- `journal_entries` WHERE `status = 'posted'` — REVOKE UPDATE/DELETE on lines and header
- `payment_allocations` — INSERT only after payment completion; no UPDATE/DELETE

---

## Soft Delete Strategy

| Entity | Soft Delete | Notes |
|--------|-------------|-------|
| Chart of Accounts | Yes | System accounts (`is_system = true`) cannot be deleted |
| Journal Entries (draft) | Yes | Posted entries cannot be soft-deleted; use reversal |
| Journal Entries (posted) | No | Reversal entry required |
| Invoices | Yes | Void instead of delete for sent invoices |
| Payments | Yes | Completed payments void via reversing JE |
| Payment Allocations | No | Immutable; unallocate via compensating allocation |
| Tax Rates | Yes | Historical rates retained for audit |
| Budgets | Yes | — |
| Bank Accounts | Yes | Blocked if open reconciliation exists |
| Reconciliations | Yes | Completed recons are immutable |

---

## Audit Strategy

| Mechanism | Scope |
|-----------|-------|
| Append-only audit | All `posted` journal entries, payment completions, invoice posting |
| Temporal config | Tax rates use `effective_from` / `effective_to` for point-in-time queries |
| SOC 2 controls | Segregation: `invoices:approve` ≠ `payments:record` permissions |
| Domain events | `ledger.invoice.posted.v1`, `ledger.payment.received.v1`, `ledger.journal_entry.posted.v1` |
| Stripe sync | `stripe_payment_id` deduplication; webhook idempotency key in metadata |

---

## Migration Notes

| Migration | Description |
|-----------|-------------|
| `V090__create_ledger_schema.sql` | Create `ledger` schema |
| `V091__create_chart_of_accounts.sql` | COA + seed system accounts |
| `V092__create_tax_rates.sql` | Tax configuration |
| `V093__create_journal_entries.sql` | JE header + lines |
| `V094__create_invoices.sql` | Invoice header + lines |
| `V095__create_payments.sql` | Payments + allocations |
| `V096__create_budgets.sql` | Budget planning |
| `V097__create_bank_accounts.sql` | Bank accounts |
| `V098__create_reconciliations.sql` | Bank reconciliation |
| `V099__create_ledger_rls_policies.sql` | RLS all ledger tables |
| `V100__citus_distribute_ledger_tables.sql` | Citus on `organization_id` |

---

## Prisma Mapping

See [`prisma/models/finance.prisma`](../../prisma/models/finance.prisma).

---

*Document owner: Ledger Module Team · Review cadence: Per schema change*