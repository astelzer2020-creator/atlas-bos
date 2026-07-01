-- Atlas BOS — Audit & events schema
-- Source: docs/database/20-audit-events.md

CREATE SCHEMA IF NOT EXISTS atlas_audit;

CREATE TYPE atlas_audit.audit_action AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'ACCESS', 'EXPORT', 'PERMISSION_CHANGE');
CREATE TYPE atlas_audit.audit_actor_type AS ENUM ('user', 'system', 'api_key', 'agent', 'workflow', 'platform_admin');
CREATE TYPE atlas_audit.dead_letter_source AS ENUM ('event_outbox', 'domain_events', 'webhook_delivery');
CREATE TYPE atlas_audit.dead_letter_resolution AS ENUM ('replayed', 'discarded', 'manual_fix');

CREATE TABLE atlas_audit.audit_log_entries (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       UUID,
    entity_type     TEXT NOT NULL,
    entity_id       UUID NOT NULL,
    action          atlas_audit.audit_action NOT NULL,
    actor_id        UUID,
    actor_type      atlas_audit.audit_actor_type NOT NULL DEFAULT 'user',
    changes         JSONB,
    previous_state  JSONB,
    new_state       JSONB,
    metadata        JSONB NOT NULL DEFAULT '{}',
    correlation_id  TEXT,
    request_id      TEXT,
    ip_address      INET,
    user_agent      TEXT,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_tenant_entity ON atlas_audit.audit_log_entries (tenant_id, entity_type, entity_id, occurred_at DESC);
CREATE INDEX idx_audit_log_actor ON atlas_audit.audit_log_entries (tenant_id, actor_id, occurred_at DESC);
CREATE INDEX idx_audit_log_correlation ON atlas_audit.audit_log_entries (correlation_id);

CREATE TABLE atlas_audit.domain_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID,
    event_type      TEXT NOT NULL,
    event_version   INTEGER NOT NULL DEFAULT 1,
    aggregate_type  TEXT NOT NULL,
    aggregate_id    UUID NOT NULL,
    payload         JSONB NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    correlation_id  TEXT,
    causation_id    TEXT,
    actor_id        UUID,
    actor_type      atlas_audit.audit_actor_type NOT NULL DEFAULT 'system',
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    sequence_number BIGSERIAL NOT NULL
);

CREATE INDEX idx_domain_events_aggregate ON atlas_audit.domain_events (tenant_id, aggregate_type, aggregate_id, occurred_at DESC);

CREATE TABLE atlas_audit.event_outbox (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID,
    aggregate_type    TEXT NOT NULL,
    aggregate_id      UUID NOT NULL,
    event_type        TEXT NOT NULL,
    event_version     INTEGER NOT NULL DEFAULT 1,
    payload           JSONB NOT NULL,
    metadata          JSONB NOT NULL DEFAULT '{}',
    correlation_id    TEXT,
    causation_id      TEXT,
    priority          SMALLINT NOT NULL DEFAULT 3,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at      TIMESTAMPTZ,
    publish_attempts  INTEGER NOT NULL DEFAULT 0,
    last_attempt_at   TIMESTAMPTZ,
    last_error        TEXT,
    locked_by         TEXT,
    locked_at         TIMESTAMPTZ
);

CREATE INDEX idx_event_outbox_unpublished ON atlas_audit.event_outbox (created_at) WHERE published_at IS NULL;

CREATE TABLE atlas_audit.event_dead_letter (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID,
    source_table        atlas_audit.dead_letter_source NOT NULL,
    source_id           UUID NOT NULL,
    event_type          TEXT NOT NULL,
    payload             JSONB NOT NULL,
    metadata            JSONB NOT NULL DEFAULT '{}',
    failure_reason      TEXT NOT NULL,
    failure_count       INTEGER NOT NULL DEFAULT 1,
    first_failed_at     TIMESTAMPTZ NOT NULL,
    last_failed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at         TIMESTAMPTZ,
    resolved_by         UUID,
    resolution_action   atlas_audit.dead_letter_resolution,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE atlas_audit.entity_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    entity_type     TEXT NOT NULL,
    entity_id       UUID NOT NULL,
    version_number  INTEGER NOT NULL,
    valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_to        TIMESTAMPTZ NOT NULL DEFAULT 'infinity',
    state           JSONB NOT NULL,
    change_reason   TEXT,
    changed_by      UUID,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_current      BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_entity_versions_temporal ON atlas_audit.entity_versions (tenant_id, entity_type, entity_id, valid_from DESC);