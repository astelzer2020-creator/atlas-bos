import {
  Queue,
  Worker,
  type ConnectionOptions,
  type Job,
  type JobsOptions,
  type Processor,
} from 'bullmq';
import { ulid } from 'ulid';

import { createRedisConnection, type RedisConnection } from './connection/redis-connection.js';
import { moveFailedJobToDlq } from './dlq/dlq-handler.js';
import { resolveJobTimeout, resolveRetryOptions } from './retry/retry-policy.js';
import {
  buildJobEnvelope,
  validateJobEnvelope,
  type BuildJobEnvelopeInput,
  type JobEnvelope,
} from './types/job-envelope.js';

export interface EnqueueOptions {
  readonly delay?: number;
  readonly priority?: number;
  readonly jobId?: string;
  readonly idempotencyKey?: string;
  readonly organizationId?: string | null;
  readonly workspaceId?: string | null;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly maxAttempts?: number;
}

export interface AtlasQueueManagerOptions {
  readonly redisUrl: string;
  readonly connection?: RedisConnection;
  readonly workerId?: string;
}

export interface RegisterProcessorOptions {
  readonly concurrency?: number;
}

/**
 * Central manager for Atlas BullMQ queues — enqueue, process, and lifecycle.
 */
export class AtlasQueueManager {
  private readonly connection: RedisConnection;
  private readonly ownsConnection: boolean;
  private readonly workerId: string;
  private readonly queues = new Map<string, Queue>();
  private readonly workers = new Map<string, Worker<JobEnvelope>>();

  constructor(options: AtlasQueueManagerOptions) {
    this.connection = options.connection ?? createRedisConnection(options.redisUrl);
    this.ownsConnection = options.connection === undefined;
    this.workerId = options.workerId ?? 'atlas-worker';
  }

  /**
   * Enqueues a job with a validated envelope and per-queue retry defaults.
   * Duplicate idempotency keys within the queue return the existing job id.
   */
  async enqueue(
    queue: string,
    jobName: string,
    payload: Record<string, unknown>,
    options: EnqueueOptions = {},
  ): Promise<string> {
    const targetQueue = this.getQueue(queue);
    const retryOptions = resolveRetryOptions(queue);

    const envelope = buildJobEnvelope({
      queue,
      jobName,
      payload,
      organizationId: options.organizationId ?? null,
      correlationId: options.correlationId ?? ulid(),
      maxAttempts: options.maxAttempts ?? retryOptions.attempts ?? 5,
      ...(options.workspaceId !== undefined ? { workspaceId: options.workspaceId } : {}),
      ...(options.causationId !== undefined ? { causationId: options.causationId } : {}),
      ...(options.idempotencyKey !== undefined ? { idempotencyKey: options.idempotencyKey } : {}),
      ...(options.jobId !== undefined ? { jobId: options.jobId } : {}),
    } satisfies BuildJobEnvelopeInput<Record<string, unknown>>);

    const validation = validateJobEnvelope(envelope);
    if (!validation.ok) {
      throw validation.error;
    }

    if (options.idempotencyKey) {
      const existing = await targetQueue.getJob(options.idempotencyKey);
      if (existing) {
        return existing.id ?? envelope.jobId;
      }
    }

    const jobOptions: JobsOptions = {
      ...retryOptions,
      jobId: options.idempotencyKey ?? envelope.jobId,
    };

    if (options.delay !== undefined) {
      jobOptions.delay = options.delay;
    }

    if (options.priority !== undefined) {
      jobOptions.priority = options.priority;
    }

    const job = await targetQueue.add(jobName, envelope, jobOptions);
    return job.id ?? envelope.jobId;
  }

  /** Registers a BullMQ worker processor for the given queue. */
  registerProcessor(
    queue: string,
    processor: Processor<JobEnvelope>,
    options: RegisterProcessorOptions = {},
  ): Worker<JobEnvelope> {
    if (this.workers.has(queue)) {
      throw new Error(`Processor already registered for queue: ${queue}`);
    }

    const concurrency = options.concurrency ?? 1;
    const timeoutMs = resolveJobTimeout(queue);

    const worker = new Worker<JobEnvelope>(
      queue,
      async (job: Job<JobEnvelope>) => {
        let timer: ReturnType<typeof setTimeout> | undefined;

        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`Job timed out after ${String(timeoutMs)}ms`));
          }, timeoutMs);
        });

        try {
          await Promise.race([processor(job), timeoutPromise]);
        } finally {
          if (timer !== undefined) {
            clearTimeout(timer);
          }
        }
      },
      {
        connection: this.connection as ConnectionOptions,
        concurrency,
        name: this.workerId,
      },
    );

    worker.on('failed', (job, error) => {
      if (!job) {
        return;
      }

      const maxAttempts = job.opts.attempts ?? 1;
      if (job.attemptsMade >= maxAttempts) {
        void moveFailedJobToDlq(queue, this.connection, job, error).catch(() => {
          // DLQ move failures are logged by the worker host; avoid unhandled rejection.
        });
      }
    });

    this.workers.set(queue, worker);
    return worker;
  }

  /** Returns (or lazily creates) a BullMQ queue instance. */
  getQueue(name: string): Queue {
    const existing = this.queues.get(name);
    if (existing) {
      return existing;
    }

    const queue = new Queue(name, {
      connection: this.connection as ConnectionOptions,
      defaultJobOptions: resolveRetryOptions(name),
    });

    this.queues.set(name, queue);
    return queue;
  }

  /** Gracefully closes all workers, queues, and the Redis connection. */
  async close(): Promise<void> {
    await Promise.all([...this.workers.values()].map((worker) => worker.close()));
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));

    if (this.ownsConnection) {
      await this.connection.quit();
    }

    this.workers.clear();
    this.queues.clear();
  }
}