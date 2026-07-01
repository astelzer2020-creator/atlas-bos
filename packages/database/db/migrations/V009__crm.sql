-- Atlas BOS — CRM foundation schema
-- Source: docs/database/05-crm.md

CREATE SCHEMA IF NOT EXISTS customer;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE customer.accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    external_id         TEXT,
    name                TEXT NOT NULL,
    legal_name          TEXT,
    account_type        TEXT NOT NULL DEFAULT 'prospect'
        CHECK (account_type IN ('prospect', 'customer', 'partner', 'vendor', 'competitor', 'other')),
    industry            TEXT,
    website             TEXT,
    phone               TEXT,
    email               CITEXT,
    owner_id            UUID REFERENCES atlas_core.users(id),
    status              TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'archived')),
    description         TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID,
    updated_by          UUID,
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_accounts_organization_id ON customer.accounts (organization_id);
CREATE INDEX idx_accounts_org_type_status ON customer.accounts (organization_id, account_type, status) WHERE deleted_at IS NULL;

CREATE TABLE customer.contacts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    account_id          UUID REFERENCES customer.accounts(id),
    first_name          TEXT,
    last_name           TEXT,
    display_name        TEXT NOT NULL,
    email               CITEXT,
    phone               TEXT,
    job_title           TEXT,
    owner_id            UUID REFERENCES atlas_core.users(id),
    status              TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'bounced', 'unsubscribed')),
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID,
    updated_by          UUID,
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_contacts_organization_id ON customer.contacts (organization_id);
CREATE INDEX idx_contacts_org_account ON customer.contacts (organization_id, account_id) WHERE deleted_at IS NULL;

CREATE TABLE customer.pipeline_stages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    pipeline_id         UUID NOT NULL DEFAULT gen_random_uuid(),
    pipeline_name       TEXT NOT NULL DEFAULT 'Default Pipeline',
    name                TEXT NOT NULL,
    sort_order          INTEGER NOT NULL,
    probability         INTEGER NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
    is_won              BOOLEAN NOT NULL DEFAULT false,
    is_lost             BOOLEAN NOT NULL DEFAULT false,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID,
    updated_by          UUID,
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_pipeline_stages_org ON customer.pipeline_stages (organization_id, pipeline_id, sort_order) WHERE deleted_at IS NULL;

CREATE TABLE customer.deals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    name                TEXT NOT NULL,
    account_id          UUID REFERENCES customer.accounts(id),
    contact_id          UUID REFERENCES customer.contacts(id),
    pipeline_stage_id   UUID NOT NULL REFERENCES customer.pipeline_stages(id),
    owner_id            UUID NOT NULL REFERENCES atlas_core.users(id),
    amount              NUMERIC(19, 4) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    currency_code       CHAR(3) NOT NULL DEFAULT 'USD',
    probability         INTEGER NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
    expected_close_date DATE,
    status              TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'won', 'lost', 'abandoned')),
    description         TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID,
    updated_by          UUID,
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_deals_organization_id ON customer.deals (organization_id);
CREATE INDEX idx_deals_org_status ON customer.deals (organization_id, status) WHERE deleted_at IS NULL;