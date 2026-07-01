import type { WorkerContainer } from '../di/container.js';
import { outboxEventToCloudEvent } from '../lib/outbox-to-cloudevent.js';
import type { WorkerProcessor } from './types.js';

const WORKER_NAME = 'outbox-publisher';
const LOCKED_BY = 'atlas-worker-outbox-publisher';

export function createOutboxPublisherWorker(container: WorkerContainer): WorkerProcessor {
  const log = container.logger.child({ worker: WORKER_NAME });
  let interval: ReturnType<typeof setInterval> | null = null;
  let polling = false;

  const pollOnce = async (): Promise<void> => {
    if (polling) {
      return;
    }

    polling = true;

    try {
      const pollResult = await container.audit.outboxService.pollPendingEvents({
        lockedBy: LOCKED_BY,
        limit: 100,
      });

      if (!pollResult.ok) {
        log.warn('Outbox poll failed', { error: pollResult.error.message });
        return;
      }

      const events = pollResult.value;

      if (events.length === 0) {
        return;
      }

      log.debug('Publishing outbox events', { count: events.length });

      for (const event of events) {
        const cloudEvent = outboxEventToCloudEvent(event);

        if (cloudEvent === null) {
          log.debug('Skipping platform-scoped outbox event', { outboxId: event.id });
          const markResult = await container.audit.outboxService.markPublished(event.id);
          if (!markResult.ok) {
            log.error('Failed to mark skipped outbox event as published', {
              outboxId: event.id,
              error: markResult.error.message,
            });
          }
          continue;
        }

        try {
          await container.eventBus.publish(cloudEvent);

          const markResult = await container.audit.outboxService.markPublished(event.id);
          if (!markResult.ok) {
            log.error('Failed to mark outbox event as published', {
              outboxId: event.id,
              error: markResult.error.message,
            });
          }
        } catch (error) {
          log.error('Failed to publish outbox event', {
            outboxId: event.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } finally {
      polling = false;
    }
  };

  return {
    name: WORKER_NAME,
    async start(): Promise<void> {
      log.info('Starting outbox publisher worker', {
        intervalMs: container.config.outboxPollIntervalMs,
        kafkaMock: container.eventBus.isMockMode(),
      });

      await pollOnce();
      interval = setInterval(() => {
        void pollOnce();
      }, container.config.outboxPollIntervalMs);
    },
    async stop(): Promise<void> {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
      log.info('Stopped outbox publisher worker');
    },
  };
}