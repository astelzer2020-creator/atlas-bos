import { describe, expect, it } from 'vitest';

import { buildCloudEvent } from '@atlas/event-bus';
import { buildJobEnvelope, validateJobEnvelope } from '@atlas/queue';

const ITERATIONS = 10_000;
const VALID_ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

describe('queue and event envelope performance', () => {
  it('builds and validates 10k job envelopes under 1s', () => {
    const started = performance.now();

    for (let index = 0; index < ITERATIONS; index += 1) {
      const envelope = buildJobEnvelope({
        queue: 'default',
        jobName: 'workflow.instance.advance',
        payload: { instanceId: `instance-${index}`, nodeId: 'node-1' },
        organizationId: ORG_ID,
        correlationId: VALID_ULID,
      });

      const validated = validateJobEnvelope(envelope);
      expect(validated.ok).toBe(true);
    }

    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(1000);
  });

  it('builds 10k CloudEvents under 500ms', () => {
    const started = performance.now();

    for (let index = 0; index < ITERATIONS; index += 1) {
      const event = buildCloudEvent({
        source: 'atlas://crm',
        type: 'customer.contact.created.v1',
        subject: `contact-${index}`,
        organizationId: ORG_ID,
        correlationId: VALID_ULID,
        actor: { type: 'user', id: 'user-1' },
        aggregate: { type: 'contact', id: `contact-${index}`, version: 1 },
        payload: { contactId: `contact-${index}` },
      });

      expect(event.type).toBe('customer.contact.created.v1');
    }

    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(500);
  });
});