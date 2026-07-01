import { JOB_NAMES, QUEUE_NAMES } from '@atlas/queue';

import type { WorkerContainer } from '../di/container.js';
import type { WorkerProcessor } from './types.js';

const WORKER_NAME = 'notification-delivery';

interface NotificationDeliverPayload {
  readonly limit?: number;
}

export function createNotificationDeliveryWorker(container: WorkerContainer): WorkerProcessor {
  const log = container.logger.child({ worker: WORKER_NAME });

  container.queueManager.registerProcessor(
    QUEUE_NAMES.EMAIL,
    async (job) => {
      if (job.name !== JOB_NAMES.NOTIFICATION_DELIVER) {
        return;
      }

      const payload = job.data.payload as unknown as NotificationDeliverPayload;
      const limit = payload.limit ?? 50;

      log.info('Processing notification delivery job', {
        jobId: job.id,
        limit,
      });

      const result = await container.notifications.deliveryService.processPendingDeliveries(limit);

      if (!result.ok) {
        throw new Error('Notification delivery processing failed');
      }

      log.info('Notification deliveries processed', {
        processed: result.value.processed,
        succeeded: result.value.succeeded,
        failed: result.value.failed,
      });
    },
    { concurrency: 20 },
  );

  return {
    name: WORKER_NAME,
    async start(): Promise<void> {
      log.info('Registered notification delivery processor', {
        queue: QUEUE_NAMES.EMAIL,
        jobName: JOB_NAMES.NOTIFICATION_DELIVER,
      });
    },
    async stop(): Promise<void> {
      log.info('Stopped notification delivery worker');
    },
  };
}