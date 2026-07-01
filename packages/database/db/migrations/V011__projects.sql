-- Atlas BOS — Projects foundation schema
-- Source: docs/database/09-projects.md

CREATE SCHEMA IF NOT EXISTS projects;

CREATE TABLE projects.projects (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    workspace_id        UUID REFERENCES atlas_core.workspaces(id),
    code                TEXT NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    status              TEXT NOT NULL DEFAULT 'planning'
        CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled', 'archived')),
    priority            TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    start_date          DATE,
    target_end_date     DATE,
    progress_percent    NUMERIC(5, 2) NOT NULL DEFAULT 0
        CHECK (progress_percent >= 0 AND progress_percent <= 100),
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID,
    updated_by          UUID,
    deleted_at          TIMESTAMPTZ,
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_projects_org_code_active
    ON projects.projects (organization_id, code) WHERE deleted_at IS NULL;

CREATE INDEX idx_projects_org_status ON projects.projects (organization_id, status) WHERE deleted_at IS NULL;

CREATE TABLE projects.tasks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    project_id          UUID NOT NULL REFERENCES projects.projects(id),
    parent_task_id      UUID REFERENCES projects.tasks(id),
    assignee_id         UUID REFERENCES atlas_core.users(id),
    title               TEXT NOT NULL,
    description         TEXT,
    status              TEXT NOT NULL DEFAULT 'todo'
        CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled')),
    priority            TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    due_date            TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID,
    updated_by          UUID,
    deleted_at          TIMESTAMPTZ,
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_tasks_project ON projects.tasks (organization_id, project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_assignee ON projects.tasks (organization_id, assignee_id, status) WHERE deleted_at IS NULL;