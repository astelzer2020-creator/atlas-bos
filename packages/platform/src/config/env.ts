import { hostname } from 'node:os';

import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'staging', 'production']);

const envSchema = z
  .object({
    NODE_ENV: nodeEnvSchema.default('development'),
    DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(604_800),
    REDIS_URL: z.string().url().or(z.string().startsWith('redis://')),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    API_HOST: z.string().min(1).default('0.0.0.0'),
    CORS_ORIGINS: z.string().min(1),
    BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
    KAFKA_BROKERS: z.string().min(1).default('localhost:9092'),
    KAFKA_CLIENT_ID: z.string().min(1).default('atlas'),
    WORKER_ID: z.string().min(1).optional(),
    WORKER_PORT: z.coerce.number().int().min(1).max(65_535).default(3002),
    WORKER_HOST: z.string().min(1).default('0.0.0.0'),
    PROMETHEUS_ENABLED: z.coerce.boolean().default(false),
  })
  .transform((raw) => ({
    nodeEnv: raw.NODE_ENV,
    databaseUrl: raw.DATABASE_URL,
    jwtSecret: raw.JWT_SECRET,
    jwtAccessTtlSeconds: raw.JWT_ACCESS_TTL_SECONDS,
    jwtRefreshTtlSeconds: raw.JWT_REFRESH_TTL_SECONDS,
    redisUrl: raw.REDIS_URL,
    apiPort: raw.API_PORT,
    apiHost: raw.API_HOST,
    corsOrigins: raw.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    bcryptRounds: raw.BCRYPT_ROUNDS,
    kafkaBrokers: raw.KAFKA_BROKERS,
    kafkaClientId: raw.KAFKA_CLIENT_ID,
    workerId: raw.WORKER_ID ?? hostname(),
    workerPort: raw.WORKER_PORT,
    workerHost: raw.WORKER_HOST,
    prometheusEnabled: raw.PROMETHEUS_ENABLED,
  }));

export type NodeEnv = z.infer<typeof nodeEnvSchema>;
export type AppConfig = z.infer<typeof envSchema>;

export class ConfigValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid environment configuration:\n${issues.join('\n')}`);
    this.name = 'ConfigValidationError';
    this.issues = issues;
  }
}

/**
 * Loads and validates process environment variables into a typed configuration object.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => {
      const path = issue.path.join('.') || 'environment';
      return `${path}: ${issue.message}`;
    });
    throw new ConfigValidationError(issues);
  }

  return parsed.data;
}