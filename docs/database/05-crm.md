---
title: CRM Database Schema
document_id: ATLAS-DB-05
version: 1.0.0
status: draft
phase: 3
last_updated: 2026-06-30
bounded_context: customer
schema: customer
related_documents:
  - ATLAS-ARCH-05
  - ATLAS-STD-002
  - 06-erp.md
  - 07-finance.md
tags:
  - database
  - crm
  - customer
  - ddd
  - rls
---

# CRM Database Schema

## Overview

The **Customer** bounded context owns all CRM entities: accounts, contacts, leads, deals, pipeline configuration, activities, tagging, and account hierarchy. Data lives in the PostgreSQL `customer` schema. Every table is scoped by `organization_id` with Row-Level Security (RLS), soft delete, and standard audit columns.

| Entity | Table | Aggregate Root |
|--------|-------|----------------|
| Account | `customer.accounts` | **Account** |
| Contact | `customer.contacts` | **Contact** |
| Lead | `customer.leads` | **Lead** |
| Deal | `customer.deals` | **Deal** |
| Pipeline Stage | `customer.pipeline_stages` | **Pipeline** (via stages) |
| Deal Activity | `customer.deal_activities` | **Deal** (child entity) |
| Contact Tag | `customer.tags`, `customer.contact_tags` | **Tag** |
| Account Hierarchy | `customer.account_hierarchy` | **Account** (hierarchy edges) |

---

## DDD Aggregate Boundaries

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CRM Aggregate Map                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Account (AR)                                                            │
│    ├── contacts[] (reference by FK; Contact is separate AR)             │
│    ├── childAccounts[] (via account_hierarchy)                          │
│    └── deals[] (reference by FK; Deal is separate AR)                   │
├─────────────────────────────────────────────────────────────────────────┤
│  Contact (AR)                                                            │
│    └── contactTags[] (Tag assignment; Tag is separate AR)               │
├─────────────────────────────────────────────────────────────────────────┤
│  Lead (AR)                                                               │
│    └── converts to Contact + optional Deal (domain event)               │
├─────────────────────────────────────────────────────────────────────────┤
│  Deal (AR)                                                               │
│    ├── dealActivities[] (child entities; lifecycle-bound to Deal)       │
│    └── references: account, contact, pipelineStage, owner               │
├─────────────────────────────────────────────────────────────────────────┤
│  Pipeline (AR) — implicit via pipeline_stages                            │
│    └── pipelineStages[] (ordered child entities)                        │
├─────────────────────────────────────────────────────────────────────────┤
│  Tag (AR)                                                                │
│    └── contactTags[] (junction assignments)                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Invariants

| Aggregate | Rule |
|-----------|------|
| **Account** | `name` required; hierarchy cannot create cycles; parent and child must share `organization_id` |
| **Contact** | At least one of `email`, `phone`, or `display_name` required; email unique per org when not deleted |
| **Lead** | Status transitions: `new → contacted → qualified → converted \| disqualified`; `converted` is terminal |
| **Deal** | `amount >= 0`; `probability` 0–100; stage must belong to deal's pipeline; won/lost are terminal |
| **Pipeline Stage** | `sort_order` unique per pipeline; exactly one default stage per pipeline |
| **Deal Activity** | Immutable after creation except `completed_at` and `outcome` on open activities |
| **Tag** | `name` unique per organization (case-insensitive) |
| **Account Hierarchy** | No self-reference; depth ≤ 10; closure table maintained on insert/delete |

### Cross-Context References

| FK Target | Context | Usage |
|-----------|---------|-------|
| `atlas_core.users` | Platform | `owner_id`, `assigned_to_id`, audit actors |
| `atlas_core.organizations` | Platform | `organization_id` on all tables |
| `commercial.sales_orders` | ERP | Set on deal `won` via event (no direct FK) |

---

## Entity Relationship Diagram

```
organizations ──┬── accounts ──┬── account_hierarchy (ancestor/descendant)
                │              └── deals ── deal_activities
                ├── contacts ──┬── contact_tags ── tags
                │              └── leads (→ contact on convert)
                ├── pipeline_stages
                └── users (owner, assigned)
```

---

## Standard Columns

All CRM tables include:

```sql
organization_id  UUID NOT NULL REFERENCES atlas_core.organizations(id),
created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
deleted_at       TIMESTAMPTZ,                    -- NULL = active
created_by       UUID REFERENCES atlas_core.users(id),
updated_by       UUID REFERENCES atlas_core.users(id),
version          INTEGER NOT NULL DEFAULT 1
```

---

## Tables

### 1. `customer.accounts`

**Purpose:** Company or organization that is a customer, prospect, partner, or vendor in CRM.

```sql
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
    billing_address     JSONB NOT NULL DEFAULT '{}',
    shipping_address    JSONB NOT NULL DEFAULT '{}',
    annual_revenue      NUMERIC(19, 4),
    employee_count      INTEGER,
    currency_code       CHAR(3) NOT NULL DEFAULT 'USD',
    parent_account_id   UUID REFERENCES customer.accounts(id),
    owner_id            UUID REFERENCES atlas_core.users(id),
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive', 'archived')),
    description         TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT accounts_pkey PRIMARY KEY (id),
    CONSTRAINT fk_accounts_organization FOREIGN KEY (organization_id)
        REFERENCES atlas_core.organizations(id),
    CONSTRAINT fk_accounts_parent FOREIGN KEY (parent_account_id)
        REFERENCES customer.accounts(id)
);

CREATE UNIQUE INDEX uq_accounts_org_external_id
    ON customer.accounts (organization_id, external_id)
    WHERE external_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_accounts_org_name_active
    ON customer.accounts (organization_id, lower(name))
    WHERE deleted_at IS NULL;

CREATE INDEX idx_accounts_organization_id
    ON customer.accounts (organization_id);

CREATE INDEX idx_accounts_org_owner_active
    ON customer.accounts (organization_id, owner_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_accounts_org_parent_active
    ON customer.accounts (organization_id, parent_account_id)
    WHERE deleted_at IS NULL AND parent_account_id IS NOT NULL;

CREATE INDEX idx_accounts_org_type_status_active
    ON customer.accounts (organization_id, account_type, status)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_accounts_metadata_gin
    ON customer.accounts USING GIN (metadata);
```

---

### 2. `customer.contacts`

**Purpose:** Individual person associated with one or more accounts.

```sql
CREATE TABLE customer.contacts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    external_id         TEXT,
    account_id          UUID REFERENCES customer.accounts(id),
    salutation          TEXT,
    first_name          TEXT,
    last_name           TEXT,
    display_name        TEXT NOT NULL,
    email               CITEXT,
    phone               TEXT,
    mobile              TEXT,
    job_title           TEXT,
    department          TEXT,
    mailing_address     JSONB NOT NULL DEFAULT '{}',
    is_primary          BOOLEAN NOT NULL DEFAULT false,
    owner_id            UUID REFERENCES atlas_core.users(id),
    lead_source         TEXT,
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive', 'bounced', 'unsubscribed')),
    last_contacted_at   TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT contacts_pkey PRIMARY KEY (id),
    CONSTRAINT fk_contacts_organization FOREIGN KEY (organization_id)
        REFERENCES atlas_core.organizations(id),
    CONSTRAINT fk_contacts_account FOREIGN KEY (account_id)
        REFERENCES customer.accounts(id),
    CONSTRAINT chk_contacts_has_identifier CHECK (
        email IS NOT NULL OR phone IS NOT NULL OR mobile IS NOT NULL
    )
);

CREATE UNIQUE INDEX uq_contacts_org_external_id
    ON customer.contacts (organization_id, external_id)
    WHERE external_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_contacts_org_email_active
    ON customer.contacts (organization_id, email)
    WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_contacts_organization_id
    ON customer.contacts (organization_id);

CREATE INDEX idx_contacts_org_account_active
    ON customer.contacts (organization_id, account_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_contacts_org_owner_active
    ON customer.contacts (organization_id, owner_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_contacts_org_name_active
    ON customer.contacts (organization_id, lower(display_name))
    WHERE deleted_at IS NULL;

CREATE INDEX idx_contacts_org_last_contacted
    ON customer.contacts (organization_id, last_contacted_at DESC NULLS LAST)
    WHERE deleted_at IS NULL;
```

---

### 3. `customer.leads`

**Purpose:** Pre-qualification prospect before conversion to contact/account/deal.

```sql
CREATE TABLE customer.leads (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    external_id         TEXT,
    first_name          TEXT,
    last_name           TEXT,
    display_name        TEXT NOT NULL,
    email               CITEXT,
    phone               TEXT,
    company_name        TEXT,
    job_title           TEXT,
    lead_source         TEXT NOT NULL DEFAULT 'website'
                        CHECK (lead_source IN (
                            'website', 'referral', 'advertisement', 'cold_call',
                            'trade_show', 'partner', 'social_media', 'other'
                        )),
    status              TEXT NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'disqualified')),
    rating              TEXT CHECK (rating IN ('hot', 'warm', 'cold')),
    score               INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    assigned_to_id      UUID REFERENCES atlas_core.users(id),
    converted_at        TIMESTAMPTZ,
    converted_contact_id UUID REFERENCES customer.contacts(id),
    converted_account_id UUID REFERENCES customer.accounts(id),
    converted_deal_id   UUID REFERENCES customer.deals(id),
    disqualify_reason   TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT leads_pkey PRIMARY KEY (id),
    CONSTRAINT fk_leads_organization FOREIGN KEY (organization_id)
        REFERENCES atlas_core.organizations(id)
);

CREATE UNIQUE INDEX uq_leads_org_external_id
    ON customer.leads (organization_id, external_id)
    WHERE external_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_leads_org_email_active
    ON customer.leads (organization_id, email)
    WHERE email IS NOT NULL AND deleted_at IS NULL AND status NOT IN ('converted', 'disqualified');

CREATE INDEX idx_leads_organization_id
    ON customer.leads (organization_id);

CREATE INDEX idx_leads_org_status_active
    ON customer.leads (organization_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_leads_org_assigned_active
    ON customer.leads (organization_id, assigned_to_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_leads_org_score_active
    ON customer.leads (organization_id, score DESC)
    WHERE deleted_at IS NULL AND status NOT IN ('converted', 'disqualified');
```

---

### 4. `customer.pipeline_stages`

**Purpose:** Ordered stages within a sales pipeline. Multiple pipelines per organization supported via `pipeline_id`.

```sql
CREATE TABLE customer.pipeline_stages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    pipeline_id         UUID NOT NULL DEFAULT gen_random_uuid(),
    pipeline_name       TEXT NOT NULL DEFAULT 'Default Pipeline',
    name                TEXT NOT NULL,
    description         TEXT,
    sort_order          INTEGER NOT NULL,
    probability         INTEGER NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
    is_default          BOOLEAN NOT NULL DEFAULT false,
    is_won              BOOLEAN NOT NULL DEFAULT false,
    is_lost             BOOLEAN NOT NULL DEFAULT false,
    is_closed           BOOLEAN NOT NULL DEFAULT false,
    color               TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT pipeline_stages_pkey PRIMARY KEY (id),
    CONSTRAINT fk_pipeline_stages_organization FOREIGN KEY (organization_id)
        REFERENCES atlas_core.organizations(id),
    CONSTRAINT chk_pipeline_stages_terminal CHECK (
        NOT (is_won = true AND is_lost = true)
    )
);

CREATE UNIQUE INDEX uq_pipeline_stages_org_pipeline_order
    ON customer.pipeline_stages (organization_id, pipeline_id, sort_order)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_pipeline_stages_org_pipeline_name
    ON customer.pipeline_stages (organization_id, pipeline_id, lower(name))
    WHERE deleted_at IS NULL;

CREATE INDEX idx_pipeline_stages_organization_id
    ON customer.pipeline_stages (organization_id);

CREATE INDEX idx_pipeline_stages_org_pipeline_active
    ON customer.pipeline_stages (organization_id, pipeline_id, sort_order)
    WHERE deleted_at IS NULL;
```

---

### 5. `customer.deals`

**Purpose:** Sales opportunity tracked through pipeline stages.

```sql
CREATE TABLE customer.deals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    external_id         TEXT,
    name                TEXT NOT NULL,
    account_id          UUID REFERENCES customer.accounts(id),
    contact_id          UUID REFERENCES customer.contacts(id),
    pipeline_stage_id   UUID NOT NULL REFERENCES customer.pipeline_stages(id),
    owner_id            UUID NOT NULL REFERENCES atlas_core.users(id),
    amount              NUMERIC(19, 4) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    currency_code       CHAR(3) NOT NULL DEFAULT 'USD',
    probability         INTEGER NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
    expected_close_date DATE,
    actual_close_date   DATE,
    status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'won', 'lost', 'abandoned')),
    loss_reason         TEXT,
    lead_source         TEXT,
    description         TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT deals_pkey PRIMARY KEY (id),
    CONSTRAINT fk_deals_organization FOREIGN KEY (organization_id)
        REFERENCES atlas_core.organizations(id),
    CONSTRAINT fk_deals_pipeline_stage FOREIGN KEY (pipeline_stage_id)
        REFERENCES customer.pipeline_stages(id)
);

CREATE UNIQUE INDEX uq_deals_org_external_id
    ON customer.deals (organization_id, external_id)
    WHERE external_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_deals_organization_id
    ON customer.deals (organization_id);

CREATE INDEX idx_deals_org_stage_active
    ON customer.deals (organization_id, pipeline_stage_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_deals_org_owner_active
    ON customer.deals (organization_id, owner_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_deals_org_account_active
    ON customer.deals (organization_id, account_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_deals_org_status_close_date
    ON customer.deals (organization_id, status, expected_close_date)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_deals_org_amount_active
    ON customer.deals (organization_id, amount DESC)
    WHERE deleted_at IS NULL AND status = 'open';
```

---

### 6. `customer.deal_activities`

**Purpose:** Activity log entries (calls, emails, meetings, tasks, notes) attached to deals.

```sql
CREATE TABLE customer.deal_activities (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    deal_id             UUID NOT NULL REFERENCES customer.deals(id),
    activity_type       TEXT NOT NULL
                        CHECK (activity_type IN ('call', 'email', 'meeting', 'task', 'note', 'demo', 'proposal', 'other')),
    subject             TEXT NOT NULL,
    description         TEXT,
    scheduled_at        TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    duration_minutes    INTEGER CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
    outcome             TEXT,
    assigned_to_id      UUID REFERENCES atlas_core.users(id),
    contact_id          UUID REFERENCES customer.contacts(id),
    is_completed        BOOLEAN NOT NULL DEFAULT false,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT deal_activities_pkey PRIMARY KEY (id),
    CONSTRAINT fk_deal_activities_organization FOREIGN KEY (organization_id)
        REFERENCES atlas_core.organizations(id),
    CONSTRAINT fk_deal_activities_deal FOREIGN KEY (deal_id)
        REFERENCES customer.deals(id) ON DELETE CASCADE
);

CREATE INDEX idx_deal_activities_organization_id
    ON customer.deal_activities (organization_id);

CREATE INDEX idx_deal_activities_org_deal_active
    ON customer.deal_activities (organization_id, deal_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_deal_activities_org_assigned_scheduled
    ON customer.deal_activities (organization_id, assigned_to_id, scheduled_at)
    WHERE deleted_at IS NULL AND is_completed = false;

CREATE INDEX idx_deal_activities_org_type_active
    ON customer.deal_activities (organization_id, activity_type)
    WHERE deleted_at IS NULL;
```

---

### 7. `customer.tags` and `customer.contact_tags`

**Purpose:** Flexible tagging for contact segmentation and filtering.

```sql
CREATE TABLE customer.tags (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    name                TEXT NOT NULL,
    color               TEXT,
    description         TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT tags_pkey PRIMARY KEY (id),
    CONSTRAINT fk_tags_organization FOREIGN KEY (organization_id)
        REFERENCES atlas_core.organizations(id)
);

CREATE UNIQUE INDEX uq_tags_org_name_active
    ON customer.tags (organization_id, lower(name))
    WHERE deleted_at IS NULL;

CREATE INDEX idx_tags_organization_id
    ON customer.tags (organization_id);

CREATE TABLE customer.contact_tags (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    contact_id          UUID NOT NULL REFERENCES customer.contacts(id) ON DELETE CASCADE,
    tag_id              UUID NOT NULL REFERENCES customer.tags(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID REFERENCES atlas_core.users(id),

    CONSTRAINT contact_tags_pkey PRIMARY KEY (id),
    CONSTRAINT fk_contact_tags_organization FOREIGN KEY (organization_id)
        REFERENCES atlas_core.organizations(id),
    CONSTRAINT fk_contact_tags_contact FOREIGN KEY (contact_id)
        REFERENCES customer.contacts(id),
    CONSTRAINT fk_contact_tags_tag FOREIGN KEY (tag_id)
        REFERENCES customer.tags(id)
);

CREATE UNIQUE INDEX uq_contact_tags_org_contact_tag
    ON customer.contact_tags (organization_id, contact_id, tag_id);

CREATE INDEX idx_contact_tags_org_tag
    ON customer.contact_tags (organization_id, tag_id);

CREATE INDEX idx_contact_tags_org_contact
    ON customer.contact_tags (organization_id, contact_id);
```

---

### 8. `customer.account_hierarchy`

**Purpose:** Closure table for efficient ancestor/descendant queries on account trees.

```sql
CREATE TABLE customer.account_hierarchy (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    ancestor_id         UUID NOT NULL REFERENCES customer.accounts(id) ON DELETE CASCADE,
    descendant_id       UUID NOT NULL REFERENCES customer.accounts(id) ON DELETE CASCADE,
    depth               INTEGER NOT NULL CHECK (depth >= 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID REFERENCES atlas_core.users(id),

    CONSTRAINT account_hierarchy_pkey PRIMARY KEY (id),
    CONSTRAINT fk_account_hierarchy_organization FOREIGN KEY (organization_id)
        REFERENCES atlas_core.organizations(id),
    CONSTRAINT chk_account_hierarchy_no_self_loop CHECK (ancestor_id <> descendant_id OR depth = 0)
);

CREATE UNIQUE INDEX uq_account_hierarchy_org_ancestor_descendant
    ON customer.account_hierarchy (organization_id, ancestor_id, descendant_id);

CREATE INDEX idx_account_hierarchy_org_ancestor
    ON customer.account_hierarchy (organization_id, ancestor_id, depth);

CREATE INDEX idx_account_hierarchy_org_descendant
    ON customer.account_hierarchy (organization_id, descendant_id, depth);
```

**Closure table maintenance:** On `parent_account_id` change, application service rebuilds closure rows for affected subtree. Trigger-based maintenance is optional for support tooling paths only.

---

## Row-Level Security (RLS)

Apply to all CRM tables:

```sql
-- Enable RLS on all customer schema tables
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'customer'
    LOOP
        EXECUTE format('ALTER TABLE customer.%I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('ALTER TABLE customer.%I FORCE ROW LEVEL SECURITY', tbl);
    END LOOP;
END $$;

-- Template policy (repeat per table)
CREATE POLICY org_isolation_select ON customer.accounts
    FOR SELECT
    USING (organization_id = current_setting('app.organization_id', true)::uuid);

CREATE POLICY org_isolation_insert ON customer.accounts
    FOR INSERT
    WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);

CREATE POLICY org_isolation_update ON customer.accounts
    FOR UPDATE
    USING (organization_id = current_setting('app.organization_id', true)::uuid)
    WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);

CREATE POLICY org_isolation_delete ON customer.accounts
    FOR DELETE
    USING (organization_id = current_setting('app.organization_id', true)::uuid);
```

**Session context** (set on every transaction via PgBouncer transaction pooling):

```sql
SET LOCAL app.organization_id = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
SET LOCAL app.user_id = '550e8400-e29b-41d4-a716-446655440000';
```

---

## Soft Delete Strategy

| Rule | Implementation |
|------|----------------|
| Default delete | `UPDATE SET deleted_at = now(), updated_by = $user, version = version + 1` |
| Query filter | All reads include `WHERE deleted_at IS NULL` (repository + DB views) |
| Unique constraints | Partial indexes with `WHERE deleted_at IS NULL` |
| Cascade | Soft-delete account does not auto soft-delete contacts; domain service handles orphan policy |
| Hard delete | GDPR erasure workflow only; cascades to `deal_activities`, `contact_tags`, `account_hierarchy` |
| Restore | `UPDATE SET deleted_at = NULL` with audit event `customer.contact.restored.v1` |

---

## Audit Strategy

| Mechanism | Scope |
|-----------|-------|
| Standard columns | All tables: `created_at`, `updated_at`, `created_by`, `updated_by`, `version` |
| Optimistic locking | `UPDATE ... WHERE id = $1 AND version = $2`; increment version on success |
| Append-only audit log | `atlas_audit.entity_audit` for Account, Deal, Lead state changes |
| Domain events | `customer.lead.created.v1`, `customer.deal.stage_changed.v1`, `customer.lead.converted.v1` |
| Immutable activities | `deal_activities` subject/description immutable after 24h (application rule) |

---

## Migration Notes

| Migration | Description |
|-----------|-------------|
| `V050__create_customer_schema.sql` | Create `customer` schema and extension dependencies (`citext`) |
| `V051__create_accounts_table.sql` | Accounts + indexes |
| `V052__create_contacts_table.sql` | Contacts + indexes |
| `V053__create_leads_table.sql` | Leads + indexes |
| `V054__create_pipeline_stages_table.sql` | Pipeline stages + seed default pipeline per org |
| `V055__create_deals_table.sql` | Deals + FK to pipeline stages |
| `V056__create_deal_activities_table.sql` | Deal activities |
| `V057__create_tags_and_contact_tags.sql` | Tags junction |
| `V058__create_account_hierarchy_table.sql` | Closure table |
| `V059__create_customer_rls_policies.sql` | RLS on all customer tables |
| `V060__citus_distribute_customer_tables.sql` | `SELECT create_distributed_table(..., 'organization_id')` at scale |

**Citus distribution:** All `customer.*` tables distributed on `organization_id` when Citus is activated.

---

## Prisma Mapping

See [`prisma/models/crm.prisma`](../../prisma/models/crm.prisma) for ORM models aligned to this schema.

---

*Document owner: Customer Module Team · Review cadence: Per schema change*