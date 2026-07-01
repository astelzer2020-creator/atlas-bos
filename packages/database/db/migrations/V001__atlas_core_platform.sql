-- Atlas BOS — Platform core schema (workspaces, organizations, teams, identity basics)
-- Source: prisma/models/platform.prisma, docs/database/02-platform-core.md, 03-identity-auth.md

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions & schema bootstrap
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS atlas_core;

-- ─────────────────────────────────────────────────────────────────────────────
-- Shared helpers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION atlas_core.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION atlas_core.apply_standard_rls(
    p_schema TEXT,
    p_table  TEXT
) RETURNS VOID AS $$
BEGIN
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', p_schema, p_table);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', p_schema, p_table);

    EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR SELECT USING (
            organization_id = NULLIF(current_setting(''app.organization_id'', true), '''')::uuid
            OR current_setting(''app.is_platform_admin'', true) = ''true''
        )',
        p_table || '_select', p_schema, p_table
    );

    EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR INSERT WITH CHECK (
            organization_id = NULLIF(current_setting(''app.organization_id'', true), '''')::uuid
        )',
        p_table || '_insert', p_schema, p_table
    );

    EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR UPDATE USING (
            organization_id = NULLIF(current_setting(''app.organization_id'', true), '''')::uuid
        ) WITH CHECK (
            organization_id = NULLIF(current_setting(''app.organization_id'', true), '''')::uuid
        )',
        p_table || '_update', p_schema, p_table
    );

    EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR DELETE USING (
            current_setting(''app.is_platform_admin'', true) = ''true''
            AND organization_id = NULLIF(current_setting(''app.organization_id'', true), '''')::uuid
        )',
        p_table || '_delete', p_schema, p_table
    );
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- Platform enums
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE atlas_core.organization_status AS ENUM (
    'PROVISIONING',
    'ACTIVE',
    'SUSPENDED',
    'ARCHIVED'
);

CREATE TYPE atlas_core.isolation_tier AS ENUM (
    'SHARED_RLS',
    'DEDICATED_SCHEMA',
    'DEDICATED_CLUSTER'
);

CREATE TYPE atlas_core.membership_status AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'REMOVED'
);

CREATE TYPE atlas_core.team_member_role AS ENUM (
    'LEAD',
    'MEMBER'
);

CREATE TYPE atlas_core.invitation_status AS ENUM (
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'EXPIRED',
    'REVOKED'
);

CREATE TYPE atlas_core.user_status AS ENUM (
    'PENDING_VERIFICATION',
    'ACTIVE',
    'SUSPENDED',
    'DEACTIVATED'
);

CREATE TYPE atlas_core.user_type AS ENUM (
    'HUMAN',
    'SERVICE_ACCOUNT',
    'AGENT'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Users (global identity — created before workspace FK dependencies)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE atlas_core.users (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                   CITEXT NOT NULL,
    email_verified          BOOLEAN NOT NULL DEFAULT false,
    email_verified_at       TIMESTAMPTZ,
    password_hash           TEXT,
    type                    atlas_core.user_type NOT NULL DEFAULT 'HUMAN',
    status                  atlas_core.user_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
    display_name            TEXT,
    avatar_url              TEXT,
    locale                  TEXT NOT NULL DEFAULT 'en-US',
    timezone                TEXT NOT NULL DEFAULT 'UTC',
    last_login_at           TIMESTAMPTZ,
    last_login_ip           TEXT,
    failed_login_attempts   INTEGER NOT NULL DEFAULT 0,
    locked_until            TIMESTAMPTZ,
    password_changed_at     TIMESTAMPTZ,
    metadata                JSONB NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ,
    created_by_id           UUID,
    updated_by_id           UUID,
    version                 INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_users_email_format
        CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$'),
    CONSTRAINT chk_users_failed_attempts_non_negative
        CHECK (failed_login_attempts >= 0),
    CONSTRAINT chk_users_metadata_is_object
        CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE UNIQUE INDEX uq_users_email_active
    ON atlas_core.users (email)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_users_status
    ON atlas_core.users (status)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_users_type
    ON atlas_core.users (type)
    WHERE deleted_at IS NULL;

CREATE TRIGGER trg_users_set_updated_at
    BEFORE UPDATE ON atlas_core.users
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Workspaces
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE atlas_core.workspaces (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                TEXT NOT NULL,
    name                TEXT NOT NULL,
    display_name        TEXT,
    owner_user_id       UUID NOT NULL REFERENCES atlas_core.users(id),
    plan_id             UUID,
    settings            JSONB NOT NULL DEFAULT '{}',
    metadata            JSONB NOT NULL DEFAULT '{}',
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by_id       UUID REFERENCES atlas_core.users(id),
    updated_by_id       UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_workspaces_slug_format
        CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
    CONSTRAINT chk_workspaces_settings_is_object
        CHECK (jsonb_typeof(settings) = 'object')
);

CREATE UNIQUE INDEX uq_workspaces_slug_active
    ON atlas_core.workspaces (slug)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_workspaces_owner_user_id
    ON atlas_core.workspaces (owner_user_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_workspaces_slug
    ON atlas_core.workspaces (slug)
    WHERE deleted_at IS NULL;

CREATE TRIGGER trg_workspaces_set_updated_at
    BEFORE UPDATE ON atlas_core.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Organizations
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE atlas_core.organizations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES atlas_core.workspaces(id),
    slug                TEXT NOT NULL,
    name                TEXT NOT NULL,
    display_name        TEXT,
    legal_name          TEXT,
    status              atlas_core.organization_status NOT NULL DEFAULT 'PROVISIONING',
    isolation_tier      atlas_core.isolation_tier NOT NULL DEFAULT 'SHARED_RLS',
    timezone            TEXT NOT NULL DEFAULT 'UTC',
    locale              TEXT NOT NULL DEFAULT 'en-US',
    currency_code       CHAR(3) NOT NULL DEFAULT 'USD',
    data_region         TEXT NOT NULL DEFAULT 'us-east-1',
    settings            JSONB NOT NULL DEFAULT '{}',
    metadata            JSONB NOT NULL DEFAULT '{}',
    provisioned_at      TIMESTAMPTZ,
    suspended_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by_id       UUID REFERENCES atlas_core.users(id),
    updated_by_id       UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_organizations_slug_format
        CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
    CONSTRAINT chk_organizations_currency_valid
        CHECK (currency_code ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_organizations_settings_is_object
        CHECK (jsonb_typeof(settings) = 'object')
);

CREATE UNIQUE INDEX uq_organizations_workspace_slug_active
    ON atlas_core.organizations (workspace_id, slug)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_organizations_workspace_id
    ON atlas_core.organizations (workspace_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_organizations_status
    ON atlas_core.organizations (status)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_organizations_data_region
    ON atlas_core.organizations (data_region)
    WHERE deleted_at IS NULL AND status = 'ACTIVE';

CREATE TRIGGER trg_organizations_set_updated_at
    BEFORE UPDATE ON atlas_core.organizations
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Teams
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE atlas_core.teams (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    parent_team_id      UUID REFERENCES atlas_core.teams(id),
    slug                TEXT NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    settings            JSONB NOT NULL DEFAULT '{}',
    metadata            JSONB NOT NULL DEFAULT '{}',
    is_default          BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by_id       UUID REFERENCES atlas_core.users(id),
    updated_by_id       UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_teams_slug_format
        CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
    CONSTRAINT chk_teams_no_self_parent
        CHECK (parent_team_id IS NULL OR parent_team_id != id)
);

CREATE UNIQUE INDEX uq_teams_org_slug_active
    ON atlas_core.teams (organization_id, slug)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_teams_id_organization
    ON atlas_core.teams (id, organization_id);

CREATE INDEX idx_teams_organization_id
    ON atlas_core.teams (organization_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_teams_parent_team_id
    ON atlas_core.teams (parent_team_id)
    WHERE deleted_at IS NULL AND parent_team_id IS NOT NULL;

CREATE TRIGGER trg_teams_set_updated_at
    BEFORE UPDATE ON atlas_core.teams
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.set_updated_at();

SELECT atlas_core.apply_standard_rls('atlas_core', 'teams');

-- ─────────────────────────────────────────────────────────────────────────────
-- Workspace members
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE atlas_core.workspace_members (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES atlas_core.workspaces(id),
    user_id             UUID NOT NULL REFERENCES atlas_core.users(id),
    status              atlas_core.membership_status NOT NULL DEFAULT 'ACTIVE',
    is_admin            BOOLEAN NOT NULL DEFAULT false,
    joined_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    removed_at          TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by_id       UUID REFERENCES atlas_core.users(id),
    updated_by_id       UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_workspace_members_removed_consistency
        CHECK (
            (status = 'REMOVED' AND removed_at IS NOT NULL)
            OR (status != 'REMOVED' AND removed_at IS NULL)
        )
);

CREATE UNIQUE INDEX uq_workspace_members_active
    ON atlas_core.workspace_members (workspace_id, user_id)
    WHERE deleted_at IS NULL AND status = 'ACTIVE';

CREATE INDEX idx_workspace_members_user_id
    ON atlas_core.workspace_members (user_id)
    WHERE deleted_at IS NULL AND status = 'ACTIVE';

CREATE INDEX idx_workspace_members_workspace_id
    ON atlas_core.workspace_members (workspace_id)
    WHERE deleted_at IS NULL;

CREATE TRIGGER trg_workspace_members_set_updated_at
    BEFORE UPDATE ON atlas_core.workspace_members
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Organization members
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE atlas_core.organization_members (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    user_id             UUID NOT NULL REFERENCES atlas_core.users(id),
    status              atlas_core.membership_status NOT NULL DEFAULT 'ACTIVE',
    title               TEXT,
    department          TEXT,
    is_owner            BOOLEAN NOT NULL DEFAULT false,
    is_billing_admin    BOOLEAN NOT NULL DEFAULT false,
    joined_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    removed_at          TIMESTAMPTZ,
    last_active_at      TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by_id       UUID REFERENCES atlas_core.users(id),
    updated_by_id       UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_org_members_removed_consistency
        CHECK (
            (status = 'REMOVED' AND removed_at IS NOT NULL)
            OR (status != 'REMOVED' AND removed_at IS NULL)
        )
);

CREATE UNIQUE INDEX uq_organization_members_active
    ON atlas_core.organization_members (organization_id, user_id)
    WHERE deleted_at IS NULL AND status = 'ACTIVE';

CREATE INDEX idx_organization_members_user_id
    ON atlas_core.organization_members (user_id)
    WHERE deleted_at IS NULL AND status = 'ACTIVE';

CREATE INDEX idx_organization_members_organization_id
    ON atlas_core.organization_members (organization_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_organization_members_owners
    ON atlas_core.organization_members (organization_id)
    WHERE deleted_at IS NULL AND is_owner = true;

CREATE TRIGGER trg_organization_members_set_updated_at
    BEFORE UPDATE ON atlas_core.organization_members
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.set_updated_at();

SELECT atlas_core.apply_standard_rls('atlas_core', 'organization_members');

-- ─────────────────────────────────────────────────────────────────────────────
-- Team members
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE atlas_core.team_members (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    team_id             UUID NOT NULL,
    user_id             UUID NOT NULL REFERENCES atlas_core.users(id),
    role                atlas_core.team_member_role NOT NULL DEFAULT 'MEMBER',
    joined_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by_id       UUID REFERENCES atlas_core.users(id),
    updated_by_id       UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT fk_team_members_team_org
        FOREIGN KEY (team_id, organization_id)
        REFERENCES atlas_core.teams (id, organization_id)
);

CREATE UNIQUE INDEX uq_team_members_active
    ON atlas_core.team_members (team_id, user_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_team_members_organization_id
    ON atlas_core.team_members (organization_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_team_members_user_id
    ON atlas_core.team_members (user_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_team_members_team_id
    ON atlas_core.team_members (team_id)
    WHERE deleted_at IS NULL;

CREATE TRIGGER trg_team_members_set_updated_at
    BEFORE UPDATE ON atlas_core.team_members
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.set_updated_at();

SELECT atlas_core.apply_standard_rls('atlas_core', 'team_members');

-- ─────────────────────────────────────────────────────────────────────────────
-- Sessions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE atlas_core.sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES atlas_core.users(id),
    organization_id     UUID REFERENCES atlas_core.organizations(id),
    workspace_id        UUID REFERENCES atlas_core.workspaces(id),
    ip_address          TEXT,
    user_agent          TEXT,
    device_fingerprint  TEXT,
    mfa_verified        BOOLEAN NOT NULL DEFAULT false,
    mfa_verified_at     TIMESTAMPTZ,
    is_remembered       BOOLEAN NOT NULL DEFAULT false,
    expires_at          TIMESTAMPTZ NOT NULL,
    last_activity_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked             BOOLEAN NOT NULL DEFAULT false,
    revoked_at          TIMESTAMPTZ,
    revoked_reason      TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_sessions_expires_future
        CHECK (expires_at > created_at),
    CONSTRAINT chk_sessions_revoked_consistency
        CHECK (
            (revoked = true AND revoked_at IS NOT NULL)
            OR (revoked = false AND revoked_at IS NULL)
        )
);

CREATE INDEX idx_sessions_user_id
    ON atlas_core.sessions (user_id)
    WHERE revoked = false;

CREATE INDEX idx_sessions_organization_id
    ON atlas_core.sessions (organization_id)
    WHERE revoked = false;

CREATE INDEX idx_sessions_expires_at
    ON atlas_core.sessions (expires_at)
    WHERE revoked = false;

CREATE TRIGGER trg_sessions_set_updated_at
    BEFORE UPDATE ON atlas_core.sessions
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Refresh tokens
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE atlas_core.refresh_tokens (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID NOT NULL REFERENCES atlas_core.sessions(id),
    user_id             UUID NOT NULL REFERENCES atlas_core.users(id),
    token_hash          TEXT NOT NULL,
    family_id           UUID NOT NULL DEFAULT gen_random_uuid(),
    parent_token_id     UUID REFERENCES atlas_core.refresh_tokens(id),
    expires_at          TIMESTAMPTZ NOT NULL,
    issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    used_at             TIMESTAMPTZ,
    revoked             BOOLEAN NOT NULL DEFAULT false,
    revoked_at          TIMESTAMPTZ,
    revoked_reason      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_refresh_tokens_hash_length
        CHECK (length(token_hash) = 64)
);

CREATE UNIQUE INDEX uq_refresh_tokens_hash
    ON atlas_core.refresh_tokens (token_hash);

CREATE INDEX idx_refresh_tokens_session_id
    ON atlas_core.refresh_tokens (session_id)
    WHERE revoked = false;

CREATE INDEX idx_refresh_tokens_family_id
    ON atlas_core.refresh_tokens (family_id)
    WHERE revoked = false;

CREATE INDEX idx_refresh_tokens_user_id
    ON atlas_core.refresh_tokens (user_id)
    WHERE revoked = false;

CREATE INDEX idx_refresh_tokens_expires_at
    ON atlas_core.refresh_tokens (expires_at)
    WHERE revoked = false;

COMMENT ON SCHEMA atlas_core IS 'Atlas platform core: tenancy, identity, authorization';
COMMENT ON TABLE atlas_core.organizations IS 'RLS tenant boundary. organization_id is the tenant key for all business data.';