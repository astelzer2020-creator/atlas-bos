import { describe, expect, it } from 'vitest';

import { QUEUE_NAMES } from '../src/config/queue-config.js';
import {
  resolveJobTimeout,
  resolveQueueRetryPolicy,
  resolveRetryOptions,
} from '../src/retry/retry-policy.js';

describe('resolveRetryOptions', () => {
  it('applies critical queue exponential backoff with 7 attempts', () => {
    const options = resolveRetryOptions(QUEUE_NAMES.CRITICAL);

    expect(options.attempts).toBe(7);
    expect(options.backoff).toEqual({ type: 'exponential', delay: 1000 });
    expect(options.removeOnFail).toBe(false);
  });

  it('applies default queue exponential backoff with 2s base delay', () => {
    const options = resolveRetryOptions(QUEUE_NAMES.DEFAULT);

    expect(options.attempts).toBe(5);
    expect(options.backoff).toEqual({ type: 'exponential', delay: 2000 });
    expect(options.removeOnComplete).toEqual({ age: 86_400, count: 1000 });
  });

  it('applies bulk queue fixed 60s backoff with 3 attempts', () => {
    const options = resolveRetryOptions(QUEUE_NAMES.BULK);

    expect(options.attempts).toBe(3);
    expect(options.backoff).toEqual({ type: 'fixed', delay: 60_000 });
  });

  it('falls back to default policy for unknown queues', () => {
    const policy = resolveQueueRetryPolicy('unknown-queue');
    const timeout = resolveJobTimeout('unknown-queue');

    expect(policy.attempts).toBe(5);
    expect(timeout).toBe(120_000);
  });
});