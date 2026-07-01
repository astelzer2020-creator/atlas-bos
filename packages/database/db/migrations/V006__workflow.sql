-- Atlas BOS — Workflow engine schema
-- Source: docs/database/14-automation.md (workflow tables)

CREATE SCHEMA IF NOT EXISTS automation;

CREATE TABLE automation.workflow_definitions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID REFERENCES atlas_core.organizations(id),
    name                    TEXT NOT NULL,
    slug                    TEXT NOT NULL,
    description             TEXT,
    definition_version      INTEGER NOT NULL DEFAULT 1,
    status                  TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'deprecated', 'archived')),
    category                TEXT NOT NULL DEFAULT 'general',
    graph_definition        JSONB NOT NULL DEFAULT '{}',
    sla_policies            JSONB NOT NULL DEFAULT '{}',
    compensation_handlers   JSONB NOT NULL DEFAULT '{}',
    input_schema            JSONB NOT NULL DEFAULT '{}',
    output_schema           JSONB NOT NULL DEFAULT '{}',
    estimated_duration_hours INTEGER,
    is_template             BOOLEAN NOT NULL DEFAULT false,
    published_at            TIMESTAMPTZ,
    deprecated_at           TIMESTAMPTZ,
    metadata                JSONB NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by              UUID,
    updated_by              UUID,
    deleted_at              TIMESTAMPTZ,
    version                 INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_workflow_definitions_slug_version_active
    ON automation.workflow_definitions (
        COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
        slug,
        definition_version
    )
    WHERE deleted_at IS NULL;

CREATE INDEX idx_workflow_definitions_status
    ON automation.workflow_definitions (status, category)
    WHERE deleted_at IS NULL AND status = 'published';

CREATE TABLE automation.workflow_instances (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID NOT NULL REFERENCES atlas_core.organizations(id),
    definition_id           UUID NOT NULL REFERENCES automation.workflow_definitions(id),
    definition_version      INTEGER NOT NULL,
    parent_instance_id      UUID REFERENCES automation.workflow_instances(id),
    status                  TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'waiting', 'completed', 'failed', 'cancelled', 'compensating', 'suspended')),
    entity_type             TEXT,
    entity_id               UUID,
    correlation_id          TEXT,
    initiator_type          TEXT NOT NULL DEFAULT 'user'
        CHECK (initiator_type IN ('user', 'automation', 'agent', 'system', 'api')),
    initiator_id            UUID,
    current_node_id         TEXT,
    context_variables       JSONB NOT NULL DEFAULT '{}',
    input_payload           JSONB NOT NULL DEFAULT '{}',
    output_payload          JSONB,
    error_details           JSONB,
    started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at            TIMESTAMPTZ,
    due_at                  TIMESTAMPTZ,
    sla_breach_at           TIMESTAMPTZ,
    token_count             INTEGER NOT NULL DEFAULT 1,
    metadata                JSONB NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by              UUID,
    updated_by              UUID,
    deleted_at              TIMESTAMPTZ,
    version                 INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_workflow_instances_org_status
    ON automation.workflow_instances (organization_id, status, started_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_workflow_instances_entity
    ON automation.workflow_instances (organization_id, entity_type, entity_id)
    WHERE entity_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_workflow_instances_correlation
    ON automation.workflow_instances (organization_id, correlation_id)
    WHERE correlation_id IS NOT NULL;

CREATE INDEX idx_workflow_instances_sla
    ON automation.workflow_instances (due_at)
    WHERE deleted_at IS NULL AND status IN ('running', 'waiting');

CREATE TABLE automation.workflow_steps (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    instance_id         UUID NOT NULL REFERENCES automation.workflow_instances(id),
    node_id             TEXT NOT NULL,
    node_type           TEXT NOT NULL
        CHECK (node_type IN (
            'start_event', 'end_event', 'exclusive_gateway', 'parallel_gateway',
            'inclusive_gateway', 'human_task', 'service_task', 'agent_task',
            'timer_event', 'sub_workflow', 'compensation_handler'
        )),
    step_name           TEXT,
    status              TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'waiting', 'completed', 'failed', 'skipped', 'compensated')),
    assignee_id         UUID REFERENCES atlas_core.users(id),
    assignee_type       TEXT
        CHECK (assignee_type IS NULL OR assignee_type IN ('user', 'role', 'team', 'agent')),
    token_id            TEXT NOT NULL,
    input_data          JSONB NOT NULL DEFAULT '{}',
    output_data         JSONB,
    agent_run_id        UUID,
    error_message       TEXT,
    retry_count         INTEGER NOT NULL DEFAULT 0,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    due_at              TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID,
    updated_by          UUID,
    deleted_at          TIMESTAMPTZ,
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_workflow_steps_instance
    ON automation.workflow_steps (instance_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_workflow_steps_assignee
    ON automation.workflow_steps (organization_id, assignee_id, status)
    WHERE deleted_at IS NULL AND status IN ('active', 'waiting');

CREATE INDEX idx_workflow_steps_due
    ON automation.workflow_steps (due_at)
    WHERE deleted_at IS NULL AND status IN ('active', 'waiting');

CREATE TABLE automation.workflow_approvals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    instance_id         UUID NOT NULL REFERENCES automation.workflow_instances(id),
    step_id             UUID NOT NULL REFERENCES automation.workflow_steps(id),
    approval_type       TEXT NOT NULL DEFAULT 'single'
        CHECK (approval_type IN ('single', 'any_of', 'all_of', 'sequential')),
    status              TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'delegated', 'cancelled')),
    title               TEXT NOT NULL,
    description         TEXT,
    assignee_ids        UUID[] NOT NULL DEFAULT '{}',
    approved_by         UUID REFERENCES atlas_core.users(id),
    rejected_by         UUID REFERENCES atlas_core.users(id),
    form_data           JSONB NOT NULL DEFAULT '{}',
    diff_preview        JSONB,
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at          TIMESTAMPTZ,
    resolved_at         TIMESTAMPTZ,
    resolution_note     TEXT,
    escalation_level    INTEGER NOT NULL DEFAULT 0,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID,
    updated_by          UUID,
    deleted_at          TIMESTAMPTZ,
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_workflow_approvals_pending
    ON automation.workflow_approvals (organization_id, status, requested_at)
    WHERE deleted_at IS NULL AND status = 'pending';

CREATE INDEX idx_workflow_approvals_instance
    ON automation.workflow_approvals (instance_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_workflow_approvals_assignees
    ON automation.workflow_approvals USING GIN (assignee_ids)
    WHERE deleted_at IS NULL AND status = 'pending';