import { describe, expect, it } from 'vitest';

import { buildCloudEvent, parseCloudEvent } from '../src/cloudevents/envelope.js';

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

describe('buildCloudEvent', () => {
  it('builds a CloudEvents 1.0 envelope with Atlas extensions', () => {
    const event = buildSampleEvent();

    expect(event.specversion).toBe('1.0');
    expect(event.type).toBe('customer.contact.created.v1');
    expect(event.atlasorganizationid).toBe(ORG_ID);
    expect(event.atlastraceid).toBe(TRACE_ID);
    expect(event.data.payload).toEqual({
      contactId: CONTACT_ID,
      displayName: 'Jane Smith',
      email: 'jane@acme.com',
    });
  });
});

describe('parseCloudEvent', () => {
  it('parses a valid CloudEvent envelope', () => {
    const event = buildSampleEvent();
    const result = parseCloudEvent(event);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data.aggregate.type).toBe('contact');
    }
  });

  it('rejects invalid CloudEvent envelopes', () => {
    const result = parseCloudEvent({ specversion: '0.3', id: 'bad' });

    expect(result.ok).toBe(false);
  });
});