import { createAiExecutorWorker } from './ai-executor.worker.js';
import { createAutomationMatcherWorker } from './automation-matcher.worker.js';
import { createNotificationDeliveryWorker } from './notification-delivery.worker.js';
import { createOutboxPublisherWorker } from './outbox-publisher.worker.js';
import { createScheduledJobsWorker } from './scheduled-jobs.worker.js';
import type { WorkerProcessor } from './types.js';
import { createWorkflowRuntimeWorker } from './workflow-runtime.worker.js';
import type { WorkerContainer } from '../di/container.js';

export function registerAllWorkers(container: WorkerContainer): WorkerProcessor[] {
  return [
    createOutboxPublisherWorker(container),
    createWorkflowRuntimeWorker(container),
    createAutomationMatcherWorker(container),
    createAiExecutorWorker(container),
    createNotificationDeliveryWorker(container),
    createScheduledJobsWorker(container),
  ];
}

export type { WorkerProcessor } from './types.js';