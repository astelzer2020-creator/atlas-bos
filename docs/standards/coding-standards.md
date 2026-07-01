---
title: Coding Standards
document_id: ATLAS-STD-001
version: 1.0.0
status: approved
phase: 2
last_updated: 2026-06-30
authors:
  - Atlas Platform Engineering Team
related_documents:
  - ATLAS-ARCH-02
  - ATLAS-ARCH-20
  - ATLAS-ARCH-24
  - naming-standards.md
  - git-strategy.md
  - ../architecture/phase-2/06-folder-structure.md
tags:
  - coding-standards
  - typescript
  - go
  - testing
  - linting
---

# Coding Standards

## Purpose

Establish mandatory engineering standards for all Atlas BOS code — ensuring consistency, type safety, maintainability, security, and production readiness across TypeScript backend, Next.js frontend, and Go performance services.

These standards apply to every pull request. Violations block merge unless explicitly waived by a Principal Engineer with documented rationale.

## Scope

### In Scope

- TypeScript and Go language standards
- Error handling and logging conventions
- Testing requirements and coverage thresholds
- Linting, formatting, and import rules
- Code review checklist
- Documentation requirements
- Security coding practices

### Out of Scope

- Git workflow (see [git-strategy.md](./git-strategy.md))
- Naming conventions (see [naming-standards.md](./naming-standards.md))
- Folder structure (see [06-folder-structure.md](../architecture/phase-2/06-folder-structure.md))

---

## TypeScript Standards

### Compiler Configuration

All TypeScript packages inherit from root `tsconfig.base.json` with **strict mode fully enabled**:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### Prohibited Patterns

| Pattern | Reason | Alternative |
|---------|--------|-------------|
| `any` | Eliminates type safety | Use `unknown` + type guards, or generics |
| `as` type assertions (unchecked) | Hides type errors | Use Zod/io-ts runtime validation |
| `@ts-ignore` / `@ts-expect-error` | Suppresses compiler | Fix the type error; document if unavoidable |
| `enum` (TypeScript) | Runtime overhead, tree-shaking issues | Use `const` objects + `as const` |
| `var` | Function-scoped, error-prone | `const` (default) or `let` |
| `==` / `!=` | Implicit coercion | `===` / `!==` |
| Non-null assertion `!` | Assumes non-null without proof | Optional chaining `?.` or explicit checks |
| `console.log` in production code | Unstructured, no correlation | Use `@atlas/platform` logger |
| Magic numbers/strings | Unmaintainable | Named constants in config or domain |
| Default exports | Inconsistent import names | Named exports only |
| Barrel files re-exporting everything | Circular dependency risk | Explicit `module.ts` facades |

### Required Patterns

```typescript
// ✅ Branded types for domain IDs
type ContactId = string & { readonly __brand: 'ContactId' };

// ✅ Result type for expected failures
type Result<T, E = AtlasError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// ✅ Discriminated unions for state machines
type OrderStatus =
  | { status: 'draft' }
  | { status: 'confirmed'; confirmedAt: Date }
  | { status: 'cancelled'; reason: string };

// ✅ Readonly by default
interface CreateLeadCommand {
  readonly tenantId: TenantId;
  readonly email: EmailAddress;
  readonly source: LeadSource;
}

// ✅ Explicit return types on public functions
export function mapContactToDto(contact: Contact): ContactDto {
  // ...
}
```

### Async and Concurrency

| Rule | Standard |
|------|----------|
| Async functions | Always return `Promise<T>` with explicit type |
| Error handling | `try/catch` at application boundaries only; domain throws typed errors |
| Parallel I/O | `Promise.all()` for independent operations; `Promise.allSettled()` when partial failure acceptable |
| Timeouts | All external calls wrapped with timeout (default 3s client, 10s internal) |
| Retries | Exponential backoff with jitter; max 3 retries for transient errors |
| Transactions | Unit-of-work pattern in application layer; never in domain |

---

## Go Standards

Go services in `services/` follow these conventions:

| Rule | Standard |
|------|----------|
| Go version | Latest stable (minimum 1.22) |
| Formatting | `gofmt` + `goimports` enforced in CI |
| Linting | `golangci-lint` with default + `errcheck`, `govet`, `staticcheck` |
| Error handling | Never ignore errors; wrap with `fmt.Errorf("context: %w", err)` |
| Context | `context.Context` as first parameter on all I/O functions |
| Interfaces | Define at consumer site, not producer |
| Logging | `slog` structured JSON |
| Tests | Table-driven tests; `testify` for assertions |
| Naming | Follow [naming-standards.md](./naming-standards.md) Go section |

---

## Error Handling

### Error Taxonomy

All errors extend the platform error hierarchy defined in `@atlas/platform/errors`:

```typescript
abstract class AtlasError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
  abstract readonly retryable: boolean;
  readonly correlationId: string;
  readonly timestamp: Date;
}

class ValidationError extends AtlasError {
  readonly code = 'VALIDATION_ERROR';
  readonly httpStatus = 400;
  readonly retryable = false;
}

class DomainInvariantError extends AtlasError {
  readonly code = 'DOMAIN_INVARIANT_VIOLATION';
  readonly httpStatus = 422;
  readonly retryable = false;
}

class NotFoundError extends AtlasError {
  readonly code = 'NOT_FOUND';
  readonly httpStatus = 404;
  readonly retryable = false;
}

class ConflictError extends AtlasError {
  readonly code = 'CONFLICT';
  readonly httpStatus = 409;
  readonly retryable = false;
}

class UnauthorizedError extends AtlasError {
  readonly code = 'UNAUTHORIZED';
  readonly httpStatus = 401;
  readonly retryable = false;
}

class ForbiddenError extends AtlasError {
  readonly code = 'FORBIDDEN';
  readonly httpStatus = 403;
  readonly retryable = false;
}

class TransientInfrastructureError extends AtlasError {
  readonly code = 'SERVICE_UNAVAILABLE';
  readonly httpStatus = 503;
  readonly retryable = true;
}
```

### Error Handling Rules by Layer

| Layer | Rule |
|-------|------|
| **Domain** | Throw typed `AtlasError` subclasses for business rule violations |
| **Application** | Catch infrastructure errors; map to domain errors; never leak DB errors |
| **Infrastructure** | Wrap third-party errors in `TransientInfrastructureError` or specific adapter errors |
| **Presentation** | Map `AtlasError` → RFC 7807 Problem Details response; catch unhandled → 500 |
| **Frontend** | Display user-friendly messages; log technical details to observability |

### Standard Error Response (RFC 7807)

```json
{
  "type": "https://docs.atlas.dev/errors/DOMAIN_INVARIANT_VIOLATION",
  "title": "Domain Invariant Violation",
  "status": 422,
  "detail": "Cannot confirm order in status CANCELLED",
  "instance": "/v1/orders/01JABC.../confirm",
  "correlationId": "01JABC...",
  "errors": [
    { "field": "status", "code": "INVALID_TRANSITION", "message": "Order must be in DRAFT status" }
  ]
}
```

### Error Handling Prohibitions

- Never catch `Error` silently (empty catch blocks)
- Never return `null` to indicate errors — use `Result<T, E>`
- Never expose stack traces in production API responses
- Never log passwords, tokens, or PII in error details
- Never use generic `throw new Error('something went wrong')` in domain/application layers

---

## Logging

All services use the structured logger from `@atlas/platform/logging`.

### Log Format

Every log entry is a single JSON line (NDJSON) with required fields:

```json
{
  "timestamp": "2026-06-30T14:32:01.123Z",
  "level": "info",
  "message": "Lead created successfully",
  "service": "atlas-api",
  "correlationId": "01JABC...",
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "module": "customer",
  "operation": "CreateLead",
  "durationMs": 45,
  "metadata": {
    "leadId": "01JDEF..."
  }
}
```

### Log Level Guidelines

| Level | When to Use | Example |
|-------|-------------|---------|
| `debug` | Development diagnostics only; disabled in production | SQL query details |
| `info` | Normal operations, state transitions | "Order confirmed", "User logged in" |
| `warn` | Recoverable issues, deprecated usage, domain errors | "Retry attempt 2/3", "Rate limit approaching" |
| `error` | Infrastructure failures, unhandled exceptions | "Database connection failed", "Kafka publish timeout" |
| `fatal` | Process cannot continue | "Failed to bind port", "Migration failed" |

### Logging Rules

| Rule | Description |
|------|-------------|
| **L1** | Every HTTP request logs at `info` on completion with status, duration, correlationId |
| **L2** | Domain errors log at `warn`; infrastructure errors at `error` |
| **L3** | PII fields (email, phone, name, address) must be redacted or hashed |
| **L4** | Never log passwords, API keys, tokens, or session IDs |
| **L5** | Use `correlationId` from request context on every log line |
| **L6** | Include `tenantId` and `userId` when available |
| **L7** | Structured `metadata` object for domain-specific context — no string interpolation for machine parsing |

---

## Testing Requirements

### Testing Pyramid

```
                    ┌───────────┐
                    │    E2E    │  ~5%
                   ┌┴───────────┴┐
                   │ Integration  │  ~25%
                  ┌┴─────────────┴┐
                  │     Unit      │  ~70%
                  └───────────────┘
```

### Coverage Thresholds (CI Enforced)

| Package Layer | Minimum Line Coverage | Minimum Branch Coverage |
|---------------|----------------------|------------------------|
| `domain/` | 90% | 85% |
| `application/` | 85% | 80% |
| `infrastructure/` | 75% | 70% |
| `presentation/` | 70% | 65% |
| `packages/platform/` | 85% | 80% |
| `packages/shared-kernel/` | 95% | 90% |
| `apps/` | 60% | 55% |

### Test Requirements per Change Type

| Change Type | Required Tests |
|-------------|----------------|
| New domain aggregate/entity | Unit tests for all invariants and state transitions |
| New command handler | Unit test (mocked repos) + integration test (real DB) |
| New query handler | Unit test + integration test with seed data |
| New REST endpoint | Controller unit test + API integration test |
| New integration event | Contract test (schema validation) + consumer integration test |
| Bug fix | Regression test that fails without the fix |
| UI component | Unit test (render + interaction) + accessibility check |

### Test Naming Convention

```typescript
describe('CreateLeadHandler', () => {
  describe('when email is valid', () => {
    it('should create a lead and publish LeadCreated event', async () => {
      // Arrange → Act → Assert
    });
  });

  describe('when email already exists', () => {
    it('should return ConflictError', async () => {
      // ...
    });
  });
});
```

### Test Quality Rules

| Rule | Description |
|------|-------------|
| **T1** | Tests must be deterministic — no flaky tests allowed in CI |
| **T2** | No test interdependencies — each test sets up its own state |
| **T3** | Use factories/fixtures from `test/fixtures/` — no inline magic data |
| **T4** | Integration tests use Testcontainers — no mocked databases |
| **T5** | Mock only at port boundaries (repository interfaces, external APIs) |
| **T6** | Test names describe behavior: `should {expected} when {condition}` |
| **T7** | Multi-tenant isolation must be tested on every data access path |

---

## Linting and Formatting

### ESLint Configuration

Root `eslint.config.mjs` (flat config) with these plugins:

| Plugin | Purpose |
|--------|---------|
| `@typescript-eslint` | TypeScript-specific rules |
| `eslint-plugin-import` | Import ordering and boundary enforcement |
| `eslint-plugin-boundaries` | Module boundary validation |
| `eslint-plugin-unicorn` | Best practices |
| `eslint-plugin-security` | Security anti-patterns |
| `eslint-plugin-jest` / `eslint-plugin-vitest` | Test quality |

### Key ESLint Rules (Errors)

```javascript
{
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/explicit-function-return-type': ['error', {
    allowExpressions: true,
  }],
  '@typescript-eslint/no-unused-vars': 'error',
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/await-thenable': 'error',
  '@typescript-eslint/no-misused-promises': 'error',
  'import/no-default-export': 'error',
  'import/order': ['error', {
    groups: ['builtin', 'external', 'internal', 'parent', 'sibling'],
    'newlines-between': 'always',
    alphabetize: { order: 'asc' },
  }],
  'no-console': 'error',
  'no-restricted-imports': ['error', {
    patterns: ['**/infrastructure/**', '**/domain/**'],
  }],
}
```

### Prettier Configuration

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Pre-Commit Hooks (Husky + lint-staged)

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{go}": ["gofmt -w", "goimports -w"],
    "*.{json,md,yaml}": ["prettier --write"]
  }
}
```

---

## Import Rules

### Import Order

```typescript
// 1. Node.js built-ins
import { randomUUID } from 'node:crypto';

// 2. External packages
import { z } from 'zod';

// 3. @atlas/ packages (alphabetical)
import { TenantId } from '@atlas/shared-kernel';
import { Logger } from '@atlas/platform/logging';

// 4. Relative imports (same package only)
import { Contact } from '../domain/aggregates/contact';
import { ContactRepository } from '../domain/repositories/contact.repository';
```

### Import Prohibitions

| Prohibition | Reason |
|-------------|--------|
| Cross-package relative imports (`../../other-module/`) | Breaks module boundaries |
| Importing from `infrastructure/` of another module | Violates Clean Architecture |
| Importing from `domain/` of another module | Use facade `module.ts` instead |
| Wildcard imports (`import * as _ from 'lodash'`) | Tree-shaking, clarity |
| Dynamic imports without justification | Type safety, static analysis |

### Allowed Cross-Module Imports

```typescript
// ✅ Import from module facade
import { ContactQueryService, CreateLeadCommand } from '@atlas/module-customer';

// ✅ Import from shared packages
import { TenantId, Money } from '@atlas/shared-kernel';
import { Logger, UnitOfWork } from '@atlas/platform';

// ❌ NEVER do this
import { ContactRepository } from '@atlas/module-customer/infrastructure/persistence';
import { Contact } from '@atlas/module-customer/domain/aggregates/contact';
```

---

## Documentation Requirements

### Code Documentation

| Artifact | When Required | Format |
|----------|---------------|--------|
| JSDoc on public APIs | All exported functions, classes, interfaces in `platform/` and `shared-kernel/` | TSDoc |
| JSDoc on domain aggregates | All public methods with business meaning | TSDoc |
| Inline comments | Only for non-obvious business rules or algorithmic complexity | `//` sparingly |
| README per package | Every package in `packages/` and `services/` | Markdown |
| ADR | Any architectural decision not covered by existing ADRs | ADR template |

### JSDoc Example

```typescript
/**
 * Creates a new lead in the CRM pipeline.
 *
 * @remarks
 * Publishes a `customer.lead.created.v1` integration event after commit.
 * Idempotent on `(tenantId, email)` — returns existing lead if duplicate.
 *
 * @param command - The create lead command with validated inputs
 * @returns The created or existing lead DTO
 * @throws {ValidationError} If email format is invalid
 * @throws {ForbiddenError} If user lacks `leads:create` permission
 */
async execute(command: CreateLeadCommand): Promise<LeadDto> {
  // ...
}
```

### What NOT to Document

- Obvious getters/setters
- Private implementation details
- Code that is self-explanatory from types
- TODO comments (use issue tracker instead)

---

## Security Coding Practices

| Rule | Implementation |
|------|----------------|
| Input validation | Zod schemas at presentation layer boundaries |
| SQL injection | Parameterized queries only; no string concatenation |
| XSS prevention | React auto-escaping; sanitize HTML with DOMPurify when needed |
| CSRF | SameSite cookies + CSRF tokens on mutations |
| Secrets | Never in code; use `ATLAS_*` env vars from secrets manager |
| Dependencies | `npm audit` / `govulncheck` in CI; no critical vulnerabilities |
| Auth checks | Every endpoint validates authorization via OPA policies |
| Tenant isolation | `tenantId` set on every DB connection; RLS as defense-in-depth |
| Rate limiting | Applied at gateway; sensitive endpoints have app-level limits |
| Audit logging | All mutations logged with actor, action, resource, timestamp |

---

## Code Review Checklist

Every pull request must pass this checklist before merge:

### Architecture and Design

- [ ] Changes respect module boundaries (no cross-module infrastructure imports)
- [ ] Domain logic is in `domain/` layer — not in controllers or repositories
- [ ] New dependencies justified and added to correct `package.json`
- [ ] No business logic in `apps/` — only wiring and configuration
- [ ] Cross-module communication uses events or facade query services

### Type Safety and Quality

- [ ] No `any` types introduced
- [ ] No `@ts-ignore` without documented justification
- [ ] Explicit return types on all exported functions
- [ ] ESLint and Prettier pass with zero warnings
- [ ] `dependency-cruiser` passes

### Error Handling and Logging

- [ ] Errors use typed `AtlasError` hierarchy
- [ ] No empty catch blocks
- [ ] Structured logging with correlationId, tenantId
- [ ] No PII or secrets in logs
- [ ] RFC 7807 error responses for API endpoints

### Testing

- [ ] Unit tests for all new domain logic
- [ ] Integration tests for new data access paths
- [ ] Coverage thresholds met (no decrease without justification)
- [ ] Multi-tenant isolation tested
- [ ] No flaky tests introduced

### Security

- [ ] Input validation at API boundaries
- [ ] Authorization check on every new endpoint
- [ ] No hardcoded secrets or credentials
- [ ] SQL queries parameterized
- [ ] Idempotency key support on mutating endpoints

### Documentation

- [ ] Public APIs have JSDoc
- [ ] README updated if package behavior changed
- [ ] ADR created if architectural decision made
- [ ] `.env.example` updated if new env vars added

### Performance

- [ ] No N+1 query patterns
- [ ] Database queries have appropriate indexes (or migration included)
- [ ] Large payloads paginated (cursor-based)
- [ ] External calls have timeouts

---

## Frontend-Specific Standards (Next.js)

| Rule | Standard |
|------|----------|
| Components | Functional components only; no class components |
| State | Server state via TanStack Query; local UI state via `useState`/`useReducer` |
| Data fetching | Server Components for initial load; client-side via TanStack Query |
| Styling | Tailwind CSS + `@atlas/ui` design system tokens |
| Forms | React Hook Form + Zod validation |
| Accessibility | WCAG 2.1 AA; semantic HTML; keyboard navigation |
| Performance | Dynamic imports for heavy components; image optimization via `next/image` |
| Error boundaries | Per-feature error boundaries with fallback UI |

---

## CI Quality Gates

All gates must pass before merge to `main`:

| Gate | Tool | Threshold |
|------|------|-----------|
| Lint | ESLint + golangci-lint | Zero errors |
| Format | Prettier + gofmt | Zero diff |
| Type check | `tsc --noEmit` | Zero errors |
| Unit tests | Vitest + Go test | 100% pass |
| Integration tests | Testcontainers | 100% pass |
| Coverage | Istanbul | Per-layer thresholds (see above) |
| Security scan | Snyk / npm audit | No critical/high |
| Module boundaries | dependency-cruiser | Zero violations |
| Contract tests | Pact / schema validation | 100% pass |

---

## Cross-References

| Document | Relationship |
|----------|--------------|
| [06-folder-structure.md](../architecture/phase-2/06-folder-structure.md) | Where code lives |
| [naming-standards.md](./naming-standards.md) | Naming conventions |
| [git-strategy.md](./git-strategy.md) | PR and commit process |
| [24-testing.md](../architecture/phase-1/24-testing.md) | Full testing architecture |
| [20-logging.md](../architecture/phase-1/20-logging.md) | Logging architecture |
| [21-security.md](../architecture/phase-1/21-security.md) | Security architecture |

---

*Document owner: Principal Engineering · Review cadence: Quarterly*