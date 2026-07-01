---
title: Identity and Authentication Schema
document_id: ATLAS-DB-03
version: 1.0.0
status: approved
phase: 3
last_updated: 2026-06-30
authors:
  - Atlas Platform Engineering Team
related_documents:
  - ATLAS-DB-00
  - ATLAS-DB-02
  - ATLAS-ARCH-07
  - 04-authorization.md
tags:
  - identity
  - authentication
  - sessions
  - mfa
  - sso
---

# Identity and Authentication Schema

## Purpose

Define the database schema for Atlas identity and authentication: **Users**, **UserProfiles**, **Sessions**, **RefreshTokens**, **MfaDevices**, **SsoConnections**, **ApiKeys**, and **PasswordResetTokens**. Users are global entities spanning organizations; authentication artifacts may be organization-scoped or user-scoped.

## Bounded Context

**Tenant & Identity** (authentication subdomain) — establishes verified principals consumed by authorization and audit systems.

## Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o| user_profiles : "has (1:0..1)"
    users ||--o{ user_credentials : "authenticates (1:N)"
    users ||--o{ sessions : "has (1:N)"
    sessions ||--o{ refresh_tokens : "issues (1:N)"
    users ||--o{ mfa_devices : "secures (1:N)"
    users ||--o{ password_reset_tokens : "recovers (1:N)"
    organizations ||--o{ sso_connections : "configures (1:N)"
    organizations ||--o{ api_keys : "issues (1:N)"
    users ||--o{ api_keys : "owns (1:N)"

    users {
        uuid id PK
        citext email UK
        boolean email_verified
        text password_hash
        enum status
        timestamptz last_login_at
    }

    user_profiles {
        uuid id PK
        uuid user_id FK UK
        text first_name
        text last_name
        text avatar_url
        jsonb preferences
    }

    sessions {
        uuid id PK
        uuid user_id FK
        uuid organization_id FK
        text ip_address
        timestamptz expires_at
        boolean revoked
    }

    refresh_tokens {
        uuid id PK
        uuid session_id FK
        text token_hash UK
        uuid family_id
        timestamptz expires_at
        boolean revoked
    }

    mfa_devices {
        uuid id PK
        uuid user_id FK
        enum device_type
        text credential_id UK
        boolean is_primary
    }

    sso_connections {
        uuid id PK
        uuid organization_id FK
        enum protocol
        text idp_entity_id UK
        jsonb config
        boolean is_active
    }

    api_keys {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        text key_prefix UK
        text key_hash
        text[] scopes
        timestamptz expires_at
    }
```

---

## Business Rules

| ID | Rule |
|----|------|
| **IA-01** | User `email` is globally unique (case-insensitive via CITEXT) |
| **IA-02** | Password stored as Argon2id hash only; never plaintext |
| **IA-03** | Sessions are organization-contextual (active org in session) |
| **IA-04** | Refresh token rotation: each use issues new token, revokes old |
| **IA-05** | Refresh token family detected on reuse → revoke entire family |
| **IA-06** | MFA required when organization policy `mfa_required = true` |
| **IA-07** | API keys are organization-scoped; hashed at rest (SHA-256) |
| **IA-08** | API key prefix (`atl_live_xxxx`) enables identification without revealing secret |
| **IA-09** | SSO connections are per-organization (enterprise) |
| **IA-10** | Password reset tokens are single-use, 1-hour TTL |
| **IA-11** | Soft delete on users triggers cross-org membership deactivation |
| **IA-12** | Service accounts are users with `type = SERVICE_ACCOUNT` |

---

## DDL: Enums

```sql
-- V020__identity_auth_enums.sql
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

CREATE TYPE atlas_core.credential_type AS ENUM (
    'PASSWORD',
    'GOOGLE_OAUTH',
    'MICROSOFT_OAUTH',
    'APPLE_OAUTH',
    'SAML',
    'OIDC',
    'PASSKEY'
);

CREATE TYPE atlas_core.mfa_device_type AS ENUM (
    'TOTP',
    'WEBAUTHN',
    'SMS',
    'RECOVERY_CODE'
);

CREATE TYPE atlas_core.sso_protocol AS ENUM (
    'SAML_2_0',
    'OIDC'
);

CREATE TYPE atlas_core.api_key_status AS ENUM (
    'ACTIVE',
    'REVOKED',
    'EXPIRED'
);
```

---

## DDL: Users

Users are **global** — not organization-scoped. Membership is via `organization_members`.

```sql
-- V021__create_users.sql
CREATE TABLE atlas_core.users (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                   CITEXT NOT NULL,
    email_verified          BOOLEAN NOT NULL DEFAULT false,
    email_verified_at       TIMESTAMPTZ,
    password_hash           TEXT,           -- NULL for SSO-only users
    type                    atlas_core.user_type NOT NULL DEFAULT 'HUMAN',
    status                  atlas_core.user_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
    display_name            TEXT,
    avatar_url              TEXT,
    locale                  TEXT NOT NULL DEFAULT 'en-US',
    timezone                TEXT NOT NULL DEFAULT 'UTC',
    last_login_at           TIMESTAMPTZ,
    last_login_ip           INET,
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
    CONSTRAINT chk_users_password_or_sso
        CHECK (type != 'HUMAN' OR password_hash IS NOT NULL OR email_verified = true),
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

CREATE INDEX idx_users_last_login_at
    ON atlas_core.users (last_login_at DESC NULLS LAST)
    WHERE deleted_at IS NULL AND status = 'ACTIVE';

CREATE INDEX idx_users_type
    ON atlas_core.users (type)
    WHERE deleted_at IS NULL;

CREATE TRIGGER trg_users_set_updated_at
    BEFORE UPDATE ON atlas_core.users
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.set_updated_at();

-- Account lockout after 10 failed attempts
CREATE OR REPLACE FUNCTION atlas_core.handle_failed_login()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.failed_login_attempts >= 10 AND OLD.failed_login_attempts < 10 THEN
        NEW.locked_until = now() + INTERVAL '30 minutes';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_lockout
    BEFORE UPDATE OF failed_login_attempts ON atlas_core.users
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.handle_failed_login();

COMMENT ON TABLE atlas_core.users IS
    'Global identity. Not organization-scoped. Membership via organization_members.';
```

### Users RLS

Users can read/update their own record; organization admins can read member profiles.

```sql
ALTER TABLE atlas_core.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas_core.users FORCE ROW LEVEL SECURITY;

CREATE POLICY users_select ON atlas_core.users
    FOR SELECT
    USING (
        id = NULLIF(current_setting('app.user_id', true), '')::uuid
        OR id IN (
            SELECT om.user_id FROM atlas_core.organization_members om
            WHERE om.organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
              AND om.status = 'ACTIVE'
              AND om.deleted_at IS NULL
        )
        OR current_setting('app.is_platform_admin', true) = 'true'
    );

CREATE POLICY users_update ON atlas_core.users
    FOR UPDATE
    USING (
        id = NULLIF(current_setting('app.user_id', true), '')::uuid
        OR current_setting('app.is_platform_admin', true) = 'true'
    );
```

---

## DDL: User Profiles

Extended profile data separated from authentication-critical `users` table.

```sql
-- V022__create_user_profiles.sql
CREATE TABLE atlas_core.user_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES atlas_core.users(id),
    first_name          TEXT,
    last_name           TEXT,
    phone               TEXT,
    job_title           TEXT,
    company             TEXT,
    bio                 TEXT,
    avatar_url          TEXT,
    preferences         JSONB NOT NULL DEFAULT '{}',
    notification_settings JSONB NOT NULL DEFAULT '{
        "email": true,
        "push": true,
        "in_app": true
    }',
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by_id       UUID,
    updated_by_id       UUID,
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_user_profiles_preferences_is_object
        CHECK (jsonb_typeof(preferences) = 'object')
);

CREATE UNIQUE INDEX uq_user_profiles_user_id
    ON atlas_core.user_profiles (user_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_user_profiles_name
    ON atlas_core.user_profiles (last_name, first_name)
    WHERE deleted_at IS NULL;

CREATE TRIGGER trg_user_profiles_set_updated_at
    BEFORE UPDATE ON atlas_core.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.set_updated_at();
```

---

## DDL: User Credentials (OAuth / Passkey)

```sql
-- V023__create_user_credentials.sql
CREATE TABLE atlas_core.user_credentials (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES atlas_core.users(id),
    credential_type     atlas_core.credential_type NOT NULL,
    provider_id         TEXT,           -- OAuth sub, SAML NameID, passkey credential
    provider_email      CITEXT,
    credential_data     JSONB NOT NULL DEFAULT '{}',  -- encrypted at app layer
    is_primary          BOOLEAN NOT NULL DEFAULT false,
    last_used_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_user_credentials_provider_id
        CHECK (credential_type = 'PASSWORD' OR provider_id IS NOT NULL)
);

CREATE UNIQUE INDEX uq_user_credentials_provider
    ON atlas_core.user_credentials (credential_type, provider_id)
    WHERE deleted_at IS NULL AND provider_id IS NOT NULL;

CREATE INDEX idx_user_credentials_user_id
    ON atlas_core.user_credentials (user_id)
    WHERE deleted_at IS NULL;

CREATE TRIGGER trg_user_credentials_set_updated_at
    BEFORE UPDATE ON atlas_core.user_credentials
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.set_updated_at();
```

---

## DDL: Sessions

```sql
-- V024__create_sessions.sql
CREATE TABLE atlas_core.sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES atlas_core.users(id),
    organization_id     UUID REFERENCES atlas_core.organizations(id),
    workspace_id        UUID REFERENCES atlas_core.workspaces(id),
    ip_address          INET,
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

CREATE INDEX idx_sessions_last_activity
    ON atlas_core.sessions (last_activity_at)
    WHERE revoked = false;

CREATE TRIGGER trg_sessions_set_updated_at
    BEFORE UPDATE ON atlas_core.sessions
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.set_updated_at();

COMMENT ON TABLE atlas_core.sessions IS
    'Active login sessions. organization_id is the current org context for JWT tid claim.';
```

---

## DDL: Refresh Tokens

```sql
-- V025__create_refresh_tokens.sql
CREATE TABLE atlas_core.refresh_tokens (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID NOT NULL REFERENCES atlas_core.sessions(id),
    user_id             UUID NOT NULL REFERENCES atlas_core.users(id),
    token_hash          TEXT NOT NULL,      -- SHA-256 of raw token
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

-- Token reuse detection: revoke family on used token presented again
CREATE OR REPLACE FUNCTION atlas_core.revoke_refresh_token_family()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.used_at IS NOT NULL AND OLD.used_at IS NOT NULL THEN
        UPDATE atlas_core.refresh_tokens
        SET revoked = true, revoked_at = now(), revoked_reason = 'TOKEN_REUSE_DETECTED'
        WHERE family_id = NEW.family_id AND revoked = false;
        UPDATE atlas_core.sessions
        SET revoked = true, revoked_at = now(), revoked_reason = 'TOKEN_REUSE_DETECTED'
        WHERE id = NEW.session_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_refresh_tokens_reuse_detection
    BEFORE UPDATE OF used_at ON atlas_core.refresh_tokens
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.revoke_refresh_token_family();
```

---

## DDL: MFA Devices

```sql
-- V026__create_mfa_devices.sql
CREATE TABLE atlas_core.mfa_devices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES atlas_core.users(id),
    device_type         atlas_core.mfa_device_type NOT NULL,
    name                TEXT NOT NULL,
    credential_id       TEXT,               -- WebAuthn credential ID (base64)
    secret_encrypted    TEXT,               -- TOTP secret (AES-256-GCM encrypted)
    phone_number        TEXT,               -- SMS only (E.164)
    counter             BIGINT NOT NULL DEFAULT 0,  -- WebAuthn sign counter
    is_primary          BOOLEAN NOT NULL DEFAULT false,
    is_verified         BOOLEAN NOT NULL DEFAULT false,
    verified_at         TIMESTAMPTZ,
    last_used_at        TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_mfa_devices_credential_required
        CHECK (
            device_type NOT IN ('TOTP', 'WEBAUTHN')
            OR (device_type = 'TOTP' AND secret_encrypted IS NOT NULL)
            OR (device_type = 'WEBAUTHN' AND credential_id IS NOT NULL)
        ),
    CONSTRAINT chk_mfa_devices_phone_required
        CHECK (device_type != 'SMS' OR phone_number IS NOT NULL)
);

CREATE UNIQUE INDEX uq_mfa_devices_webauthn_credential
    ON atlas_core.mfa_devices (credential_id)
    WHERE deleted_at IS NULL AND device_type = 'WEBAUTHN';

CREATE INDEX idx_mfa_devices_user_id
    ON atlas_core.mfa_devices (user_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_mfa_devices_user_primary
    ON atlas_core.mfa_devices (user_id)
    WHERE deleted_at IS NULL AND is_primary = true;

CREATE TRIGGER trg_mfa_devices_set_updated_at
    BEFORE UPDATE ON atlas_core.mfa_devices
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.set_updated_at();
```

---

## DDL: SSO Connections

```sql
-- V027__create_sso_connections.sql
CREATE TABLE atlas_core.sso_connections (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID NOT NULL REFERENCES atlas_core.organizations(id),
    protocol                atlas_core.sso_protocol NOT NULL,
    name                    TEXT NOT NULL,
    idp_entity_id           TEXT NOT NULL,
    idp_sso_url             TEXT NOT NULL,
    idp_certificate         TEXT,           -- PEM-encoded X.509
    sp_entity_id            TEXT NOT NULL,
    acs_url                 TEXT NOT NULL,
    oidc_issuer             TEXT,
    oidc_client_id          TEXT,
    oidc_client_secret_enc  TEXT,           -- AES-256-GCM encrypted
    attribute_mapping       JSONB NOT NULL DEFAULT '{
        "email": "email",
        "first_name": "given_name",
        "last_name": "family_name",
        "groups": "groups"
    }',
    jit_provisioning        BOOLEAN NOT NULL DEFAULT true,
    default_role_id         UUID,           -- FK to roles
    mfa_bypass              BOOLEAN NOT NULL DEFAULT false,
    is_active               BOOLEAN NOT NULL DEFAULT true,
    metadata                JSONB NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ,
    created_by_id           UUID,
    updated_by_id           UUID,
    version                 INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_sso_connections_org_idp
    ON atlas_core.sso_connections (organization_id, idp_entity_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_sso_connections_organization_id
    ON atlas_core.sso_connections (organization_id)
    WHERE deleted_at IS NULL AND is_active = true;

CREATE TRIGGER trg_sso_connections_set_updated_at
    BEFORE UPDATE ON atlas_core.sso_connections
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.set_updated_at();

SELECT atlas_core.apply_standard_rls('atlas_core', 'sso_connections');
```

---

## DDL: API Keys

```sql
-- V028__create_api_keys.sql
CREATE TABLE atlas_core.api_keys (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    user_id             UUID NOT NULL REFERENCES atlas_core.users(id),
    name                TEXT NOT NULL,
    description         TEXT,
    key_prefix          TEXT NOT NULL,      -- e.g., atl_live_a1b2c3d4
    key_hash            TEXT NOT NULL,      -- SHA-256 of full key
    scopes              TEXT[] NOT NULL DEFAULT '{}',
    status              atlas_core.api_key_status NOT NULL DEFAULT 'ACTIVE',
    expires_at          TIMESTAMPTZ,
    last_used_at        TIMESTAMPTZ,
    last_used_ip        INET,
    rate_limit_tier     TEXT NOT NULL DEFAULT 'standard',
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by_id       UUID,
    updated_by_id       UUID,
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_api_keys_prefix_format
        CHECK (key_prefix ~ '^atl_(live|test)_[a-f0-9]{8}$'),
    CONSTRAINT chk_api_keys_hash_length
        CHECK (length(key_hash) = 64),
    CONSTRAINT chk_api_keys_scopes_not_empty
        CHECK (array_length(scopes, 1) > 0)
);

CREATE UNIQUE INDEX uq_api_keys_prefix
    ON atlas_core.api_keys (key_prefix)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_api_keys_organization_id
    ON atlas_core.api_keys (organization_id)
    WHERE deleted_at IS NULL AND status = 'ACTIVE';

CREATE INDEX idx_api_keys_user_id
    ON atlas_core.api_keys (user_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_api_keys_hash
    ON atlas_core.api_keys (key_hash)
    WHERE deleted_at IS NULL AND status = 'ACTIVE';

CREATE TRIGGER trg_api_keys_set_updated_at
    BEFORE UPDATE ON atlas_core.api_keys
    FOR EACH ROW
    EXECUTE FUNCTION atlas_core.set_updated_at();

SELECT atlas_core.apply_standard_rls('atlas_core', 'api_keys');
```

---

## DDL: Password Reset Tokens

```sql
-- V029__create_password_reset_tokens.sql
CREATE TABLE atlas_core.password_reset_tokens (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES atlas_core.users(id),
    token_hash          TEXT NOT NULL,
    expires_at          TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
    used_at             TIMESTAMPTZ,
    ip_address          INET,
    user_agent          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_password_reset_hash_length
        CHECK (length(token_hash) = 64),
    CONSTRAINT chk_password_reset_single_use
        CHECK (used_at IS NULL OR used_at >= created_at)
);

CREATE UNIQUE INDEX uq_password_reset_token_hash
    ON atlas_core.password_reset_tokens (token_hash);

CREATE INDEX idx_password_reset_user_id
    ON atlas_core.password_reset_tokens (user_id)
    WHERE used_at IS NULL;

CREATE INDEX idx_password_reset_expires_at
    ON atlas_core.password_reset_tokens (expires_at)
    WHERE used_at IS NULL;

-- No soft delete; purge expired tokens after 24 hours
COMMENT ON TABLE atlas_core.password_reset_tokens IS
    'Single-use, short-lived tokens. Hard-deleted by retention job.';
```

---

## Deferred Foreign Keys

After all tables exist:

```sql
-- V030__identity_auth_foreign_keys.sql
ALTER TABLE atlas_core.workspaces
    ADD CONSTRAINT fk_workspaces_owner_user
    FOREIGN KEY (owner_user_id) REFERENCES atlas_core.users(id);

ALTER TABLE atlas_core.workspace_members
    ADD CONSTRAINT fk_workspace_members_user
    FOREIGN KEY (user_id) REFERENCES atlas_core.users(id);

ALTER TABLE atlas_core.organization_members
    ADD CONSTRAINT fk_organization_members_user
    FOREIGN KEY (user_id) REFERENCES atlas_core.users(id);

ALTER TABLE atlas_core.team_members
    ADD CONSTRAINT fk_team_members_user
    FOREIGN KEY (user_id) REFERENCES atlas_core.users(id);

ALTER TABLE atlas_core.invitations
    ADD CONSTRAINT fk_invitations_invited_user
    FOREIGN KEY (invited_user_id) REFERENCES atlas_core.users(id);

ALTER TABLE atlas_core.invitations
    ADD CONSTRAINT fk_invitations_invited_by
    FOREIGN KEY (invited_by_id) REFERENCES atlas_core.users(id);
```

---

## JWT Claims Mapping

| JWT Claim | Source Column | Description |
|-----------|---------------|-------------|
| `sub` | `users.id` | Subject (user ID) |
| `tid` | `sessions.organization_id` | Active organization (RLS key) |
| `wid` | `sessions.workspace_id` | Active workspace |
| `sid` | `sessions.id` | Session ID for revocation |
| `email` | `users.email` | Verified email |
| `mfa` | `sessions.mfa_verified` | MFA completed this session |
| `type` | `users.type` | HUMAN, SERVICE_ACCOUNT, AGENT |

---

## Security Summary

| Asset | Storage | TTL |
|-------|---------|-----|
| Password | Argon2id hash in `users.password_hash` | Until changed |
| Refresh token | SHA-256 hash in `refresh_tokens.token_hash` | 30 days (configurable) |
| API key | SHA-256 hash; prefix for lookup | Optional expiry |
| MFA TOTP secret | AES-256-GCM in `mfa_devices.secret_encrypted` | Until removed |
| SSO client secret | AES-256-GCM in `sso_connections.oidc_client_secret_enc` | Until rotated |
| Reset token | SHA-256 hash | 1 hour |

---

## Cross-References

| Document | Content |
|----------|---------|
| [02-platform-core.md](02-platform-core.md) | Organization membership |
| [04-authorization.md](04-authorization.md) | API key scopes, SSO role mapping |
| [07-authentication.md](../architecture/phase-1/07-authentication.md) | Auth flows |
| [prisma/models/platform.prisma](../../prisma/models/platform.prisma) | Prisma models |

---

*Document owner: Identity Team · Review cadence: Per release*