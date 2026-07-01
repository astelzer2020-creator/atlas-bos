import { describe, expect, it } from 'vitest';

import { QUEUE_NAMES } from '../src/config/queue-config.js';
import { dlqQueueName } from '../src/dlq/dlq-handler.js';

describe('dlqQueueName', () => {
  it('suffixes :dlq to the source queue name', () => {
    expect(dlqQueueName(QUEUE_NAMES.DEFAULT)).toBe('default:dlq');
    expect(dlqQueueName(QUEUE_NAMES.CRITICAL)).toBe('critical:dlq');
    expect(dlqQueueName(QUEUE_NAMES.WEBHOOK)).toBe('webhook:dlq');
  });
});