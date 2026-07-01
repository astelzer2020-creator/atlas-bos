import { describe, expect, it } from 'vitest';

import { RedisPubSub } from '../src/redis/redis-pubsub.js';

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

describe('RedisPubSub', () => {
  it('delivers published messages to subscribers', async () => {
    const redis = new InMemoryPubSubRedis();
    const pubsub = new RedisPubSub(redis as never, redis as never);

    const received: string[] = [];
    await pubsub.subscribe('atlas.customer.contact.created.v1', (_channel, message) => {
      received.push(message);
    });

    await pubsub.publish('atlas.customer.contact.created.v1', '{"id":"01ARZ3NDEKTSV4RRFFQ69G5FAV"}');
    expect(received).toHaveLength(1);
  });
});