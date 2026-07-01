-- Atlas BOS — Finance foundation schema
-- Source: docs/database/07-finance.md

CREATE SCHEMA IF NOT EXISTS ledger;

CREATE TABLE ledger.chart_of_accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    parent_account_id   UUID REFERENCES ledger.chart_of_accounts(id),
    code                TEXT NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    account_type        TEXT NOT NULL
        CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    normal_balance      TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    is_system           BOOLEAN NOT NULL DEFAULT false,
    currency_code       CHAR(3) NOT NULL DEFAULT 'USD',
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID,
    updated_by          UUID,
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_coa_org_code_active
    ON ledger.chart_of_accounts (organization_id, code) WHERE deleted_at IS NULL;

CREATE TABLE ledger.journal_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    entry_number        TEXT NOT NULL,
    entry_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    status              TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'posted', 'reversed')),
    description         TEXT NOT NULL,
    currency_code       CHAR(3) NOT NULL DEFAULT 'USD',
    total_debit         NUMERIC(19, 4) NOT NULL DEFAULT 0,
    total_credit        NUMERIC(19, 4) NOT NULL DEFAULT 0,
    posted_by           UUID REFERENCES atlas_core.users(id),
    posted_at           TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID,
    updated_by          UUID,
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_journal_entries_org_number
    ON ledger.journal_entries (organization_id, entry_number) WHERE deleted_at IS NULL;

CREATE TABLE ledger.journal_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    journal_entry_id    UUID NOT NULL REFERENCES ledger.journal_entries(id),
    account_id          UUID NOT NULL REFERENCES ledger.chart_of_accounts(id),
    line_number         INTEGER NOT NULL,
    description         TEXT,
    debit_amount        NUMERIC(19, 4) NOT NULL DEFAULT 0,
    credit_amount       NUMERIC(19, 4) NOT NULL DEFAULT 0,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    version             INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT chk_journal_line_amount CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0)
    )
);

CREATE INDEX idx_journal_lines_entry ON ledger.journal_lines (journal_entry_id) WHERE deleted_at IS NULL;