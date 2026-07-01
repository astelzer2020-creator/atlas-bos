import { describe, expect, it } from 'vitest';

import {
  buildPartitionKey,
  consumerDlqTopic,
  eventTypeToTopic,
} from '../src/kafka/topic-naming.js';

describe('eventTypeToTopic', () => {
  it('prefixes event types with atlas.', () => {
    expect(eventTypeToTopic('customer.contact.created.v1')).toBe(
      'atlas.customer.contact.created.v1',
    );
  });

  it('does not double-prefix already qualified topics', () => {
    expect(eventTypeToTopic('atlas.customer.contact.created.v1')).toBe(
      'atlas.customer.contact.created.v1',
    );
  });
});

describe('buildPartitionKey', () => {
  it('combines organizationId and aggregateId', () => {
    const key = buildPartitionKey(
      '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      '550e8400-e29b-41d4-a716-446655440000',
    );

    expect(key).toBe('7c9e6679-7425-40de-944b-e07fc1f90ae7:550e8400-e29b-41d4-a716-446655440000');
  });
});

describe('consumerDlqTopic', () => {
  it('maps consumer groups to dead-letter topics', () => {
    expect(consumerDlqTopic('atlas-search-indexer')).toBe(
      'atlas.dead-letter.atlas-search-indexer',
    );
  });
});