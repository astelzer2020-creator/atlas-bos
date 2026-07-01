-- Atlas BOS — Authorization schema (roles, permissions, assignments, policies)
-- Source: prisma/models/platform.prisma, docs/database/04-authorization.md

-- ─────────────────────────────────────────────────────────────────────────────
-- Authorization enums
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE atlas_core.principal_type AS ENUM (
    'USER',
    'SERVICE_ACCOUNT',
    'API_KEY',
    'AGENT',
    'OAUTH_APP'
);

CREATE TYPE atlas_core.scope_type AS ENUM (
    'ORGANIZATION',
    'WORKSPACE',
    'TEAM',
    'RESOURCE'
);

CREATE TYPE atlas_core.permission_effect AS ENUM (
    'ALLOW',
    'DENY'
);

CREATE TYPE atlas_core.policy_effect AS ENUM (
    'ALLOW',
    'DENY'
);

CREATE TYPE atlas_core.policy_bind_type AS ENUM (
    'ORGANIZATION',
    'WORKSPACE',
    'TEAM',
    'ROLE',
    'RESOURCE_TYPE'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Permissions (global catalog)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE atlas_core.permissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                TEXT NOT NULL,
    module              TEXT NOT NULL,
    resource            TEXT NOT NULL,
    action              TEXT NOT NULL,
    description         TEXT,
    is_system           BOOLEAN NOT NULL DEFAULT true,
    is_deprecated       BOOLEAN NOT NULL DEFAULT false,
    deprecated_at       TIMESTAMPTZ,
    replacement_code    TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_permissions_code UNIQUE (code),
    CONSTRAINT chk_permissions_code_format
        CHECK (code ~ '^[a-z_]+:[a-z_]+:[a-z_]+$')
);

CREATE INDEX idx_permissions_module
    ON atlas_core.permissions (module);

CREATE INDEX idx_permissions_resource
    ON atlas_core.permissions (module, resource);

CREATE INDEX idx_permissions_action
    ON atlas_core.permissions (action);

CREATE TRIGGER trg_permissions_set_updated_at
    BEFORE UPDATE ON atlas_core.permissions
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Roles
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE atlas_core.roles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    slug                TEXT NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    scope_type          atlas_core.scope_type NOT NULL DEFAULT 'ORGANIZATION',
    is_system           BOOLEAN NOT NULL DEFAULT false,
    is_default          BOOLEAN NOT NULL DEFAULT false,
    priority            INTEGER NOT NULL DEFAULT 0,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by_id       UUID REFERENCES atlas_core.users(id),
    updated_by_id       UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_roles_slug_format
        CHECK (slug ~ '^[a-z][a-z0-9_]{0,62}$'),
    CONSTRAINT chk_roles_system_slug
        CHECK (is_system = false OR slug IN ('owner', 'admin', 'member', 'viewer', 'guest', 'billing_admin'))
);

CREATE UNIQUE INDEX uq_roles_org_slug_active
    ON atlas_core.roles (organization_id, slug)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_roles_id_organization
    ON atlas_core.roles (id, organization_id);

CREATE INDEX idx_roles_organization_id
    ON atlas_core.roles (organization_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_roles_system
    ON atlas_core.roles (organization_id, is_system)
    WHERE deleted_at IS NULL AND is_system = true;

CREATE TRIGGER trg_roles_set_updated_at
    BEFORE UPDATE ON atlas_core.roles
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.set_updated_at();

SELECT atlas_core.apply_standard_rls('atlas_core', 'roles');

-- ─────────────────────────────────────────────────────────────────────────────
-- Role permissions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE atlas_core.role_permissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    role_id             UUID NOT NULL,
    permission_id       UUID NOT NULL REFERENCES atlas_core.permissions(id),
    effect              atlas_core.permission_effect NOT NULL DEFAULT 'ALLOW',
    conditions          JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_id       UUID REFERENCES atlas_core.users(id),

    CONSTRAINT fk_role_permissions_role_org
        FOREIGN KEY (role_id, organization_id)
        REFERENCES atlas_core.roles (id, organization_id)
);

CREATE UNIQUE INDEX uq_role_permissions_natural
    ON atlas_core.role_permissions (role_id, permission_id);

CREATE INDEX idx_role_permissions_organization_id
    ON atlas_core.role_permissions (organization_id);

CREATE INDEX idx_role_permissions_role_id
    ON atlas_core.role_permissions (role_id);

CREATE INDEX idx_role_permissions_permission_id
    ON atlas_core.role_permissions (permission_id);

SELECT atlas_core.apply_standard_rls('atlas_core', 'role_permissions');

-- ─────────────────────────────────────────────────────────────────────────────
-- Role assignments
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE atlas_core.role_assignments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    role_id             UUID NOT NULL REFERENCES atlas_core.roles(id),
    principal_type      atlas_core.principal_type NOT NULL,
    principal_id        UUID NOT NULL,
    scope_type          atlas_core.scope_type NOT NULL DEFAULT 'ORGANIZATION',
    scope_id            UUID,
    granted_by_id       UUID REFERENCES atlas_core.users(id),
    granted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at          TIMESTAMPTZ,
    revoked_at          TIMESTAMPTZ,
    revoked_by_id       UUID REFERENCES atlas_core.users(id),
    revoke_reason       TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_role_assignments_scope_id
        CHECK (
            (scope_type = 'ORGANIZATION' AND scope_id IS NULL)
            OR (scope_type != 'ORGANIZATION' AND scope_id IS NOT NULL)
        ),
    CONSTRAINT chk_role_assignments_revoked_consistency
        CHECK (
            (is_active = false AND revoked_at IS NOT NULL)
            OR (is_active = true AND revoked_at IS NULL)
        )
);

CREATE INDEX idx_role_assignments_organization_id
    ON atlas_core.role_assignments (organization_id)
    WHERE is_active = true;

CREATE INDEX idx_role_assignments_principal
    ON atlas_core.role_assignments (principal_type, principal_id)
    WHERE is_active = true;

CREATE INDEX idx_role_assignments_scope
    ON atlas_core.role_assignments (scope_type, scope_id)
    WHERE is_active = true;

CREATE INDEX idx_role_assignments_role_id
    ON atlas_core.role_assignments (role_id)
    WHERE is_active = true;

CREATE INDEX idx_role_assignments_expires_at
    ON atlas_core.role_assignments (expires_at)
    WHERE is_active = true AND expires_at IS NOT NULL;

CREATE UNIQUE INDEX uq_role_assignments_active
    ON atlas_core.role_assignments (
        organization_id,
        role_id,
        principal_type,
        principal_id,
        scope_type,
        COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    WHERE is_active = true;

SELECT atlas_core.apply_standard_rls('atlas_core', 'role_assignments');

-- ─────────────────────────────────────────────────────────────────────────────
-- Resource grants
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE atlas_core.resource_grants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    resource_type       TEXT NOT NULL,
    resource_id         UUID NOT NULL,
    principal_type      atlas_core.principal_type NOT NULL,
    principal_id        UUID NOT NULL,
    permission          TEXT NOT NULL,
    effect              atlas_core.permission_effect NOT NULL DEFAULT 'ALLOW',
    granted_by_id       UUID REFERENCES atlas_core.users(id),
    granted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at          TIMESTAMPTZ,
    revoked_at          TIMESTAMPTZ,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_resource_grants_resource_type
        CHECK (resource_type IN (
            'project', 'task', 'document', 'folder', 'contact',
            'deal', 'invoice', 'case', 'channel', 'dashboard'
        )),
    CONSTRAINT chk_resource_grants_permission_format
        CHECK (permission ~ '^[a-z_]+:[a-z_]+:[a-z_]+$')
);

CREATE UNIQUE INDEX uq_resource_grants_natural
    ON atlas_core.resource_grants (
        organization_id,
        resource_type,
        resource_id,
        principal_type,
        principal_id,
        permission
    )
    WHERE deleted_at IS NULL AND is_active = true;

CREATE INDEX idx_resource_grants_organization_id
    ON atlas_core.resource_grants (organization_id)
    WHERE deleted_at IS NULL AND is_active = true;

CREATE INDEX idx_resource_grants_resource
    ON atlas_core.resource_grants (organization_id, resource_type, resource_id)
    WHERE deleted_at IS NULL AND is_active = true;

CREATE INDEX idx_resource_grants_principal
    ON atlas_core.resource_grants (principal_type, principal_id)
    WHERE deleted_at IS NULL AND is_active = true;

CREATE TRIGGER trg_resource_grants_set_updated_at
    BEFORE UPDATE ON atlas_core.resource_grants
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.set_updated_at();

SELECT atlas_core.apply_standard_rls('atlas_core', 'resource_grants');

-- ─────────────────────────────────────────────────────────────────────────────
-- Policies (ABAC)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE atlas_core.policies (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    name                TEXT NOT NULL,
    description         TEXT,
    effect              atlas_core.policy_effect NOT NULL DEFAULT 'DENY',
    priority            INTEGER NOT NULL DEFAULT 0,
    conditions          JSONB NOT NULL DEFAULT '{}',
    rego_source         TEXT,
    rego_version        TEXT NOT NULL DEFAULT 'v1',
    is_system           BOOLEAN NOT NULL DEFAULT false,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by_id       UUID REFERENCES atlas_core.users(id),
    updated_by_id       UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_policies_conditions_is_object
        CHECK (jsonb_typeof(conditions) = 'object'),
    CONSTRAINT chk_policies_has_logic
        CHECK (conditions != '{}' OR rego_source IS NOT NULL)
);

CREATE UNIQUE INDEX uq_policies_org_name_active
    ON atlas_core.policies (organization_id, name)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_policies_organization_id
    ON atlas_core.policies (organization_id)
    WHERE deleted_at IS NULL AND is_active = true;

CREATE INDEX idx_policies_priority
    ON atlas_core.policies (organization_id, priority DESC)
    WHERE deleted_at IS NULL AND is_active = true;

CREATE TRIGGER trg_policies_set_updated_at
    BEFORE UPDATE ON atlas_core.policies
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.set_updated_at();

SELECT atlas_core.apply_standard_rls('atlas_core', 'policies');

-- ─────────────────────────────────────────────────────────────────────────────
-- Policy bindings
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE atlas_core.policy_bindings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    policy_id           UUID NOT NULL REFERENCES atlas_core.policies(id),
    bind_type           atlas_core.policy_bind_type NOT NULL,
    bind_id             UUID,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_id       UUID REFERENCES atlas_core.users(id),

    CONSTRAINT chk_policy_bindings_bind_id
        CHECK (
            (bind_type = 'ORGANIZATION' AND bind_id IS NULL)
            OR (bind_type = 'RESOURCE_TYPE' AND bind_id IS NULL)
            OR (bind_type NOT IN ('ORGANIZATION', 'RESOURCE_TYPE') AND bind_id IS NOT NULL)
        )
);

CREATE UNIQUE INDEX uq_policy_bindings_natural
    ON atlas_core.policy_bindings (
        organization_id,
        policy_id,
        bind_type,
        COALESCE(bind_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    WHERE is_active = true;

CREATE INDEX idx_policy_bindings_organization_id
    ON atlas_core.policy_bindings (organization_id)
    WHERE is_active = true;

CREATE INDEX idx_policy_bindings_policy_id
    ON atlas_core.policy_bindings (policy_id)
    WHERE is_active = true;

CREATE INDEX idx_policy_bindings_bind
    ON atlas_core.policy_bindings (bind_type, bind_id)
    WHERE is_active = true;

SELECT atlas_core.apply_standard_rls('atlas_core', 'policy_bindings');

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: core permissions
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO atlas_core.permissions (code, module, resource, action, description) VALUES
    ('platform:settings:manage', 'platform', 'settings', 'manage', 'Manage organization settings'),
    ('admin:members:invite', 'admin', 'members', 'invite', 'Invite organization members'),
    ('admin:members:remove', 'admin', 'members', 'remove', 'Remove organization members'),
    ('admin:roles:manage', 'admin', 'roles', 'manage', 'Create and assign roles'),
    ('admin:billing:manage', 'admin', 'billing', 'manage', 'Manage billing and subscriptions'),
    ('crm:contacts:read', 'crm', 'contacts', 'read', 'View contacts'),
    ('crm:contacts:write', 'crm', 'contacts', 'write', 'Create and edit contacts'),
    ('crm:contacts:delete', 'crm', 'contacts', 'delete', 'Delete contacts'),
    ('crm:deals:read', 'crm', 'deals', 'read', 'View deals'),
    ('crm:deals:write', 'crm', 'deals', 'write', 'Create and edit deals'),
    ('finance:invoices:read', 'finance', 'invoices', 'read', 'View invoices'),
    ('finance:invoices:write', 'finance', 'invoices', 'write', 'Create and edit invoices'),
    ('finance:invoices:approve', 'finance', 'invoices', 'approve', 'Approve invoices'),
    ('projects:tasks:read', 'projects', 'tasks', 'read', 'View tasks'),
    ('projects:tasks:write', 'projects', 'tasks', 'write', 'Create and edit tasks'),
    ('ai:agents:execute', 'ai', 'agents', 'execute', 'Execute AI agents')
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: system roles per organization
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION atlas_core.seed_system_roles(p_organization_id UUID)
RETURNS void AS $$
DECLARE
    v_owner_id UUID;
    v_admin_id UUID;
    v_member_id UUID;
    v_viewer_id UUID;
BEGIN
    INSERT INTO atlas_core.roles (organization_id, slug, name, is_system, priority, scope_type)
    VALUES (p_organization_id, 'owner', 'Owner', true, 100, 'ORGANIZATION')
    RETURNING id INTO v_owner_id;

    INSERT INTO atlas_core.roles (organization_id, slug, name, is_system, priority, scope_type)
    VALUES (p_organization_id, 'admin', 'Administrator', true, 80, 'ORGANIZATION')
    RETURNING id INTO v_admin_id;

    INSERT INTO atlas_core.roles (organization_id, slug, name, is_system, priority, scope_type, is_default)
    VALUES (p_organization_id, 'member', 'Member', true, 50, 'ORGANIZATION', true)
    RETURNING id INTO v_member_id;

    INSERT INTO atlas_core.roles (organization_id, slug, name, is_system, priority, scope_type)
    VALUES (p_organization_id, 'viewer', 'Viewer', true, 10, 'ORGANIZATION')
    RETURNING id INTO v_viewer_id;

    INSERT INTO atlas_core.role_permissions (organization_id, role_id, permission_id)
    SELECT p_organization_id, v_owner_id, p.id
    FROM atlas_core.permissions p
    WHERE p.is_deprecated = false;

    INSERT INTO atlas_core.role_permissions (organization_id, role_id, permission_id)
    SELECT p_organization_id, v_admin_id, p.id
    FROM atlas_core.permissions p
    WHERE p.is_deprecated = false
      AND p.code != 'admin:billing:manage';

    INSERT INTO atlas_core.role_permissions (organization_id, role_id, permission_id)
    SELECT p_organization_id, v_member_id, p.id
    FROM atlas_core.permissions p
    WHERE p.action IN ('read', 'write')
      AND p.module IN ('crm', 'projects', 'finance')
      AND p.is_deprecated = false;

    INSERT INTO atlas_core.role_permissions (organization_id, role_id, permission_id)
    SELECT p_organization_id, v_viewer_id, p.id
    FROM atlas_core.permissions p
    WHERE p.action = 'read'
      AND p.is_deprecated = false;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE atlas_core.permissions IS 'Global permission catalog. Seeded by migration. Read-only for tenants.';
COMMENT ON TABLE atlas_core.roles IS 'Organization-scoped roles. System roles seeded via atlas_core.seed_system_roles().';