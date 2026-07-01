---
title: Authentication
version: 1.0.0
status: draft
phase: 1
last_updated: 2026-06-30
authors:
  - Atlas Architecture Team
related_documents:
  - 02-software-architecture.md
  - 06-api-architecture.md
  - 08-authorization.md
  - 21-security.md
adr_references:
  - ADR-0007
  - ADR-0015
  - ADR-0022
---

# Authentication

## Purpose

Define how Atlas verifies the identity of human users, service accounts, and integrated applications. Authentication establishes *who* is making a request; authorization (see `08-authorization.md`) determines *what* they may do. This document covers identity providers, session management, MFA, enterprise SSO, device trust, password policies, account recovery, and service-to-service authentication.

## Scope

### In Scope

- Identity providers (email/password, Google, Microsoft, SAML, OIDC)
- Session management (JWT + refresh tokens, httpOnly cookies)
- Multi-factor authentication (TOTP, WebAuthn/passkeys, SMS backup)
- Enterprise SSO (SAML 2.0, OIDC federation)
- Device trust and session policies
- Password policies and breach detection (HaveIBeenPwned)
- Account recovery flows
- Service-to-service authentication (mTLS, service accounts)
- Token lifecycle, rotation, and revocation

### Out of Scope

- Authorization and permission models (`08-authorization.md`)
- API rate limiting (`06-api-architecture.md`)
- User profile and identity data schema (Phase 3 — Database Design)
- UI flows for login/signup (Phase 4 — UI Specification)
- Compliance audit procedures (`21-security.md`)

## Context

Atlas serves millions of organizations ranging from solo founders to Fortune 500 enterprises. Authentication must:

1. Support **self-serve signup** with email/password and social login
2. Support **enterprise SSO** with SAML and OIDC for IT-managed identity
3. Enforce **strong MFA** without degrading UX (passkeys preferred)
4. Provide **session security** resistant to XSS, CSRF, and token theft
5. Enable **service-to-service** authentication for internal microservices and AI agents
6. Meet compliance requirements (SOC 2, GDPR, HIPAA-ready)

### Threat Model Summary

| Threat | Mitigation |
|--------|------------|
| Credential stuffing | Rate limiting, breach detection, MFA |
| Session hijacking | httpOnly cookies, short-lived JWTs, device binding |
| XSS token theft | No tokens in localStorage; httpOnly + Secure cookies |
| CSRF | SameSite cookies + CSRF tokens for state-changing ops |
| Phishing | Passkeys (origin-bound), WebAuthn |
| Insider service impersonation | mTLS + service JWT with short TTL |
| Account takeover | MFA, recovery verification, anomaly detection |

---

## Detailed Design

### 1. Authentication Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Identity Providers                               │
├──────────┬──────────┬──────────┬──────────┬──────────┬────────────────┤
│  Email/  │  Google  │ Microsoft│  SAML    │  OIDC    │  Passkeys      │
│  Password│  OAuth   │  OAuth   │  2.0     │  Generic │  (WebAuthn)    │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┴───────┬────────┘
     │          │          │          │          │             │
     └──────────┴──────────┴──────────┴──────────┘             │
                              │                               │
                    ┌─────────▼─────────┐                     │
                    │  Identity Service │◀────────────────────┘
                    │  (Auth Core)      │
                    │  - Credential store│
                    │  - MFA engine    │
                    │  - Session mgr   │
                    │  - SSO broker    │
                    └─────────┬─────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │  Web App    │    │  API Gateway│    │  Internal   │
   │  (Next.js)  │    │  (Kong)     │    │  Services   │
   │  httpOnly   │    │  JWT valid. │    │  mTLS + Svc │
   │  cookies    │    │             │    │  JWT        │
   └─────────────┘    └─────────────┘    └─────────────┘
```

---

### 2. Identity Providers

#### 2.1 Provider Matrix

| Provider | Protocol | Audience | Phase |
|----------|----------|----------|-------|
| Email + password | Local credentials | All users | 1 |
| Google | OAuth 2.0 / OIDC | All users | 1 |
| Microsoft (Entra ID) | OAuth 2.0 / OIDC | Business users | 1 |
| Apple | OAuth 2.0 / OIDC | Mobile users | 2 |
| SAML 2.0 | SAML | Enterprise SSO | 1 |
| Generic OIDC | OIDC | Enterprise/custom IdP | 1 |
| Passkeys | WebAuthn / FIDO2 | All users (preferred) | 1 |
| Service accounts | Client credentials | Integrations, agents | 1 |

#### 2.2 Email + Password Registration

```
User submits email + password
    │
    ▼
Validate password policy (see §7)
    │
    ▼
Check email uniqueness (per tenant or global — TBD)
    │
    ▼
Hash password (Argon2id)
    │
    ▼
Send verification email (magic link, 24h TTL)
    │
    ▼
User clicks link → email_verified = true
    │
    ▼
Create session → redirect to onboarding
```

**Password hashing:** Argon2id with parameters:
- Memory: 64 MB
- Iterations: 3
- Parallelism: 4
- Salt: 16 bytes random per password

#### 2.3 Social Login (Google, Microsoft)

**Flow:** Authorization Code + PKCE (OAuth 2.0)

```
┌────────┐                              ┌──────────────┐
│ Client │                              │ Atlas Auth   │
└───┬────┘                              └──────┬───────┘
    │  1. GET /auth/google (PKCE challenge)    │
    │─────────────────────────────────────────▶│
    │  2. Redirect to Google consent           │
    │◀─────────────────────────────────────────│
    │  3. User authenticates at Google         │
    │─────────────────────────────────────────▶│ (Google)
    │  4. Callback with auth code              │
    │◀─────────────────────────────────────────│
    │  5. Exchange code + PKCE verifier        │
    │─────────────────────────────────────────▶│
    │  6. Create/link Atlas account            │
    │  7. Issue session tokens                 │
    │◀─────────────────────────────────────────│
```

**Account linking rules:**
- Same verified email → auto-link to existing account (with confirmation if password exists)
- Different email → create new account or prompt to link
- Social-only accounts have no password until user sets one

#### 2.4 Enterprise SAML 2.0 SSO

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Employee │────▶│ Atlas SSO   │────▶│ Customer IdP │────▶│ Atlas Auth  │
│ Browser  │     │ Entry (/sso)│     │ (Okta, etc.) │     │ (SAML SP)   │
└──────────┘     └─────────────┘     └──────────────┘     └─────────────┘
```

**SAML SP configuration per tenant:**
- Unique ACS URL: `https://auth.atlas.example.com/saml/{tenant_slug}/acs`
- Metadata endpoint: `https://auth.atlas.example.com/saml/{tenant_slug}/metadata`
- Signed assertions required
- Attribute mapping: `email`, `first_name`, `last_name`, `groups` (for RBAC sync)

**JIT provisioning:** Users created on first SAML login if `sso_jit_provisioning` enabled.

#### 2.5 Generic OIDC Federation

For enterprises preferring OIDC over SAML:

```
Tenant admin configures:
  - issuer_url
  - client_id / client_secret
  - scopes: openid, email, profile
  - claim mappings
```

Atlas acts as OIDC Relying Party. Supports PKCE for public clients.

---

### 3. Session Management

#### 3.1 Token Architecture

Atlas uses a **dual-token model**:

| Token | Type | Lifetime | Storage | Purpose |
|-------|------|----------|---------|---------|
| **Access token** | JWT | 15 minutes | httpOnly cookie (web) / memory (mobile) | API authorization |
| **Refresh token** | Opaque | 30 days (rolling) | httpOnly cookie (web) / secure storage (mobile) | Obtain new access tokens |
| **Session ID** | Opaque | Session lifetime | Server-side (Redis + PostgreSQL) | Revocation, device tracking |

#### 3.2 JWT Access Token Claims

```json
{
  "sub": "user_uuid",
  "tid": "tenant_uuid",
  "sid": "session_uuid",
  "email": "user@example.com",
  "mfa": true,
  "amr": ["pwd", "otp"],
  "scope": "openid profile api:read api:write",
  "iat": 1719753600,
  "exp": 1719754500,
  "iss": "https://auth.atlas.example.com",
  "aud": "https://api.atlas.example.com"
}
```

**Signing:** RS256 (asymmetric) — API gateway validates with public JWKS endpoint.

```
GET https://auth.atlas.example.com/.well-known/jwks.json
```

Key rotation: quarterly, with 30-day overlap for old keys in JWKS.

#### 3.3 Web Session (httpOnly Cookies)

```http
Set-Cookie: atlas_access=eyJ...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=900
Set-Cookie: atlas_refresh=opaque_token; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=2592000
```

| Cookie | SameSite | Rationale |
|--------|----------|-----------|
| `atlas_access` | Lax | Sent on top-level navigation; blocks most CSRF |
| `atlas_refresh` | Strict | Only sent to refresh endpoint; maximum CSRF protection |

**CSRF protection:** Double-submit cookie or synchronizer token for state-changing API calls from web app.

#### 3.4 Token Refresh Flow

```
Client detects 401 (access expired)
    │
    ▼
POST /auth/refresh (sends atlas_refresh cookie)
    │
    ▼
Validate refresh token (Redis lookup + PostgreSQL session)
    │
    ├── Invalid/revoked → 401, clear cookies, redirect to login
    │
    └── Valid →
         ├── Rotate refresh token (new opaque token, invalidate old)
         ├── Issue new access JWT
         └── Return Set-Cookie headers
```

**Refresh token rotation:** Each refresh invalidates the previous token. Reuse of old token → revoke entire session family (breach detection).

#### 3.5 Session Storage

```
Redis (hot):
  session:{session_id} → { user_id, tenant_id, device_id, created_at, last_active, mfa_verified }
  refresh:{token_hash} → { session_id, family_id, created_at }
  TTL: matches refresh token lifetime

PostgreSQL (durable):
  auth.sessions table — full session history, revocation audit
  auth.refresh_tokens table — token families for rotation tracking
```

#### 3.6 Session Revocation

| Trigger | Action |
|---------|--------|
| User logout | Revoke session + refresh token family |
| Password change | Revoke all sessions except current |
| MFA reset | Revoke all sessions |
| Admin force logout | Revoke specific or all user sessions |
| Suspicious activity | Revoke session family; require re-auth |
| Refresh token reuse | Revoke entire token family |

```http
POST /auth/logout
POST /auth/sessions/{session_id}/revoke    # user revokes specific device
DELETE /admin/v1/users/{id}/sessions       # admin revokes all
```

#### 3.7 API / Integration Token Flow

For non-browser clients (OAuth apps, API integrations):

```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=...
&client_id=...
&client_secret=...
&redirect_uri=...
&code_verifier=...    # PKCE
```

Returns:

```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_token": "opaque...",
  "scope": "contacts:read invoices:write"
}
```

Access token sent as `Authorization: Bearer {token}` — not cookies.

---

### 4. Multi-Factor Authentication (MFA)

#### 4.1 MFA Methods

| Method | Security | UX | Default |
|--------|----------|-----|---------|
| **WebAuthn / Passkeys** | Highest (phishing-resistant) | Best (biometric) | Preferred |
| **TOTP** (authenticator app) | High | Good | Supported |
| **SMS OTP** | Medium (SIM-swap risk) | Familiar | Backup only |
| **Recovery codes** | High (one-time) | N/A | Generated at MFA setup |

#### 4.2 MFA Enrollment Flow

```
User enables MFA
    │
    ▼
Offer passkey registration (WebAuthn create)
    │
    ├── Success → store credential, generate 10 recovery codes
    │
    └── Declined → offer TOTP setup
         │
         ▼
    Display QR code (otpauth:// URI)
         │
         ▼
    User enters verification code
         │
         ▼
    Store TOTP secret (encrypted at rest, AES-256-GCM)
         │
         ▼
    Generate 10 recovery codes (bcrypt hashed, single-use)
```

#### 4.3 MFA Challenge Flow

```
Login (password/OAuth) successful
    │
    ▼
Check: MFA required? (tenant policy OR user enrolled)
    │
    ├── No → issue full session
    │
    └── Yes → issue partial session (mfa_pending claim, 5 min TTL)
         │
         ▼
    POST /auth/mfa/verify
    { "method": "webauthn", "credential": { ... } }
    OR
    { "method": "totp", "code": "123456" }
         │
         ▼
    Validate → upgrade to full session (mfa: true in JWT)
```

#### 4.4 WebAuthn / Passkey Configuration

```json
{
  "rp": {
    "name": "Atlas",
    "id": "atlas.example.com"
  },
  "authenticatorSelection": {
    "authenticatorAttachment": "platform",
    "residentKey": "preferred",
    "userVerification": "required"
  },
  "attestation": "none"
}
```

- Support multiple passkeys per user
- Cross-device passkeys via platform sync (iCloud Keychain, Google Password Manager)
- Conditional UI for autofill-based passkey sign-in

#### 4.5 MFA Policies (Tenant-Level)

| Policy | Options | Default |
|--------|---------|---------|
| `mfa_required` | `false`, `true`, `admins_only` | `false` |
| `mfa_methods_allowed` | `["webauthn", "totp", "sms"]` | all |
| `mfa_remember_device_days` | 0–90 | 30 |
| `mfa_sms_allowed` | `true`, `false` | `true` (backup) |

Enterprise tenants can enforce MFA for all users via admin console.

---

### 5. Enterprise SSO

#### 5.1 SSO Configuration Model

```json
{
  "tenant_id": "...",
  "sso_enabled": true,
  "sso_protocol": "saml",
  "sso_config": {
    "idp_entity_id": "https://idp.customer.com",
    "idp_sso_url": "https://idp.customer.com/sso",
    "idp_certificate": "-----BEGIN CERTIFICATE-----...",
    "attribute_mapping": {
      "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      "first_name": "firstName",
      "last_name": "lastName",
      "groups": "memberOf"
    }
  },
  "sso_enforced": true,
  "sso_jit_provisioning": true,
  "sso_default_role": "member"
}
```

#### 5.2 SSO Enforcement Modes

| Mode | Behavior |
|------|----------|
| **Optional** | SSO available; password login also works |
| **Enforced** | Password login disabled for tenant; SSO only |
| **Enforced + MFA** | SSO + step-up MFA for sensitive actions |

When `sso_enforced = true`:
- Password login returns `403` with redirect to SSO entry
- API password grant disabled for tenant users
- Break-glass admin account with MFA (platform-level, not tenant SSO)

#### 5.3 Domain Verification

Tenants claim email domains for automatic SSO routing:

```
User enters email: alice@acmecorp.com
    │
    ▼
Lookup: acmecorp.com → tenant with SSO enforced
    │
    ▼
Redirect to tenant SSO entry (skip password form)
```

Domain verification via DNS TXT record: `atlas-verify=token`.

#### 5.4 SCIM Provisioning (Phase 2)

User/group sync from IdP → Atlas. Documented in `11-integrations.md`. Authentication document establishes SSO identity as source of truth when SCIM active.

---

### 6. Device Trust and Session Policies

#### 6.1 Device Registration

Each session is bound to a **device record**:

```json
{
  "device_id": "uuid",
  "user_id": "uuid",
  "device_name": "Chrome on MacBook Pro",
  "device_type": "desktop",
  "user_agent": "...",
  "ip_address": "203.0.113.1",
  "geo": { "country": "US", "city": "San Francisco" },
  "trusted": true,
  "trusted_until": "2026-07-30T00:00:00Z",
  "first_seen": "2026-06-01T00:00:00Z",
  "last_active": "2026-06-30T12:00:00Z"
}
```

#### 6.2 Trust Policies

| Policy | Description |
|--------|-------------|
| **Remember device** | Skip MFA for N days on trusted devices |
| **New device alert** | Email notification on login from unrecognized device |
| **Max concurrent sessions** | Tenant-configurable (default: 10) |
| **Session idle timeout** | 30 minutes (web), 7 days (mobile with biometrics) |
| **Absolute session lifetime** | 30 days (requires re-authentication) |

#### 6.3 Anomaly Detection Signals

| Signal | Action |
|--------|--------|
| Impossible travel (geo velocity) | Step-up MFA required |
| New device + new IP | Email alert + MFA |
| Tor/VPN/proxy detected | Step-up MFA (configurable) |
| Multiple failed MFA attempts | Lock account 15 minutes |
| Credential used in breach DB | Force password reset |

#### 6.4 Session Management UI

Users can view and manage active sessions:

```
GET /v1/me/sessions
DELETE /v1/me/sessions/{session_id}
DELETE /v1/me/sessions  (revoke all except current)
```

---

### 7. Password Policies and Breach Detection

#### 7.1 Password Policy

| Rule | Value |
|------|-------|
| Minimum length | 12 characters |
| Maximum length | 128 characters |
| Complexity | No forced complexity (NIST 800-63B aligned) |
| Common password blocklist | Top 100,000 passwords blocked |
| Breach detection | HaveIBeenPwned k-anonymity API |
| Password history | Last 5 passwords cannot be reused |
| Max age | No forced rotation (NIST aligned); optional tenant policy |

#### 7.2 HaveIBeenPwned Integration

```
On password set/change:
    │
    ▼
SHA-1 hash password → take first 5 chars as prefix
    │
    ▼
GET https://api.pwnedpasswords.com/range/{prefix}
    │
    ▼
Check if full hash suffix appears in response
    │
    ├── Found → reject: "This password has appeared in a data breach"
    └── Not found → accept
```

- k-anonymity model: only 5-char prefix sent to HIBP
- Checked at registration, password change, and password reset
- Async re-check on login for existing passwords (background, non-blocking first time)

#### 7.3 Account Lockout

| Trigger | Lockout | Recovery |
|---------|---------|----------|
| 5 failed password attempts | 15 minutes | Automatic unlock |
| 10 failed attempts in 1 hour | 1 hour | Email unlock link |
| 20 failed attempts in 24 hours | Account locked | Admin or email recovery |

Lockout is per-account, not per-IP (prevents IP-based DoS on legitimate users).

---

### 8. Account Recovery Flows

#### 8.1 Password Reset

```
User: POST /auth/password/forgot { "email": "..." }
    │
    ▼
Always return 200 (prevent email enumeration)
    │
    ▼
If account exists: send reset email with token (1 hour TTL, single-use)
    │
    ▼
User: POST /auth/password/reset { "token": "...", "password": "..." }
    │
    ▼
Validate token → check HIBP → hash password → revoke all sessions
```

#### 8.2 MFA Recovery

| Method | Flow |
|--------|------|
| **Recovery codes** | User enters one of 10 single-use codes → MFA disabled, must re-enroll |
| **Admin reset** | Tenant admin resets MFA for user → user must re-enroll on next login |
| **Platform support** | Identity verification (government ID) for enterprise break-glass |

#### 8.3 Account Recovery (No Access)

```
User has no password, no MFA, no recovery codes
    │
    ▼
Contact support with identity verification
    │
    ▼
Support verifies via:
  - Registered email confirmation
  - Enterprise admin attestation
  - Document verification (high-security tenants)
    │
    ▼
Support initiates recovery → user sets new credentials
```

#### 8.4 Email Change

```
Authenticated user requests email change
    │
    ▼
Verification sent to NEW email (confirm ownership)
    │
    ▼
Notification sent to OLD email (detect unauthorized change)
    │
    ▼
Both confirmed → email updated → all sessions revoked
```

---

### 9. Service-to-Service Authentication

#### 9.1 Authentication Methods

| Method | Usage | Phase |
|--------|-------|-------|
| **mTLS** | Service mesh inter-service | 1 |
| **Service JWT** | Service identity with claims | 1 |
| **Service accounts** | Long-lived credentials for integrations | 1 |
| **Workload identity** | Cloud-native (AWS IAM, K8s SA) | 1 |

#### 9.2 mTLS in Service Mesh

```
Service A ──(mTLS)──▶ Istio/Linkerd proxy ──(mTLS)──▶ Service B proxy ──▶ Service B
```

- All internal traffic encrypted and mutually authenticated
- Certificates issued by mesh CA, rotated automatically (24h TTL)
- No plaintext HTTP between services

#### 9.3 Service JWT

Internal services obtain short-lived JWTs:

```http
POST /internal/auth/token
Authorization: Bearer {service_account_secret}

{
  "service_id": "workflow-engine",
  "audience": "crm-service"
}
```

**Service JWT claims:**

```json
{
  "sub": "service:workflow-engine",
  "aud": "crm-service",
  "scope": "internal:crm:read internal:crm:write",
  "iat": 1719753600,
  "exp": 1719753605,
  "iss": "https://auth.atlas.example.com"
}
```

- TTL: 5 minutes (never long-lived)
- Scoped to target service audience
- No refresh tokens for service JWTs — re-request on expiry

#### 9.4 Service Accounts

For external integrations and automation:

```json
POST /v1/service-accounts
{
  "name": "ERP Integration",
  "scopes": ["contacts:read", "invoices:read", "invoices:write"],
  "expires_at": "2027-06-30T00:00:00Z"
}

Response:
{
  "id": "sa_uuid",
  "client_id": "sa_client_id",
  "client_secret": "sa_secret_shown_once",
  "scopes": ["contacts:read", "invoices:read", "invoices:write"]
}
```

- Client credentials grant (`grant_type=client_credentials`)
- Scoped to tenant
- Rotatable secrets with overlap period
- Audit logged: every service account API call

#### 9.5 AI Agent Authentication

AI agents use service accounts with additional constraints:

```json
{
  "service_account_id": "sa_agent_uuid",
  "agent_id": "agent_uuid",
  "acting_user_id": "user_uuid",
  "delegation_scope": "user_granted_scopes",
  "ttl": 300
}
```

Agent acts on behalf of a user with delegated permissions (see `08-authorization.md`).

---

### 10. Authentication Data Model (Overview)

```
auth.users
  ├── id, email, email_verified, password_hash, ...
  └── tenant_memberships[]

auth.sessions
  ├── id, user_id, device_id, ip, user_agent, created_at, revoked_at
  └── mfa_verified, last_active_at

auth.refresh_tokens
  ├── id, session_id, token_hash, family_id, created_at, revoked_at
  └── rotation tracking

auth.mfa_credentials
  ├── id, user_id, type (webauthn|totp|sms), credential_data (encrypted)
  └── created_at, last_used_at

auth.webauthn_credentials
  ├── id, user_id, credential_id, public_key, sign_count
  └── transports, aaguid

auth.sso_connections
  ├── id, tenant_id, protocol, config (encrypted)
  └── enforced, jit_provisioning

auth.service_accounts
  ├── id, tenant_id, name, client_id, client_secret_hash
  └── scopes[], expires_at

auth.oauth_clients
  ├── id, tenant_id, name, redirect_uris
  └── scopes[], client_type (public|confidential)
```

Full schema in Phase 3.

---

### 11. Security Headers and Transport

| Requirement | Implementation |
|-------------|----------------|
| TLS | 1.3 minimum; HSTS `max-age=31536000; includeSubDomains` |
| Cookie security | `HttpOnly`, `Secure`, `SameSite` |
| CSP | Strict policy on auth pages |
| Brute force protection | Rate limiting at gateway + account lockout |
| Secrets storage | HashiCorp Vault / AWS Secrets Manager |
| PII encryption | Email, phone encrypted at rest (application-level AES-256-GCM) |

---

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Session-only (no JWT) | Poor fit for API integrations, mobile, microservices |
| JWT-only (no server-side session) | Cannot revoke sessions; refresh token rotation requires server state anyway |
| localStorage token storage | Vulnerable to XSS; industry moving away |
| SMS as primary MFA | SIM-swap attacks; NIST discourages SMS as primary |
| Forced password rotation | NIST 800-63B advises against; breach detection preferred |
| Shared secret service auth (no mTLS) | No identity verification between services |
| Single IdP vendor lock-in (Auth0 only) | Enterprise needs SAML + custom OIDC; self-hosted option required |
| Long-lived access tokens | Increased blast radius on theft; 15-min TTL limits exposure |

---

## Consequences

### Positive

- **Passkey-first MFA** provides phishing-resistant authentication with excellent UX
- **httpOnly cookie sessions** eliminate XSS token theft for web clients
- **Refresh token rotation** detects and contains token theft
- **Enterprise SSO** (SAML + OIDC) meets Fortune 500 requirements
- **mTLS + service JWT** secures internal service mesh
- **HIBP integration** prevents use of compromised passwords without storing breach data

### Negative

- **Session server state** (Redis) required despite JWT — adds infrastructure dependency
- **SAML complexity** — XML parsing, certificate rotation, attribute mapping per tenant
- **MFA friction** — even with passkeys, some users resist enrollment
- **Multi-provider maintenance** — each OAuth/OIDC provider has unique quirks
- **Cookie-based web auth** — complicates cross-domain API access (CORS, SameSite)

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Redis session store failure | PostgreSQL fallback; graceful re-auth |
| SAML certificate expiry | Automated expiry alerts 30 days prior |
| Passkey device loss | Recovery codes + TOTP backup |
| Service account secret leak | Short scopes, rotation, audit alerts |
| HIBP API unavailable | Cache common prefixes; fail open with logging |

---

## Open Questions

| # | Question | Owner | Target Date |
|---|----------|-------|-------------|
| 1 | Self-hosted auth core vs managed IdP (Keycloak, Auth0, Cognito)? | Security Arch | Q3 2026 |
| 2 | Global email uniqueness vs per-tenant? | Product + Data | Q3 2026 |
| 3 | Apple Sign-In priority for mobile launch? | Product | Q4 2026 |
| 4 | SCIM 2.0 provisioning in Phase 1 or Phase 2? | Integrations | Q3 2026 |
| 5 | Biometric session unlock on mobile — local only or server-validated? | Mobile Eng | Q4 2026 |
| 6 | Passwordless-only mode for tenants (no password option)? | Product | Q4 2026 |
| 7 | Hardware security key (YubiKey) as separate MFA method? | Security | Q3 2026 |
| 8 | Cross-tenant user identity (consultant across orgs)? | Product + Data | Q4 2026 |

---

## References

- [NIST SP 800-63B — Digital Identity Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [WebAuthn Specification (W3C)](https://www.w3.org/TR/webauthn-3/)
- [OAuth 2.0 PKCE (RFC 7636)](https://datatracker.ietf.org/doc/html/rfc7636)
- [SAML 2.0 Technical Overview](https://wiki.oasis-open.org/security/Private/SecurityIdentityManagement)
- [HaveIBeenPwned API](https://haveibeenpwned.com/API/v3)
- Atlas: `06-api-architecture.md`, `08-authorization.md`, `21-security.md`