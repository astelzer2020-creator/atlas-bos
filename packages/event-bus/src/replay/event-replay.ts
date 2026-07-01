import type { Kafka, Consumer } from 'kafkajs';

import { parseCloudEvent, type CloudEvent } from '../cloudevents/envelope.js';

export type ReplayHandler = (event: CloudEvent, offset: string) => Promise<void>;

export interface ReplayEventsOptions {
  readonly groupId?: string;
  readonly partition?: number;
}

/**
 * Replays events from a Kafka topic starting at a given offset.
 * Used for consumer recovery and audit reprocessing.
 */
export async function replayEventsFromOffset(
  kafka: Kafka,
  topic: string,
  fromOffset: string,
  handler: ReplayHandler,
  options: ReplayEventsOptions = {},
): Promise<number> {
  const groupId = options.groupId ?? `atlas-replay-${String(Date.now())}`;
  const consumer: Consumer = kafka.consumer({ groupId });

  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });

  let processed = 0;
  const targetOffset = BigInt(fromOffset);

  await consumer.run({
    eachMessage: async ({ partition, message }) => {
      if (options.partition !== undefined && partition !== options.partition) {
        return;
      }

      const offset = BigInt(message.offset);
      if (offset < targetOffset) {
        return;
      }

      const raw = message.value?.toString();
      if (!raw) {
        return;
      }

      const parsed = parseCloudEvent(JSON.parse(raw) as unknown);
      if (!parsed.ok) {
        return;
      }

      await handler(parsed.value, message.offset);
      processed += 1;
    },
  });

  await consumer.stop();
  await consumer.disconnect();

  return processed;
}