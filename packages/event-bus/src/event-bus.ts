import type { CloudEvent } from './cloudevents/envelope.js';
import type { KafkaProducerAdapter, PublishOptions } from './kafka/kafka-producer.js';
import { eventTypeToTopic } from './kafka/topic-naming.js';
import type { RedisPubSub } from './redis/redis-pubsub.js';

export interface AtlasEventBusOptions {
  /** When true (default), also fan out via Redis pub/sub for local subscribers. */
  readonly localFanout?: boolean;
}

/**
 * Facade combining Kafka publish with Redis pub/sub for hybrid event distribution.
 */
export class AtlasEventBus {
  private readonly producer: KafkaProducerAdapter;
  private readonly pubsub: RedisPubSub;
  private readonly localFanout: boolean;

  constructor(
    producer: KafkaProducerAdapter,
    pubsub: RedisPubSub,
    options: AtlasEventBusOptions = {},
  ) {
    this.producer = producer;
    this.pubsub = pubsub;
    this.localFanout = options.localFanout ?? true;
  }

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
    await this.pubsub.close();
  }

  /** Publishes an event to Kafka and optionally fans out locally via Redis. */
  async publish(event: CloudEvent, options?: PublishOptions): Promise<void> {
    await this.producer.publish(event, options);

    if (this.localFanout) {
      const channel = eventTypeToTopic(event.type);
      await this.pubsub.publish(channel, JSON.stringify(event));
    }
  }

  /** Returns whether the underlying Kafka producer is in mock/no-op mode. */
  isMockMode(): boolean {
    return this.producer.isMock;
  }
}