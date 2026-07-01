import { Queue, type ConnectionOptions, type Job } from 'bullmq';

import { DLQ_RETENTION_SECONDS } from '../config/queue-config.js';
import type { RedisConnection } from '../connection/redis-connection.js';
import type { JobEnvelope } from '../types/job-envelope.js';

/** Returns the dead-letter queue name for a source queue (`{queue}:dlq`). */
export function dlqQueueName(queue: string): string {
  return `${queue}:dlq`;
}

export interface DlqErrorInfo {
  readonly message: string;
  readonly stack?: string;
  readonly code?: string;
}

/** Entry stored in the dead-letter queue after max retry exhaustion. */
export interface DlqEntry {
  readonly originalJob: JobEnvelope;
  readonly failedAt: string;
  readonly lastError: DlqErrorInfo;
  readonly attempts: number;
}

function toDlqErrorInfo(error: Error): DlqErrorInfo {
  const info: DlqErrorInfo = {
    message: error.message,
  };

  if (error.stack !== undefined && 'code' in error && typeof error.code === 'string') {
    return { message: error.message, stack: error.stack, code: error.code };
  }

  if (error.stack !== undefined) {
    return { message: error.message, stack: error.stack };
  }

  if ('code' in error && typeof error.code === 'string') {
    return { message: error.message, code: error.code };
  }

  return info;
}

/** Moves a permanently failed job into the queue's dead-letter queue. */
export async function moveFailedJobToDlq(
  sourceQueueName: string,
  connection: RedisConnection,
  job: Job<JobEnvelope>,
  error: Error,
): Promise<void> {
  const dlq = new Queue(dlqQueueName(sourceQueueName), {
    connection: connection as ConnectionOptions,
  });

  const entry: DlqEntry = {
    originalJob: job.data,
    failedAt: new Date().toISOString(),
    lastError: toDlqErrorInfo(error),
    attempts: job.attemptsMade,
  };

  await dlq.add('dlq-entry', entry, {
    jobId: `${job.id ?? job.data.jobId}-dlq`,
    removeOnComplete: { age: DLQ_RETENTION_SECONDS },
    removeOnFail: false,
  });

  await dlq.close();
}

export interface ListDlqJobsOptions {
  readonly start?: number;
  readonly end?: number;
}

/** Lists DLQ entries for a source queue. */
export async function listDlqJobs(
  queue: string,
  connection: RedisConnection,
  options: ListDlqJobsOptions = {},
): Promise<DlqEntry[]> {
  const start = options.start ?? 0;
  const end = options.end ?? 50;

  const dlq = new Queue(dlqQueueName(queue), { connection: connection as ConnectionOptions });
  const jobs = await dlq.getJobs(['waiting', 'delayed', 'active', 'completed', 'failed'], start, end);
  const entries = jobs.map((job) => job.data as DlqEntry);
  await dlq.close();
  return entries;
}

/** Re-enqueues a DLQ entry back onto the source queue and removes it from the DLQ. */
export async function replayDlqJob(
  queue: string,
  dlqJobId: string,
  connection: RedisConnection,
): Promise<string> {
  const dlq = new Queue(dlqQueueName(queue), { connection: connection as ConnectionOptions });
  const source = new Queue(queue, { connection: connection as ConnectionOptions });

  const dlqJob = await dlq.getJob(dlqJobId);
  if (!dlqJob) {
    await dlq.close();
    await source.close();
    throw new Error(`DLQ job not found: ${dlqJobId}`);
  }

  const entry = dlqJob.data as DlqEntry;
  const replayed = await source.add(entry.originalJob.jobName, entry.originalJob, {
    jobId: entry.originalJob.jobId,
    attempts: entry.originalJob.maxAttempts,
  });

  await dlqJob.remove();
  await dlq.close();
  await source.close();

  return replayed.id ?? entry.originalJob.jobId;
}