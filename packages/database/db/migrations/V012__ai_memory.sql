-- Atlas BOS — AI memory foundation schema (simplified)
-- Source: docs/database/11-ai-memory.md

CREATE SCHEMA IF NOT EXISTS ai_memory;

-- Short-term conversation sessions
CREATE TABLE ai_memory.conversation_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    user_id             UUID REFERENCES atlas_core.users(id),
    agent_run_id        UUID,
    session_type        TEXT NOT NULL DEFAULT 'chat'
        CHECK (session_type IN ('chat', 'agent', 'workflow', 'support')),
    status              TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'summarized', 'archived', 'expired')),
    title               TEXT,
    context_summary     TEXT,
    token_estimate      INTEGER NOT NULL DEFAULT 0,
    turn_count          INTEGER NOT NULL DEFAULT 0,
    metadata            JSONB NOT NULL DEFAULT '{}',
    expires_at          TIMESTAMPTZ NOT NULL,
    last_activity_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID,
    updated_by          UUID,
    deleted_at          TIMESTAMPTZ,
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_conversation_sessions_user
    ON ai_memory.conversation_sessions (organization_id, user_id, last_activity_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_conversation_sessions_agent_run
    ON ai_memory.conversation_sessions (agent_run_id)
    WHERE agent_run_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_conversation_sessions_expires
    ON ai_memory.conversation_sessions (expires_at)
    WHERE deleted_at IS NULL AND status = 'active';

-- Individual conversation turns
CREATE TABLE ai_memory.conversation_messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    session_id          UUID NOT NULL REFERENCES ai_memory.conversation_sessions(id),
    sequence_number     INTEGER NOT NULL,
    role                TEXT NOT NULL
        CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content             TEXT NOT NULL,
    content_type        TEXT NOT NULL DEFAULT 'text'
        CHECK (content_type IN ('text', 'markdown', 'json', 'tool_result')),
    tool_calls          JSONB,
    tool_call_id        TEXT,
    token_count         INTEGER,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_conversation_messages_session_seq
    ON ai_memory.conversation_messages (session_id, sequence_number)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_conversation_messages_session
    ON ai_memory.conversation_messages (session_id, sequence_number)
    WHERE deleted_at IS NULL;

-- Long-term text memory chunks (embedding stub: float8[] for dev)
CREATE TABLE ai_memory.memory_chunks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    source_type         TEXT NOT NULL
        CHECK (source_type IN ('document', 'kb_article', 'email', 'meeting', 'crm_note', 'chat', 'agent_run', 'user_explicit', 'settings')),
    source_id           UUID NOT NULL,
    source_version      INTEGER NOT NULL DEFAULT 1,
    chunk_index         INTEGER NOT NULL DEFAULT 0,
    content_hash        TEXT NOT NULL,
    text_content        TEXT NOT NULL,
    token_count         INTEGER,
    language            TEXT DEFAULT 'en',
    contains_pii        BOOLEAN NOT NULL DEFAULT false,
    importance_score    NUMERIC(5, 4) NOT NULL DEFAULT 0.5
        CHECK (importance_score >= 0 AND importance_score <= 1),
    embedding           FLOAT8[],
    access_policy       JSONB NOT NULL DEFAULT '{}',
    entity_refs         JSONB NOT NULL DEFAULT '[]',
    metadata            JSONB NOT NULL DEFAULT '{}',
    last_accessed_at    TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID,
    updated_by          UUID,
    deleted_at          TIMESTAMPTZ,
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_memory_chunks_source_chunk_active
    ON ai_memory.memory_chunks (organization_id, source_type, source_id, source_version, chunk_index)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_memory_chunks_organization_id
    ON ai_memory.memory_chunks (organization_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_memory_chunks_source
    ON ai_memory.memory_chunks (organization_id, source_type, source_id)
    WHERE deleted_at IS NULL;

-- Knowledge base documents (ingestible source material)
CREATE TABLE ai_memory.knowledge_documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    title               TEXT NOT NULL,
    description         TEXT,
    source_type         TEXT NOT NULL DEFAULT 'upload'
        CHECK (source_type IN ('upload', 'url', 'integration', 'manual')),
    source_uri          TEXT,
    content_type        TEXT NOT NULL DEFAULT 'text/plain',
    raw_content         TEXT,
    status              TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'ready', 'failed', 'archived')),
    chunk_count         INTEGER NOT NULL DEFAULT 0,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID,
    updated_by          UUID,
    deleted_at          TIMESTAMPTZ,
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_knowledge_documents_org_status
    ON ai_memory.knowledge_documents (organization_id, status)
    WHERE deleted_at IS NULL;

-- Knowledge base chunks (paragraph-split document segments)
CREATE TABLE ai_memory.knowledge_chunks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    document_id         UUID NOT NULL REFERENCES ai_memory.knowledge_documents(id),
    chunk_index         INTEGER NOT NULL DEFAULT 0,
    content_hash        TEXT NOT NULL,
    text_content        TEXT NOT NULL,
    token_count         INTEGER,
    embedding           FLOAT8[],
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_knowledge_chunks_document_index_active
    ON ai_memory.knowledge_chunks (document_id, chunk_index)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_knowledge_chunks_document
    ON ai_memory.knowledge_chunks (document_id, chunk_index)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_knowledge_chunks_organization
    ON ai_memory.knowledge_chunks (organization_id)
    WHERE deleted_at IS NULL;