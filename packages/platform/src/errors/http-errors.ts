export interface FieldError {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly request_id?: string;
  readonly code?: string;
  readonly errors?: readonly FieldError[];
}

export interface AtlasHttpErrorOptions {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly fieldErrors?: readonly FieldError[];
  readonly cause?: Error;
  readonly typeUri?: string;
  readonly title?: string;
}

const DEFAULT_ERROR_BASE_URI = 'https://api.atlas.example.com/errors';

const STATUS_TITLE: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Validation Failed',
  429: 'Rate Limited',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

/**
 * HTTP-layer error with RFC 7807 Problem Details serialization.
 */
export class AtlasHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly fieldErrors?: readonly FieldError[];
  readonly typeUri: string;
  readonly title: string;

  constructor(message: string, options: AtlasHttpErrorOptions) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'AtlasHttpError';
    this.status = options.status;
    this.code = options.code;
    if (options.details !== undefined) {
      this.details = options.details;
    }
    if (options.fieldErrors !== undefined) {
      this.fieldErrors = options.fieldErrors;
    }
    this.title = options.title ?? STATUS_TITLE[options.status] ?? 'Error';
    this.typeUri = options.typeUri ?? `${DEFAULT_ERROR_BASE_URI}/${slugify(this.title)}`;
  }

  toProblemDetails(context: { instance?: string; requestId?: string } = {}): ProblemDetails {
    const problem: ProblemDetails = {
      type: this.typeUri,
      title: this.title,
      status: this.status,
      detail: this.message,
      code: this.code,
    };

    if (context.instance !== undefined) {
      return {
        ...problem,
        instance: context.instance,
        ...(context.requestId !== undefined ? { request_id: context.requestId } : {}),
        ...(this.fieldErrors !== undefined && this.fieldErrors.length > 0
          ? { errors: this.fieldErrors }
          : {}),
      };
    }

    if (context.requestId !== undefined) {
      return {
        ...problem,
        request_id: context.requestId,
        ...(this.fieldErrors !== undefined && this.fieldErrors.length > 0
          ? { errors: this.fieldErrors }
          : {}),
      };
    }

    if (this.fieldErrors !== undefined && this.fieldErrors.length > 0) {
      return { ...problem, errors: this.fieldErrors };
    }

    return problem;
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}