import type { Consumer, EachMessagePayload, Kafka } from 'kafkajs';

import { parseCloudEvent, type CloudEvent } from '../cloudevents/envelope.js';
import { publishToDlq } from '../dlq/consumer-dlq.js';

export type MessageHandler = (event: CloudEvent) => Promise<void>;

export interface AtlasKafkaConsumerOptions {
  readonly groupId: string;
  readonly fromBeginning?: boolean;
  readonly dlqOnFailure?: boolean;
}

/** Kafka consumer that deserializes CloudEvents and routes failures to DLQ. */
export class AtlasKafkaConsumer {
  private readonly consumer: Consumer;
  private readonly options: AtlasKafkaConsumerOptions;
  private readonly dlqProducer: Kafka;
  private handler: MessageHandler | undefined;
  private connected = false;

  constructor(kafka: Kafka, options: AtlasKafkaConsumerOptions) {
    this.consumer = kafka.consumer({ groupId: options.groupId });
    this.dlqProducer = kafka;
    this.options = options;
  }

  /** Registers the message handler invoked for each consumed event. */
  onMessage(handler: MessageHandler): void {
    this.handler = handler;
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.consumer.connect();
      this.connected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.consumer.disconnect();
      this.connected = false;
    }
  }

  /** Subscribes to topics and begins consuming messages. */
  async subscribe(topics: readonly (string | RegExp)[]): Promise<void> {
    if (!this.handler) {
      throw new Error('Message handler not registered. Call onMessage() first.');
    }

    await this.consumer.subscribe({
      topics: [...topics],
      fromBeginning: this.options.fromBeginning ?? false,
    });

    const handler = this.handler;

    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        const raw = payload.message.value?.toString();
        if (!raw) {
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(raw) as unknown;
        } catch (error) {
          if (this.options.dlqOnFailure !== false) {
            await publishToDlq(this.dlqProducer, this.options.groupId, raw, error as Error);
          }
          return;
        }

        const result = parseCloudEvent(parsed);
        if (!result.ok) {
          if (this.options.dlqOnFailure !== false) {
            await publishToDlq(
              this.dlqProducer,
              this.options.groupId,
              parsed,
              result.error,
            );
          }
          return;
        }

        try {
          await handler(result.value);
        } catch (error) {
          if (this.options.dlqOnFailure !== false) {
            await publishToDlq(
              this.dlqProducer,
              this.options.groupId,
              result.value,
              error as Error,
            );
          }
        }
      },
    });
  }
}