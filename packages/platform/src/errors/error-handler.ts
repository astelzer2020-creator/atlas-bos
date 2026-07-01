import {
  ConflictError,
  DomainError,
  DomainErrorCode,
  ForbiddenError,
  NotFoundError,
  TenantIsolationError,
  UnauthorizedError,
  ValidationError,
} from '@atlas/shared-kernel/errors';

import { AtlasHttpError } from './http-errors.js';
import type { FieldError, ProblemDetails } from './http-errors.js';

const DOMAIN_CODE_TO_STATUS: Record<DomainErrorCode, number> = {
  [DomainErrorCode.NOT_FOUND]: 404,
  [DomainErrorCode.CONFLICT]: 409,
  [DomainErrorCode.VALIDATION]: 422,
  [DomainErrorCode.UNAUTHORIZED]: 401,
  [DomainErrorCode.FORBIDDEN]: 403,
  [DomainErrorCode.TENANT_ISOLATION]: 403,
};

export interface MapDomainErrorContext {
  readonly instance?: string;
  readonly requestId?: string;
}

/**
 * Maps a domain or transport error to an {@link AtlasHttpError}.
 */
export function mapDomainErrorToHttp(error: unknown): AtlasHttpError {
  if (error instanceof AtlasHttpError) {
    return error;
  }

  if (error instanceof DomainError) {
    const status = DOMAIN_CODE_TO_STATUS[error.code];
    const httpOptions: {
      status: number;
      code: string;
      cause: DomainError;
      title: string;
      details?: Record<string, unknown>;
      fieldErrors?: readonly FieldError[];
    } = {
      status,
      code: toMachineCode(error),
      cause: error,
      title: titleForDomainError(error),
    };

    if (error.details !== undefined) {
      httpOptions.details = { ...error.details };
    }

    const fieldErrors = extractFieldErrors(error);
    if (fieldErrors !== undefined) {
      httpOptions.fieldErrors = fieldErrors;
    }

    return new AtlasHttpError(error.message, httpOptions);
  }

  if (error instanceof Error) {
    return new AtlasHttpError('An unexpected error occurred', {
      status: 500,
      code: 'platform_internal_error',
      cause: error,
    });
  }

  return new AtlasHttpError('An unexpected error occurred', {
    status: 500,
    code: 'platform_internal_error',
  });
}

/**
 * Maps any error to RFC 7807 Problem Details for API responses.
 */
export function toProblemDetails(
  error: unknown,
  context: MapDomainErrorContext = {},
): ProblemDetails {
  return mapDomainErrorToHttp(error).toProblemDetails(context);
}

function toMachineCode(error: DomainError): string {
  return error.code.toLowerCase();
}

function titleForDomainError(error: DomainError): string {
  if (error instanceof ValidationError) {
    return 'Validation Failed';
  }
  if (error instanceof NotFoundError) {
    return 'Not Found';
  }
  if (error instanceof ConflictError) {
    return 'Conflict';
  }
  if (error instanceof UnauthorizedError) {
    return 'Unauthorized';
  }
  if (error instanceof ForbiddenError || error instanceof TenantIsolationError) {
    return 'Forbidden';
  }
  return 'Internal Server Error';
}

function extractFieldErrors(error: DomainError): readonly FieldError[] | undefined {
  if (!(error instanceof ValidationError) || error.field === undefined) {
    return undefined;
  }

  return [
    {
      field: error.field,
      code: 'validation_failed',
      message: error.message,
    },
  ];
}