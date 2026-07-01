import { ConfigValidationError, loadConfig, type AppConfig } from '@atlas/platform';
import { z } from 'zod';

const workerEnvSchema = z
  .object({
    KAFKA_BROKERS: z.string().min(1).optional(),
    ATLAS_KAFKA_BROKERS: z.string().min(1).optional(),
    ATLAS_KAFKA_CLIENT_ID: z.string().min(1).optional(),
    ATLAS_KAFKA_GROUP_ID: z.string().min(1).default('atlas-worker-consumers'),
    KAFKA_MOCK: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
    SCHEDULED_JOBS_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  })
  .transform((raw) => {
    const brokersRaw = raw.KAFKA_BROKERS ?? raw.ATLAS_KAFKA_BROKERS ?? 'localhost:9092';

    return {
      kafkaBrokers: brokersRaw
        .split(',')
        .map((broker) => broker.trim())
        .filter((broker) => broker.length > 0),
      kafkaClientId: raw.ATLAS_KAFKA_CLIENT_ID,
      kafkaGroupId: raw.ATLAS_KAFKA_GROUP_ID,
      kafkaMock: raw.KAFKA_MOCK ?? false,
      outboxPollIntervalMs: raw.OUTBOX_POLL_INTERVAL_MS,
      scheduledJobsIntervalMs: raw.SCHEDULED_JOBS_INTERVAL_MS,
    };
  });

export interface WorkerConfig extends Omit<AppConfig, 'kafkaBrokers' | 'kafkaClientId'> {
  readonly kafkaBrokers: readonly string[];
  readonly kafkaClientId: string;
  readonly kafkaGroupId: string;
  readonly kafkaMock: boolean;
  readonly outboxPollIntervalMs: number;
  readonly scheduledJobsIntervalMs: number;
}

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const base = loadConfig(env);
  const parsed = workerEnvSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => {
      const path = issue.path.join('.') || 'environment';
      return `${path}: ${issue.message}`;
    });
    throw new ConfigValidationError(issues);
  }

  const kafkaMock = parsed.data.kafkaMock || base.nodeEnv === 'test';

  return {
    ...base,
    ...parsed.data,
    kafkaClientId: parsed.data.kafkaClientId ?? `${base.kafkaClientId}-worker`,
    kafkaMock,
  };
}
