/** Canonical Atlas background job queue names. */
export const QUEUE_NAMES = {
  CRITICAL: 'critical',
  DEFAULT: 'default',
  BULK: 'bulk',
  SCHEDULED: 'scheduled',
  EMAIL: 'email',
  AI: 'ai',
  WEBHOOK: 'webhook',
} as const;

export type AtlasQueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const ALL_QUEUE_NAMES: readonly AtlasQueueName[] = Object.values(QUEUE_NAMES);

export type BackoffType = 'exponential' | 'fixed' | 'custom';

export interface QueueRetryPolicy {
  readonly attempts: number;
  readonly backoff: {
    readonly type: BackoffType;
    readonly delay: number;
  };
  readonly timeoutMs: number;
  readonly removeOnComplete: { readonly age: number; readonly count: number };
  readonly removeOnFail: boolean;
}

const BASE_RETENTION = {
  removeOnComplete: { age: 86_400, count: 1000 },
  removeOnFail: false,
} as const;

/**
 * Per-queue retry, backoff, and timeout defaults from the background job catalog.
 * @see docs/api/queues/background-jobs.md
 */
export const DEFAULT_RETRY: Record<AtlasQueueName, QueueRetryPolicy> = {
  critical: {
    attempts: 7,
    backoff: { type: 'exponential', delay: 1000 },
    timeoutMs: 60_000,
    ...BASE_RETENTION,
  },
  default: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    timeoutMs: 120_000,
    ...BASE_RETENTION,
  },
  bulk: {
    attempts: 3,
    backoff: { type: 'fixed', delay: 60_000 },
    timeoutMs: 3_600_000,
    ...BASE_RETENTION,
  },
  scheduled: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    timeoutMs: 300_000,
    ...BASE_RETENTION,
  },
  email: {
    attempts: 7,
    backoff: { type: 'exponential', delay: 30_000 },
    timeoutMs: 30_000,
    ...BASE_RETENTION,
  },
  ai: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
    timeoutMs: 300_000,
    ...BASE_RETENTION,
  },
  webhook: {
    attempts: 7,
    backoff: { type: 'custom', delay: 0 },
    timeoutMs: 35_000,
    ...BASE_RETENTION,
  },
};

/** DLQ retention in seconds (30 days per catalog). */
export const DLQ_RETENTION_SECONDS = 30 * 86_400;