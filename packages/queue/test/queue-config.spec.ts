import { describe, expect, it } from 'vitest';

import {
  ALL_QUEUE_NAMES,
  DEFAULT_RETRY,
  DLQ_RETENTION_SECONDS,
  QUEUE_NAMES,
} from '../src/config/queue-config.js';

describe('QUEUE_NAMES', () => {
  it('defines all catalog queue names', () => {
    expect(ALL_QUEUE_NAMES).toEqual([
      'critical',
      'default',
      'bulk',
      'scheduled',
      'email',
      'ai',
      'webhook',
    ]);
    expect(QUEUE_NAMES.EMAIL).toBe('email');
  });

  it('defines DEFAULT_RETRY for every queue with retention defaults', () => {
    for (const queue of ALL_QUEUE_NAMES) {
      const policy = DEFAULT_RETRY[queue];
      expect(policy.attempts).toBeGreaterThan(0);
      expect(policy.removeOnComplete).toEqual({ age: 86_400, count: 1000 });
      expect(policy.removeOnFail).toBe(false);
    }

    expect(DLQ_RETENTION_SECONDS).toBe(30 * 86_400);
  });
});