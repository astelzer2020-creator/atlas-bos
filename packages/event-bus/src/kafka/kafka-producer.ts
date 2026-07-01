import type { Kafka, Producer, ProducerRecord } from 'kafkajs';

import type { CloudEvent } from '../cloudevents/envelope.js';
import { buildPartitionKey, eventTypeToTopic } from './topic-naming.js';

export interface PublishOptions {
  readonly partitionKey?: string;
}

export interface KafkaProducerAdapter {
  readonly isMock: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(event: CloudEvent, options?: PublishOptions): Promise<void>;
}

export interface AtlasKafkaProducerOptions {
  readonly mock?: boolean;
}

/** No-op producer used when Kafka is unavailable (tests, local dev). */
export class NoOpKafkaProducer implements KafkaProducerAdapter {
  readonly isMock = true;
  private readonly published: CloudEvent[] = [];

  connect(): Promise<void> {
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    return Promise.resolve();
  }

  publish(event: CloudEvent, _options?: PublishOptions): Promise<void> {
    this.published.push(event);
    return Promise.resolve();
  }

  /** Returns events published while in mock mode (for test assertions). */
  getPublishedEvents(): readonly CloudEvent[] {
    return this.published;
  }

  clearPublishedEvents(): void {
    this.published.length = 0;
  }
}

/** Kafka producer that publishes CloudEvents to typed Atlas topics. */
export class AtlasKafkaProducer implements KafkaProducerAdapter {
  readonly isMock = false;
  private readonly producer: Producer;
  private connected = false;

  constructor(kafka: Kafka) {
    this.producer = kafka.producer({
      allowAutoTopicCreation: false,
    });
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.producer.connect();
      this.connected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.producer.disconnect();
      this.connected = false;
    }
  }

  async publish(event: CloudEvent, options: PublishOptions = {}): Promise<void> {
    const topic = eventTypeToTopic(event.type);
    const key =
      options.partitionKey ??
      buildPartitionKey(event.data.organizationId, event.data.aggregate.id);

    const record: ProducerRecord = {
      topic,
      messages: [
        {
          key,
          value: JSON.stringify(event),
          headers: {
            'ce-specversion': event.specversion,
            'ce-id': event.id,
            'ce-type': event.type,
            'ce-source': event.source,
            'ce-time': event.time,
            'ce-subject': event.subject,
            'atlas-organization-id': event.atlasorganizationid,
            'atlas-workspace-id': event.atlasworkspaceid,
            'atlas-trace-id': event.atlastraceid,
          },
        },
      ],
    };

    await this.producer.send(record);
  }
}

/** Creates a Kafka producer, falling back to no-op when mock mode is enabled. */
export function createKafkaProducer(
  kafka: Kafka | null | undefined,
  options: AtlasKafkaProducerOptions = {},
): KafkaProducerAdapter {
  if (options.mock || kafka === null || kafka === undefined) {
    return new NoOpKafkaProducer();
  }

  return new AtlasKafkaProducer(kafka);
}