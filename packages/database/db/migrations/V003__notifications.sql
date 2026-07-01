-- Atlas BOS — Notifications schema
-- Source: docs/database/17-notifications.md

CREATE SCHEMA IF NOT EXISTS notifications;

CREATE TYPE notifications.notification_channel_type AS ENUM (
    'email', 'push', 'sms', 'in_app', 'slack', 'teams', 'webhook'
);

CREATE TYPE notifications.notification_template_status AS ENUM ('draft', 'active', 'deprecated');
CREATE TYPE notifications.digest_mode AS ENUM ('instant', 'hourly', 'daily', 'weekly');
CREATE TYPE notifications.notification_category AS ENUM ('transactional', 'operational', 'digest', 'alert', 'marketing');
CREATE TYPE notifications.notification_status AS ENUM ('pending', 'processing', 'delivered', 'partial', 'failed', 'suppressed', 'expired');
CREATE TYPE notifications.notification_actor_type AS ENUM ('user', 'system', 'api_key', 'agent', 'workflow');
CREATE TYPE notifications.notification_delivery_status AS ENUM ('pending', 'queued', 'sent', 'delivered', 'failed', 'suppressed', 'bounced');
CREATE TYPE notifications.digest_frequency AS ENUM ('hourly', 'daily', 'weekly');

CREATE TABLE notifications.notification_channels (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                    CITEXT NOT NULL UNIQUE,
    name                    TEXT NOT NULL,
    description             TEXT,
    channel_type            notifications.notification_channel_type NOT NULL,
    provider                TEXT NOT NULL,
    default_priority        SMALLINT NOT NULL DEFAULT 3 CHECK (default_priority BETWEEN 1 AND 5),
    max_retries             SMALLINT NOT NULL DEFAULT 5,
    retry_backoff_seconds   INTEGER NOT NULL DEFAULT 60,
    rate_limit_per_minute   INTEGER,
    config_schema           JSONB NOT NULL DEFAULT '{}',
    is_active               BOOLEAN NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications.notification_templates (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_id             TEXT NOT NULL,
    notification_channel_id   UUID NOT NULL REFERENCES notifications.notification_channels(id),
    locale                    TEXT NOT NULL DEFAULT 'en-US',
    version                   INTEGER NOT NULL,
    subject_template          TEXT,
    body_template             TEXT NOT NULL,
    mjml_source               TEXT,
    plain_text_template       TEXT,
    variables_schema          JSONB NOT NULL DEFAULT '{}',
    status                    notifications.notification_template_status NOT NULL DEFAULT 'draft',
    activated_at              TIMESTAMPTZ,
    deprecated_at             TIMESTAMPTZ,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by                UUID,
    updated_by                UUID,
    CONSTRAINT uq_notification_templates_def UNIQUE (definition_id, notification_channel_id, locale, version)
);

CREATE TABLE notifications.notification_preferences (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                 UUID NOT NULL,
    user_id                   UUID NOT NULL,
    definition_id             TEXT NOT NULL,
    notification_channel_id   UUID NOT NULL REFERENCES notifications.notification_channels(id),
    enabled                   BOOLEAN NOT NULL DEFAULT true,
    digest_mode               notifications.digest_mode,
    quiet_hours_override      JSONB,
    metadata                  JSONB NOT NULL DEFAULT '{}',
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    version                   INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT uq_notification_preferences UNIQUE (tenant_id, user_id, definition_id, notification_channel_id)
);

CREATE INDEX idx_notification_preferences_user ON notifications.notification_preferences (tenant_id, user_id);

CREATE TABLE notifications.notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    definition_id       TEXT NOT NULL,
    category            notifications.notification_category NOT NULL,
    priority            SMALLINT NOT NULL DEFAULT 3,
    recipient_user_id   UUID NOT NULL,
    actor_user_id       UUID,
    actor_type          notifications.notification_actor_type NOT NULL DEFAULT 'user',
    title               TEXT NOT NULL,
    body                TEXT,
    action_url          TEXT,
    entity_type         TEXT,
    entity_id           UUID,
    payload             JSONB NOT NULL DEFAULT '{}',
    locale              TEXT NOT NULL DEFAULT 'en-US',
    status              notifications.notification_status NOT NULL DEFAULT 'pending',
    idempotency_key     TEXT NOT NULL,
    scheduled_for       TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    read_at             TIMESTAMPTZ,
    dismissed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_notifications_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX idx_notifications_inbox ON notifications.notifications (tenant_id, recipient_user_id, created_at DESC);

CREATE TABLE notifications.notification_deliveries (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL,
    notification_id             UUID NOT NULL REFERENCES notifications.notifications(id),
    notification_channel_id     UUID NOT NULL REFERENCES notifications.notification_channels(id),
    notification_template_id    UUID REFERENCES notifications.notification_templates(id),
    idempotency_key             TEXT NOT NULL UNIQUE,
    status                      notifications.notification_delivery_status NOT NULL DEFAULT 'pending',
    attempt_count               SMALLINT NOT NULL DEFAULT 0,
    provider_message_id         TEXT,
    provider_response           JSONB,
    rendered_snapshot           JSONB,
    error_code                  TEXT,
    error_message               TEXT,
    sent_at                     TIMESTAMPTZ,
    delivered_at                TIMESTAMPTZ,
    opened_at                   TIMESTAMPTZ,
    clicked_at                  TIMESTAMPTZ,
    failed_at                   TIMESTAMPTZ,
    next_retry_at               TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_deliveries_status ON notifications.notification_deliveries (tenant_id, status, created_at DESC);

CREATE TABLE notifications.digest_subscriptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    user_id             UUID NOT NULL,
    definition_id       TEXT NOT NULL,
    digest_frequency    notifications.digest_frequency NOT NULL,
    timezone            TEXT NOT NULL DEFAULT 'UTC',
    delivery_hour       SMALLINT NOT NULL DEFAULT 8,
    delivery_day_of_week SMALLINT,
    last_sent_at        TIMESTAMPTZ,
    next_scheduled_at   TIMESTAMPTZ NOT NULL,
    pending_count       INTEGER NOT NULL DEFAULT 0,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_digest_subscriptions UNIQUE (tenant_id, user_id, definition_id)
);

INSERT INTO notifications.notification_channels (code, name, channel_type, provider) VALUES
    ('in_app_sse', 'In-App Notifications', 'in_app', 'atlas'),
    ('email_sendgrid', 'Email (SendGrid)', 'email', 'sendgrid')
ON CONFLICT (code) DO NOTHING;