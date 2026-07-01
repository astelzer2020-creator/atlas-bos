import { err, ok, type Result, ValidationError } from '@atlas/shared-kernel';
import { ulid } from 'ulid';
import { z } from 'zod';

import { DEFAULT_RETRY } from '../config/queue-config.js';
import { isAtlasQueueName } from '../retry/retry-policy.js';

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

/** Standard job payload envelope shared across all Atlas background jobs. */
export interface JobEnvelope<TPayload = Record<string, unknown>> {
  readonly jobId: string;
  readonly jobName: string;
  readonly queue: string;
  readonly organizationId: string | null;
  readonly workspaceId?: string | null;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly idempotencyKey?: string;
  readonly enqueuedAt: string;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly payload: TPayload;
}

const jobEnvelopeSchema = z.object({
  jobId: z.string().regex(ULID_PATTERN, 'jobId must be a valid ULID'),
  jobName: z.string().min(1, 'jobName is required'),
  queue: z.string().min(1, 'queue is required'),
  organizationId: z.string().uuid().nullable(),
  workspaceId: z.string().uuid().nullable().optional(),
  correlationId: z.string().regex(ULID_PATTERN, 'correlationId must be a valid ULID'),
  causationId: z.string().regex(ULID_PATTERN, 'causationId must be a valid ULID').optional(),
  idempotencyKey: z.string().min(1).optional(),
  enqueuedAt: z.string().datetime({ message: 'enqueuedAt must be an ISO 8601 timestamp' }),
  attempt: z.number().int().min(1),
  maxAttempts: z.number().int().min(1),
  payload: z.record(z.unknown()),
});

/** Validates an unknown value against the job envelope schema. */
export function validateJobEnvelope(
  envelope: unknown,
): Result<JobEnvelope, ValidationError> {
  const parsed = jobEnvelopeSchema.safeParse(envelope);

  if (!parsed.success) {
    return err(
      new ValidationError('Invalid job envelope', {
        field: 'jobEnvelope',
        details: parsed.error.flatten(),
      }),
    );
  }

  return ok(parsed.data as JobEnvelope);
}

export interface BuildJobEnvelopeInput<TPayload extends Record<string, unknown>> {
  readonly queue: string;
  readonly jobName: string;
  readonly payload: TPayload;
  readonly organizationId?: string | null;
  readonly workspaceId?: string | null;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly idempotencyKey?: string;
  readonly maxAttempts?: number;
  readonly jobId?: string;
}

/** Builds a new job envelope with catalog defaults for attempt and maxAttempts. */
export function buildJobEnvelope<TPayload extends Record<string, unknown>>(
  input: BuildJobEnvelopeInput<TPayload>,
): JobEnvelope<TPayload> {
  const queuePolicy = isAtlasQueueName(input.queue)
    ? DEFAULT_RETRY[input.queue]
    : DEFAULT_RETRY.default;

  const envelope: JobEnvelope<TPayload> = {
    jobId: input.jobId ?? ulid(),
    jobName: input.jobName,
    queue: input.queue,
    organizationId: input.organizationId ?? null,
    correlationId: input.correlationId,
    enqueuedAt: new Date().toISOString(),
    attempt: 1,
    maxAttempts: input.maxAttempts ?? queuePolicy.attempts,
    payload: input.payload,
  };

  if (input.workspaceId !== undefined) {
    Object.assign(envelope, { workspaceId: input.workspaceId });
  }

  if (input.causationId !== undefined) {
    Object.assign(envelope, { causationId: input.causationId });
  }

  if (input.idempotencyKey !== undefined) {
    Object.assign(envelope, { idempotencyKey: input.idempotencyKey });
  }

  return envelope;
}