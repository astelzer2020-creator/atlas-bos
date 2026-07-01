import { afterEach, describe, expect, it } from 'vitest';

import {
  AtlasQueueManager,
  buildJobEnvelope,
  QUEUE_NAMES,
  validateJobEnvelope,
} from '@atlas/queue';

import { getIntegrationContext } from './helpers/integration-context.js';

const ORG_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const CORRELATION_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

describe('Queue job envelope (mock)', () => {
  it('buildJobEnvelope and validateJobEnvelope round-trip', () => {
    const envelope = buildJobEnvelope({
      queue: QUEUE_NAMES.EMAIL,
      jobName: 'integration-test-email',
      payload: { template: 'welcome', userId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
      organizationId: ORG_ID,
      correlationId: CORRELATION_ID,
    });

    const serialized = JSON.parse(JSON.stringify(envelope)) as unknown;
    const result = validateJobEnvelope(serialized);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.queue).toBe(QUEUE_NAMES.EMAIL);
      expect(result.value.payload).toEqual(envelope.payload);
    }
  });

  it('rejects envelopes with invalid correlationId', () => {
    const result = validateJobEnvelope({
      jobId: CORRELATION_ID,
      jobName: 'bad-envelope',
      queue: QUEUE_NAMES.DEFAULT,
      organizationId: ORG_ID,
      correlationId: 'not-a-ulid',
      enqueuedAt: new Date().toISOString(),
      attempt: 1,
      maxAttempts: 5,
      payload: {},
    });

    expect(result.ok).toBe(false);
  });

  it('applies queue-specific retry defaults for critical jobs', () => {
    const envelope = buildJobEnvelope({
      queue: QUEUE_NAMES.CRITICAL,
      jobName: 'process-payment-webhook',
      payload: { provider: 'stripe' },
      correlationId: CORRELATION_ID,
      organizationId: ORG_ID,
    });

    expect(envelope.maxAttempts).toBe(7);
    expect(envelope.queue).toBe(QUEUE_NAMES.CRITICAL);
  });
});

describe('Queue job envelope (live Redis)', () => {
  const managers: AtlasQueueManager[] = [];

  afterEach(async () => {
    await Promise.all(managers.splice(0).map((manager) => manager.close()));
  });

  it.skipIf(() => !getIntegrationContext().redisAvailable)(
    'enqueues a validated envelope to BullMQ and retrieves it',
    async () => {
      const ctx = getIntegrationContext();
      const manager = new AtlasQueueManager({
        redisUrl: ctx.redisUrl,
        workerId: 'integration-test-queue',
      });
      managers.push(manager);

      const jobId = await manager.enqueue(
        QUEUE_NAMES.DEFAULT,
        'integration-test-job',
        { probe: true, at: new Date().toISOString() },
        {
          organizationId: ORG_ID,
          correlationId: CORRELATION_ID,
        },
      );

      const queue = manager.getQueue(QUEUE_NAMES.DEFAULT);
      const job = await queue.getJob(jobId);

      expect(job).not.toBeNull();
      expect(job?.name).toBe('integration-test-job');
      expect(job?.data.organizationId).toBe(ORG_ID);
      expect(job?.data.correlationId).toBe(CORRELATION_ID);
    },
  );

  it.skipIf(() => !getIntegrationContext().redisAvailable)(
    'deduplicates jobs by idempotency key',
    async () => {
      const ctx = getIntegrationContext();
      const manager = new AtlasQueueManager({
        redisUrl: ctx.redisUrl,
        workerId: 'integration-test-queue',
      });
      managers.push(manager);

      const idempotencyKey = `idem-${Date.now()}`;
      const firstId = await manager.enqueue(
        QUEUE_NAMES.BULK,
        'integration-idempotent',
        { batch: 1 },
        { idempotencyKey, correlationId: CORRELATION_ID },
      );
      const secondId = await manager.enqueue(
        QUEUE_NAMES.BULK,
        'integration-idempotent',
        { batch: 2 },
        { idempotencyKey, correlationId: CORRELATION_ID },
      );

      expect(secondId).toBe(firstId);
    },
  );
});