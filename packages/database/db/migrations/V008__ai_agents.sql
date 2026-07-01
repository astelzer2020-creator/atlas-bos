-- Atlas BOS — AI agents foundation schema
-- Source: docs/database/12-ai-agents.md

CREATE SCHEMA IF NOT EXISTS ai_agents;

CREATE TABLE ai_agents.agent_definitions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES atlas_core.organizations(id),
    name                TEXT NOT NULL,
    slug                TEXT NOT NULL,
    description         TEXT,
    role                TEXT NOT NULL DEFAULT 'custom'
        CHECK (role IN ('analyst', 'executor', 'reviewer', 'planner', 'custom')),
    definition_version  INTEGER NOT NULL DEFAULT 1,
    status              TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'deprecated', 'archived')),
    model_id            TEXT NOT NULL DEFAULT 'claude-sonnet-4',
    system_prompt       TEXT NOT NULL DEFAULT 'You are a helpful Atlas assistant.',
    allowed_tools       TEXT[] NOT NULL DEFAULT '{}',
    constraints         JSONB NOT NULL DEFAULT '{}',
    metadata            JSONB NOT NULL DEFAULT '{}',
    published_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID,
    updated_by          UUID,
    deleted_at          TIMESTAMPTZ,
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_agent_definitions_org_slug_version_active
    ON ai_agents.agent_definitions (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), slug, definition_version)
    WHERE deleted_at IS NULL;

CREATE TABLE ai_agents.agent_tools (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES atlas_core.organizations(id),
    tool_key            TEXT NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    risk_level          TEXT NOT NULL DEFAULT 'low'
        CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    handler_type        TEXT NOT NULL DEFAULT 'internal',
    config              JSONB NOT NULL DEFAULT '{}',
    is_active           BOOLEAN NOT NULL DEFAULT true,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_agent_tools_key_active
    ON ai_agents.agent_tools (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), tool_key)
    WHERE deleted_at IS NULL;

CREATE TABLE ai_agents.agent_runs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID NOT NULL REFERENCES atlas_core.organizations(id),
    agent_definition_id     UUID NOT NULL REFERENCES ai_agents.agent_definitions(id),
    definition_version      INTEGER NOT NULL,
    invoker_type            TEXT NOT NULL DEFAULT 'user'
        CHECK (invoker_type IN ('user', 'workflow', 'automation', 'schedule', 'system')),
    invoker_id              UUID,
    goal                    TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'init'
        CHECK (status IN ('init', 'planning', 'executing', 'awaiting_human', 'completed', 'failed', 'terminated', 'cancelled')),
    status_reason           TEXT,
    budget_cents            INTEGER NOT NULL DEFAULT 50,
    cost_cents              INTEGER NOT NULL DEFAULT 0,
    result_summary          TEXT,
    result_payload          JSONB,
    error_details           JSONB,
    started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at            TIMESTAMPTZ,
    metadata                JSONB NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by              UUID,
    updated_by              UUID,
    deleted_at              TIMESTAMPTZ,
    version                 INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_agent_runs_org_status
    ON ai_agents.agent_runs (organization_id, status, started_at DESC)
    WHERE deleted_at IS NULL;