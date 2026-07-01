import type { Redis } from 'ioredis';

export type PubSubMessageHandler = (channel: string, message: string) => void;

/** Redis pub/sub for local fan-out of domain events. */
export class RedisPubSub {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly handlers = new Map<string, Set<PubSubMessageHandler>>();

  constructor(publisher: Redis, subscriber?: Redis) {
    this.publisher = publisher;
    this.subscriber = subscriber ?? publisher.duplicate();

    this.subscriber.on('message', (channel: string, message: string) => {
      const channelHandlers = this.handlers.get(channel);
      if (!channelHandlers) {
        return;
      }

      for (const handler of channelHandlers) {
        handler(channel, message);
      }
    });
  }

  async publish(channel: string, message: string): Promise<number> {
    return this.publisher.publish(channel, message);
  }

  async subscribe(channel: string, handler: PubSubMessageHandler): Promise<void> {
    let channelHandlers = this.handlers.get(channel);
    if (!channelHandlers) {
      channelHandlers = new Set();
      this.handlers.set(channel, channelHandlers);
      await this.subscriber.subscribe(channel);
    }

    channelHandlers.add(handler);
  }

  async unsubscribe(channel: string, handler?: PubSubMessageHandler): Promise<void> {
    const channelHandlers = this.handlers.get(channel);
    if (!channelHandlers) {
      return;
    }

    if (handler) {
      channelHandlers.delete(handler);
      if (channelHandlers.size > 0) {
        return;
      }
    } else {
      channelHandlers.clear();
    }

    this.handlers.delete(channel);
    await this.subscriber.unsubscribe(channel);
  }

  async close(): Promise<void> {
    this.handlers.clear();
    await this.subscriber.quit();
  }
}