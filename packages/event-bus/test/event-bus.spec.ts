import { describe, expect, it } from 'vitest';

import { buildCloudEvent } from '../src/cloudevents/envelope.js';
import { AtlasEventBus } from '../src/event-bus.js';
import { createKafkaProducer } from '../src/kafka/kafka-producer.js';
import { RedisPubSub } from '../src/redis/redis-pubsub.js';

const ORG_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const WORKSPACE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const CONTACT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const TRACE_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

class InMemoryPubSubRedis {
  private readonly messageListeners: Array<(channel: string, message: string) => void> = [];
  private readonly subscribedChannels = new Set<string>();

  duplicate(): InMemoryPubSubRedis {
    const duplicate = new InMemoryPubSubRedis();
    duplicate.messageListeners.push(...this.messageListeners);
    return duplicate;
  }

  on(event: string, handler: (channel: string, message: string) => void): void {
    if (event === 'message') {
      this.messageListeners.push(handler);
    }
  }

  async subscribe(channel: string): Promise<number> {
    this.subscribedChannels.add(channel);
    return 1;
  }

  async unsubscribe(channel: string): Promise<number> {
    this.subscribedChannels.delete(channel);
    return 1;
  }

  async publish(channel: string, message: string): Promise<number> {
    if (!this.subscribedChannels.has(channel)) {
      return 0;
    }

    for (const listener of this.messageListeners) {
      listener(channel, message);
    }

    return this.messageListeners.length;
  }

  async quit(): Promise<'OK'> {
    return 'OK';
  }
}

describe('AtlasEventBus', () => {
  it('publishes to Kafka mock and fans out via Redis pub/sub', async () => {
    const producer = createKafkaProducer(null, { mock: true });
    const redis = new InMemoryPubSubRedis();
    const pubsub = new RedisPubSub(redis as never, redis as never);
    const bus = new AtlasEventBus(producer, pubsub);

    expect(bus.isMockMode()).toBe(true);

    const fanout: string[] = [];
    await pubsub.subscribe('atlas.customer.contact.created.v1', (_channel, message) => {
      fanout.push(message);
    });

    const event = buildCloudEvent({
      source: 'atlas://customer-service',
      type: 'customer.contact.created.v1',
      subject: CONTACT_ID,
      organizationId: ORG_ID,
      workspaceId: WORKSPACE_ID,
      correlationId: TRACE_ID,
      causationId: TRACE_ID,
      actor: { type: 'user', id: USER_ID },
      aggregate: { type: 'contact', id: CONTACT_ID, version: 1 },
      payload: { contactId: CONTACT_ID },
      eventId: TRACE_ID,
    });

    await bus.publish(event);

    expect(fanout).toHaveLength(1);
    expect(JSON.parse(fanout[0] ?? '{}')).toMatchObject({ type: 'customer.contact.created.v1' });
  });
});