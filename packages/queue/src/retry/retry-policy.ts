import type { JobsOptions } from 'bullmq';

import {
  ALL_QUEUE_NAMES,
  DEFAULT_RETRY,
  type AtlasQueueName,
  type QueueRetryPolicy,
} from '../config/queue-config.js';

/** Returns true when the queue name is a known Atlas queue. */
export function isAtlasQueueName(queue: string): queue is AtlasQueueName {
  return (ALL_QUEUE_NAMES as readonly string[]).includes(queue);
}

/** Resolves the catalog retry policy for a queue, falling back to `default`. */
export function resolveQueueRetryPolicy(queue: string): QueueRetryPolicy {
  if (isAtlasQueueName(queue)) {
    return DEFAULT_RETRY[queue];
  }

  return DEFAULT_RETRY.default;
}

/** Resolves the job timeout in milliseconds for a queue. */
export function resolveJobTimeout(queue: string): number {
  return resolveQueueRetryPolicy(queue).timeoutMs;
}

/** Maps catalog retry policy to BullMQ {@link JobsOptions}. */
export function resolveRetryOptions(queue: string): JobsOptions {
  const policy = resolveQueueRetryPolicy(queue);

  const backoff =
    policy.backoff.type === 'fixed'
      ? { type: 'fixed' as const, delay: policy.backoff.delay }
      : policy.backoff.type === 'exponential'
        ? { type: 'exponential' as const, delay: policy.backoff.delay }
        : { type: 'exponential' as const, delay: 2000 };

  return {
    attempts: policy.attempts,
    backoff,
    removeOnComplete: policy.removeOnComplete,
    removeOnFail: policy.removeOnFail,
  };
}