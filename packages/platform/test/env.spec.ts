import { afterEach, describe, expect, it } from 'vitest';

import { ConfigValidationError, loadConfig } from '../dist/config/env.js';

const BASE_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://atlas:password@localhost:5432/atlas',
  JWT_SECRET: 'test-secret-with-minimum-thirty-two-characters',
  JWT_ACCESS_TTL_SECONDS: '900',
  JWT_REFRESH_TTL_SECONDS: '604800',
  REDIS_URL: 'redis://localhost:6379',
  API_PORT: '3001',
  API_HOST: '127.0.0.1',
  CORS_ORIGINS: 'http://localhost:3000, http://localhost:3001',
  BCRYPT_ROUNDS: '12',
} as const;

describe('loadConfig', () => {
  afterEach(() => {
    delete process.env['NODE_ENV'];
    delete process.env['DATABASE_URL'];
    delete process.env['JWT_SECRET'];
    delete process.env['JWT_ACCESS_TTL_SECONDS'];
    delete process.env['JWT_REFRESH_TTL_SECONDS'];
    delete process.env['REDIS_URL'];
    delete process.env['API_PORT'];
    delete process.env['API_HOST'];
    delete process.env['CORS_ORIGINS'];
    delete process.env['BCRYPT_ROUNDS'];
  });

  it('parses valid environment variables into a typed config', () => {
    const config = loadConfig({ ...BASE_ENV });

    expect(config.nodeEnv).toBe('test');
    expect(config.databaseUrl).toBe(BASE_ENV.DATABASE_URL);
    expect(config.jwtSecret).toBe(BASE_ENV.JWT_SECRET);
    expect(config.jwtAccessTtlSeconds).toBe(900);
    expect(config.jwtRefreshTtlSeconds).toBe(604_800);
    expect(config.redisUrl).toBe(BASE_ENV.REDIS_URL);
    expect(config.apiPort).toBe(3001);
    expect(config.apiHost).toBe('127.0.0.1');
    expect(config.corsOrigins).toEqual(['http://localhost:3000', 'http://localhost:3001']);
    expect(config.bcryptRounds).toBe(12);
    expect(config.kafkaBrokers).toBe('localhost:9092');
    expect(config.kafkaClientId).toBe('atlas');
    expect(config.workerId.length).toBeGreaterThan(0);
    expect(config.workerPort).toBe(3002);
    expect(config.workerHost).toBe('0.0.0.0');
    expect(config.prometheusEnabled).toBe(false);
  });

  it('parses production observability and messaging settings', () => {
    const config = loadConfig({
      ...BASE_ENV,
      KAFKA_BROKERS: 'redpanda:9092',
      WORKER_PORT: '3002',
      WORKER_HOST: '0.0.0.0',
      PROMETHEUS_ENABLED: 'true',
    });

    expect(config.kafkaBrokers).toBe('redpanda:9092');
    expect(config.kafkaClientId).toBe('atlas');
    expect(config.workerPort).toBe(3002);
    expect(config.prometheusEnabled).toBe(true);
  });

  it('uses explicit WORKER_ID when provided', () => {
    const config = loadConfig({
      ...BASE_ENV,
      KAFKA_CLIENT_ID: 'atlas-worker',
      WORKER_ID: 'worker-pod-abc',
    });

    expect(config.kafkaClientId).toBe('atlas-worker');
    expect(config.workerId).toBe('worker-pod-abc');
  });

  it('throws ConfigValidationError when required values are invalid', () => {
    expect(() =>
      loadConfig({
        ...BASE_ENV,
        JWT_SECRET: 'too-short',
        BCRYPT_ROUNDS: '99',
      }),
    ).toThrow(ConfigValidationError);
  });
});