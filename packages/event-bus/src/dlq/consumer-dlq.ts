import type { Kafka } from 'kafkajs';

import { consumerDlqTopic } from '../kafka/topic-naming.js';

export interface DlqPayload {
  readonly failedAt: string;
  readonly consumerGroupId: string;
  readonly originalEvent: unknown;
  readonly error: {
    readonly message: string;
    readonly stack?: string;
    readonly name: string;
  };
}

function toDlqError(error: Error): DlqPayload['error'] {
  const info: DlqPayload['error'] = {
    message: error.message,
    name: error.name,
  };

  if (error.stack !== undefined) {
    return { ...info, stack: error.stack };
  }

  return info;
}

/** Publishes a failed consumer event to the consumer group's dead-letter topic. */
export async function publishToDlq(
  kafka: Kafka,
  consumerGroupId: string,
  failedEvent: unknown,
  error: Error,
): Promise<void> {
  const producer = kafka.producer({ allowAutoTopicCreation: false });
  const topic = consumerDlqTopic(consumerGroupId);

  const payload: DlqPayload = {
    failedAt: new Date().toISOString(),
    consumerGroupId,
    originalEvent: failedEvent,
    error: toDlqError(error),
  };

  try {
    await producer.connect();
    await producer.send({
      topic,
      messages: [
        {
          value: JSON.stringify(payload),
          headers: {
            'atlas-dlq-consumer-group': consumerGroupId,
            'atlas-dlq-error': error.message,
          },
        },
      ],
    });
  } finally {
    await producer.disconnect();
  }
}