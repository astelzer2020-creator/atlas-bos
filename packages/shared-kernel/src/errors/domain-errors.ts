/** Canonical domain error codes used across Atlas bounded contexts. */
export const DomainErrorCode = {
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION: 'VALIDATION',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TENANT_ISOLATION: 'TENANT_ISOLATION',
} as const;

export type DomainErrorCode = (typeof DomainErrorCode)[keyof typeof DomainErrorCode];

export interface DomainErrorOptions {
  readonly cause?: unknown;
  readonly details?: Readonly<Record<string, unknown>>;
}

/** Base class for all expected domain-level failures. */
export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(message: string, code: DomainErrorCode, options?: DomainErrorOptions) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = this.constructor.name;
    this.code = code;
    if (options?.details !== undefined) {
      this.details = options.details;
    }
  }
}

/** Raised when a requested entity or resource does not exist. */
export class NotFoundError extends DomainError {
  readonly resourceType: string;
  readonly resourceId: string;

  constructor(resourceType: string, resourceId: string, options?: DomainErrorOptions) {
    super(`${resourceType} not found: ${resourceId}`, DomainErrorCode.NOT_FOUND, options);
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/** Raised when an operation conflicts with the current state (e.g. duplicate key). */
export class ConflictError extends DomainError {
  constructor(message: string, options?: DomainErrorOptions) {
    super(message, DomainErrorCode.CONFLICT, options);
  }
}

export interface ValidationErrorOptions extends DomainErrorOptions {
  readonly field?: string;
}

/** Raised when input fails domain or structural validation rules. */
export class ValidationError extends DomainError {
  readonly field?: string;

  constructor(message: string, options?: ValidationErrorOptions) {
    super(message, DomainErrorCode.VALIDATION, options);
    if (options?.field !== undefined) {
      this.field = options.field;
    }
  }
}

/** Raised when authentication credentials are missing or invalid. */
export class UnauthorizedError extends DomainError {
  constructor(message = 'Authentication required', options?: DomainErrorOptions) {
    super(message, DomainErrorCode.UNAUTHORIZED, options);
  }
}

/** Raised when an authenticated principal lacks permission for the requested action. */
export class ForbiddenError extends DomainError {
  constructor(message = 'Access denied', options?: DomainErrorOptions) {
    super(message, DomainErrorCode.FORBIDDEN, options);
  }
}

/** Raised when a cross-tenant access attempt violates isolation boundaries. */
export class TenantIsolationError extends DomainError {
  constructor(message = 'Cross-tenant access denied', options?: DomainErrorOptions) {
    super(message, DomainErrorCode.TENANT_ISOLATION, options);
  }
}