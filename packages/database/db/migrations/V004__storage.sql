-- Atlas BOS — Storage schema
-- Source: docs/database/18-documents-storage.md

CREATE SCHEMA IF NOT EXISTS storage;

CREATE TYPE storage.file_status AS ENUM ('pending', 'uploading', 'scanning', 'clean', 'infected', 'quarantined', 'rejected', 'deleted');
CREATE TYPE storage.sensitivity_class AS ENUM ('public', 'standard', 'restricted', 'confidential');
CREATE TYPE storage.file_permission_grantee_type AS ENUM ('user', 'team', 'role', 'workspace');
CREATE TYPE storage.file_permission_level AS ENUM ('read', 'write', 'delete', 'share', 'admin');
CREATE TYPE storage.preview_type AS ENUM ('thumbnail_sm', 'thumbnail_md', 'thumbnail_lg', 'pdf_preview', 'video_poster');
CREATE TYPE storage.preview_status AS ENUM ('pending', 'processing', 'ready', 'failed', 'skipped');
CREATE TYPE storage.attachment_role AS ENUM ('primary', 'supporting', 'signature', 'export', 'cover', 'inline');

CREATE TABLE storage.folders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    workspace_id        UUID,
    parent_folder_id    UUID REFERENCES storage.folders(id),
    name                TEXT NOT NULL,
    slug                TEXT NOT NULL,
    path                TEXT NOT NULL,
    depth               SMALLINT NOT NULL DEFAULT 0,
    description         TEXT,
    color               CHAR(7),
    is_system           BOOLEAN NOT NULL DEFAULT false,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID NOT NULL,
    updated_by          UUID,
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_folders_tenant ON storage.folders (tenant_id, workspace_id) WHERE deleted_at IS NULL;

CREATE TABLE storage.files (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    folder_id               UUID REFERENCES storage.folders(id),
    name                    TEXT NOT NULL,
    original_name           TEXT NOT NULL,
    mime_type               TEXT NOT NULL,
    extension               TEXT,
    size_bytes              BIGINT NOT NULL DEFAULT 0,
    content_hash            BYTEA NOT NULL DEFAULT '\x',
    bucket                  TEXT NOT NULL,
    object_key              TEXT NOT NULL,
    encryption_key_id       TEXT NOT NULL DEFAULT 'local',
    status                  storage.file_status NOT NULL DEFAULT 'pending',
    current_version_number  INTEGER NOT NULL DEFAULT 1,
    is_starred              BOOLEAN NOT NULL DEFAULT false,
    sensitivity_class       storage.sensitivity_class NOT NULL DEFAULT 'standard',
    legal_hold              BOOLEAN NOT NULL DEFAULT false,
    retention_until         TIMESTAMPTZ,
    scanned_at              TIMESTAMPTZ,
    scan_result             TEXT,
    metadata                JSONB NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ,
    created_by              UUID NOT NULL,
    updated_by              UUID,
    version                 INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_files_tenant_folder ON storage.files (tenant_id, folder_id) WHERE deleted_at IS NULL;

CREATE TABLE storage.file_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    file_id         UUID NOT NULL REFERENCES storage.files(id),
    version_number  INTEGER NOT NULL,
    size_bytes      BIGINT NOT NULL,
    content_hash    BYTEA NOT NULL,
    bucket          TEXT NOT NULL,
    object_key      TEXT NOT NULL,
    is_latest       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID NOT NULL,
    CONSTRAINT uq_file_versions UNIQUE (file_id, version_number)
);

CREATE TABLE storage.file_permissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    file_id         UUID NOT NULL REFERENCES storage.files(id),
    grantee_type    storage.file_permission_grantee_type NOT NULL,
    grantee_id      UUID NOT NULL,
    permission      storage.file_permission_level NOT NULL,
    granted_by      UUID NOT NULL,
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE storage.storage_quotas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL UNIQUE,
    quota_bytes         BIGINT NOT NULL DEFAULT 10737418240,
    used_bytes          BIGINT NOT NULL DEFAULT 0,
    file_count          INTEGER NOT NULL DEFAULT 0,
    warning_threshold   NUMERIC(3,2) NOT NULL DEFAULT 0.80,
    hard_limit          BOOLEAN NOT NULL DEFAULT true,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE storage.file_previews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    file_id         UUID NOT NULL REFERENCES storage.files(id),
    preview_type    storage.preview_type NOT NULL,
    status          storage.preview_status NOT NULL DEFAULT 'pending',
    bucket          TEXT,
    object_key      TEXT,
    width           INTEGER,
    height          INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE storage.file_attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    file_id         UUID NOT NULL REFERENCES storage.files(id),
    entity_type     TEXT NOT NULL,
    entity_id       UUID NOT NULL,
    role            storage.attachment_role NOT NULL DEFAULT 'primary',
    display_order   INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID NOT NULL,
    CONSTRAINT uq_file_attachments UNIQUE (tenant_id, file_id, entity_type, entity_id)
);