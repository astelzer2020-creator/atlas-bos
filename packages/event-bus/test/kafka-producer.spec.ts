import { describe, expect, it } from 'vitest';

import { buildCloudEvent } from '../src/cloudevents/envelope.js';
import { createKafkaProducer, NoOpKafkaProducer } from '../src/kafka/kafka-producer.js';

const ORG_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const WORKSPACE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const CONTACT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const TRACE_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

describe('NoOpKafkaProducer', () => {
  it('records published events in mock mode', async () => {
    const producer = createKafkaProducer(null, { mock: true });
    expect(producer.isMock).toBe(true);

    const event = buildCloudEvent({
      source: 'atlas://customer-service',
      type: 'customer.contact.created.v1',
      subject: CONTACT_ID,
      organizationId: ORG_ID,
      workspaceId: WORKSPACE_ID,
      correlationId: TRACE_ID,
      causationId: TRACE_ID,
      actor: { type: 'system', id: USER_ID },
      aggregate: { type: 'contact', id: CONTACT_ID, version: 1 },
      payload: { contactId: CONTACT_ID },
      eventId: TRACE_ID,
    });

    await producer.publish(event);

    const noop = producer as NoOpKafkaProducer;
    expect(noop.getPublishedEvents()).toHaveLength(1);
    expect(noop.getPublishedEvents()[0]?.type).toBe('customer.contact.created.v1');
  });
});