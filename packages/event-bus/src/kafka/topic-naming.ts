const ATLAS_TOPIC_PREFIX = 'atlas';

/** Maps an event type to its Kafka topic (`atlas.{event-name}`). */
export function eventTypeToTopic(eventType: string): string {
  const normalized = eventType.trim().toLowerCase();
  if (normalized.startsWith(`${ATLAS_TOPIC_PREFIX}.`)) {
    return normalized;
  }

  return `${ATLAS_TOPIC_PREFIX}.${normalized}`;
}

/** Builds the Kafka partition key for tenant-scoped ordering. */
export function buildPartitionKey(organizationId: string, aggregateId: string): string {
  return `${organizationId}:${aggregateId}`;
}

/** Returns the consumer dead-letter topic for a consumer group. */
export function consumerDlqTopic(consumerGroupId: string): string {
  return `${ATLAS_TOPIC_PREFIX}.dead-letter.${consumerGroupId}`;
}