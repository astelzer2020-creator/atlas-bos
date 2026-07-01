import { describe, expect, it } from 'vitest';

import { QUEUE_NAMES } from '../src/config/queue-config.js';
import { buildJobEnvelope, validateJobEnvelope } from '../src/types/job-envelope.js';

const VALID_ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const ORG_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

describe('validateJobEnvelope', () => {
  it('accepts a valid job envelope', () => {
    const envelope = {
      jobId: VALID_ULID,
      jobName: 'send-invoice-email',
      queue: QUEUE_NAMES.EMAIL,
      organizationId: ORG_ID,
      correlationId: VALID_ULID,
      enqueuedAt: '2026-06-30T14:32:01.123Z',
      attempt: 1,
      maxAttempts: 7,
      payload: { invoiceId: '550e8400-e29b-41d4-a716-446655440000' },
    };

    const result = validateJobEnvelope(envelope);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.jobName).toBe('send-invoice-email');
    }
  });

  it('rejects envelopes with invalid ULID jobId', () => {
    const result = validateJobEnvelope({
      jobId: 'not-a-ulid',
      jobName: 'send-invoice-email',
      queue: QUEUE_NAMES.EMAIL,
      organizationId: ORG_ID,
      correlationId: VALID_ULID,
      enqueuedAt: '2026-06-30T14:32:01.123Z',
      attempt: 1,
      maxAttempts: 7,
      payload: {},
    });

    expect(result.ok).toBe(false);
  });
});

describe('buildJobEnvelope', () => {
  it('builds an envelope with queue-specific maxAttempts', () => {
    const envelope = buildJobEnvelope({
      queue: QUEUE_NAMES.CRITICAL,
      jobName: 'process-payment-webhook',
      payload: { provider: 'stripe' },
      correlationId: VALID_ULID,
      organizationId: ORG_ID,
    });

    expect(envelope.maxAttempts).toBe(7);
    expect(envelope.queue).toBe(QUEUE_NAMES.CRITICAL);
    expect(envelope.attempt).toBe(1);
    expect(envelope.organizationId).toBe(ORG_ID);
  });
});