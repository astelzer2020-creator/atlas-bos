-- Atlas BOS — Automation rules schema
-- Source: docs/database/14-automation.md

CREATE TABLE automation.automation_rules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    name                TEXT NOT NULL,
    description         TEXT,
    status              TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'enabled', 'disabled', 'archived')),
    rule_version        INTEGER NOT NULL DEFAULT 1,
    template_id         TEXT,
    owner_id            UUID REFERENCES atlas_core.users(id),
    max_executions_hour INTEGER DEFAULT 100,
    max_executions_day  INTEGER DEFAULT 1000,
    concurrency_limit   INTEGER DEFAULT 5,
    retry_max_attempts  INTEGER DEFAULT 3,
    retry_backoff       TEXT DEFAULT 'exponential'
        CHECK (retry_backoff IN ('fixed', 'exponential', 'linear')),
    dry_run_available   BOOLEAN NOT NULL DEFAULT true,
    last_executed_at    TIMESTAMPTZ,
    execution_count     BIGINT NOT NULL DEFAULT 0,
    tags                TEXT[] NOT NULL DEFAULT '{}',
    settings            JSONB NOT NULL DEFAULT '{}',
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID,
    updated_by          UUID,
    deleted_at          TIMESTAMPTZ,
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_automation_rules_org_name_version_active
    ON automation.automation_rules (organization_id, name, rule_version)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_automation_rules_status
    ON automation.automation_rules (organization_id, status)
    WHERE deleted_at IS NULL;

CREATE TABLE automation.automation_triggers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    rule_id             UUID NOT NULL REFERENCES automation.automation_rules(id),
    trigger_order       INTEGER NOT NULL DEFAULT 0,
    trigger_type        TEXT NOT NULL
        CHECK (trigger_type IN ('event', 'schedule', 'webhook', 'manual', 'entity_change')),
    event_type          TEXT,
    schedule_cron       TEXT,
    schedule_timezone   TEXT DEFAULT 'UTC',
    webhook_path        TEXT,
    filter_expression   TEXT,
    filter_json         JSONB NOT NULL DEFAULT '{}',
    is_active           BOOLEAN NOT NULL DEFAULT true,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID,
    updated_by          UUID,
    deleted_at          TIMESTAMPTZ,
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_automation_triggers_rule
    ON automation.automation_triggers (rule_id, trigger_order)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_automation_triggers_event
    ON automation.automation_triggers (organization_id, event_type)
    WHERE deleted_at IS NULL AND trigger_type = 'event' AND is_active = true;

CREATE TABLE automation.automation_actions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    rule_id             UUID NOT NULL REFERENCES automation.automation_rules(id),
    action_order        INTEGER NOT NULL,
    action_type         TEXT NOT NULL
        CHECK (action_type IN (
            'send_notification', 'send_email', 'update_entity', 'create_entity',
            'webhook_call', 'invoke_agent', 'start_workflow', 'tag_entity',
            'delay', 'condition_branch'
        )),
    name                TEXT NOT NULL,
    config              JSONB NOT NULL DEFAULT '{}',
    condition_expression TEXT,
    on_failure          TEXT NOT NULL DEFAULT 'stop'
        CHECK (on_failure IN ('stop', 'continue', 'retry', 'compensate')),
    timeout_seconds     INTEGER DEFAULT 30,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID,
    updated_by          UUID,
    deleted_at          TIMESTAMPTZ,
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_automation_actions_order_active
    ON automation.automation_actions (rule_id, action_order)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_automation_actions_rule
    ON automation.automation_actions (rule_id, action_order)
    WHERE deleted_at IS NULL;

CREATE TABLE automation.automation_execution_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    rule_id             UUID NOT NULL REFERENCES automation.automation_rules(id),
    status              TEXT NOT NULL DEFAULT 'started'
        CHECK (status IN ('started', 'completed', 'failed', 'skipped', 'dry_run')),
    trigger_type        TEXT,
    trigger_payload     JSONB NOT NULL DEFAULT '{}',
    actions_executed    JSONB NOT NULL DEFAULT '[]',
    error_message       TEXT,
    duration_ms         INTEGER,
    idempotency_key     TEXT,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_execution_log_rule
    ON automation.automation_execution_log (organization_id, rule_id, started_at DESC);

CREATE UNIQUE INDEX uq_automation_execution_idempotency
    ON automation.automation_execution_log (organization_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;