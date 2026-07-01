import { afterEach, describe, expect, it } from 'vitest';

import {
  buildCloudEvent,
  eventTypeToTopic,
  parseCloudEvent,
  RedisPubSub,
} from '@atlas/event-bus';
import Redis from 'ioredis';

import { getIntegrationContext } from './helpers/integration-context.js';

const ORG_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const WORKSPACE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const CONTACT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const TRACE_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const CAUSATION_ID = '01ARZ3NDEKTSV4RRFFQ69G5FBW';

function buildSampleEvent() {
  return buildCloudEvent({
    source: 'atlas://customer-service',
    type: 'customer.contact.created.v1',
    subject: CONTACT_ID,
    organizationId: ORG_ID,
    workspaceId: WORKSPACE_ID,
    correlationId: TRACE_ID,
    causationId: CAUSATION_ID,
    actor: { type: 'user', id: USER_ID },
    aggregate: { type: 'contact', id: CONTACT_ID, version: 1 },
    payload: {
      contactId: CONTACT_ID,
      displayName: 'Jane Smith',
      email: 'jane@acme.com',
    },
    eventId: TRACE_ID,
    occurredAt: '2026-06-30T14:32:01.123Z',
  });
}

describe('CloudEvents envelope (mock)', () => {
  it('buildCloudEvent and parseCloudEvent round-trip', () => {
    const event = buildSampleEvent();
    const result = parseCloudEvent(event);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.type).toBe('customer.contact.created.v1');
      expect(result.value.data.aggregate.type).toBe('contact');
      expect(result.value.data.payload).toEqual(event.data.payload);
    }
  });

  it('rejects invalid CloudEvent envelopes', () => {
    const result = parseCloudEvent({ specversion: '0.3', id: 'bad' });
    expect(result.ok).toBe(false);
  });

  it('preserves Atlas extensions through JSON serialization', () => {
    const event = buildSampleEvent();
    const restored = parseCloudEvent(JSON.parse(JSON.stringify(event)) as unknown);

    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.value.atlasorganizationid).toBe(ORG_ID);
      expect(restored.value.atlastraceid).toBe(TRACE_ID);
      expect(eventTypeToTopic(restored.value.type)).toBe('atlas.customer.contact.created.v1');
    }
  });
});

describe('CloudEvents envelope (live Redis pub/sub)', () => {
  const clients: Redis[] = [];

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.quit()));
  });

  it.skipIf(() => !getIntegrationContext().redisAvailable)(
    'delivers serialized CloudEvents over Redis pub/sub',
    async () => {
      const ctx = getIntegrationContext();
      const publisher = new Redis(ctx.redisUrl);
      const subscriber = new Redis(ctx.redisUrl);
      clients.push(publisher, subscriber);

      const pubsub = new RedisPubSub(publisher, subscriber);
      const event = buildSampleEvent();
      const channel = eventTypeToTopic(event.type);
      const received: string[] = [];

      await pubsub.subscribe(channel, (_ch, message) => {
        received.push(message);
      });

      await pubsub.publish(channel, JSON.stringify(event));

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(received).toHaveLength(1);

      const parsed = parseCloudEvent(JSON.parse(received[0] ?? '{}') as unknown);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.value.id).toBe(event.id);
        expect(parsed.value.data.payload).toEqual(event.data.payload);
      }

      await pubsub.close();
    },
  );

  it.skipIf(() => !getIntegrationContext().redisAvailable)(
    'maps event types to canonical Kafka topic names',
    () => {
      expect(eventTypeToTopic('customer.contact.created.v1')).toBe(
        'atlas.customer.contact.created.v1',
      );
      expect(eventTypeToTopic('ledger.journal_entry.posted.v1')).toBe(
        'atlas.ledger.journal_entry.posted.v1',
      );
    },
  );
});