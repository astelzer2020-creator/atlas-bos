import { createAutomationModule } from '@atlas/module-automation';
import { createAiModule } from '@atlas/module-ai';
import { createAuditModule } from '@atlas/module-audit';
import { createCrmModule } from '@atlas/module-crm';
import { createFinanceModule } from '@atlas/module-finance';
import { createProjectsModule } from '@atlas/module-projects';
import { createWorkflowModule } from '@atlas/module-workflow';
import { createNotificationsModule } from '@atlas/module-notifications';
import { createStorageModule } from '@atlas/module-storage';
import { createTenantIdentityModule } from '@atlas/module-tenant-identity';
import { AtlasEventBus, createKafkaProducer, RedisPubSub } from '@atlas/event-bus';
import { AtlasQueueManager } from '@atlas/queue';
import {
  createJwtService,
  createLogger,
  createNoopMetricsCollector,
  createPasswordHasher,
} from '@atlas/platform';
import type { PrismaClient } from '@atlas/database';
import { afterEach, describe, expect, it } from 'vitest';

import type { WorkerConfig } from '../src/config.js';
import type { WorkerContainer } from '../src/di/container.js';
import { createHealthServer } from '../src/health.js';

class InMemoryPubSubRedis {
  async publish(): Promise<number> {
    return 0;
  }

  duplicate(): InMemoryPubSubRedis {
    return this;
  }

  on(): void {
    return;
  }

  async subscribe(): Promise<number> {
    return 0;
  }

  async unsubscribe(): Promise<number> {
    return 0;
  }

  async quit(): Promise<'OK'> {
    return 'OK';
  }
}

async function createTestContainer(): Promise<WorkerContainer> {
  const config: WorkerConfig = {
    nodeEnv: 'test',
    databaseUrl: 'postgresql://test:test@localhost:5432/test',
    jwtSecret: 'test-secret-minimum-32-characters-long',
    jwtAccessTtlSeconds: 900,
    jwtRefreshTtlSeconds: 604_800,
    redisUrl: 'redis://localhost:6379',
    apiPort: 3001,
    apiHost: '0.0.0.0',
    corsOrigins: ['http://localhost:3000'],
    bcryptRounds: 12,
    kafkaClientId: 'atlas-worker-test',
    workerId: 'test-worker',
    workerPort: 3002,
    workerHost: '127.0.0.1',
    prometheusEnabled: false,
    kafkaBrokers: ['localhost:9092'],
    kafkaGroupId: 'atlas-worker-test-consumers',
    kafkaMock: true,
    outboxPollIntervalMs: 5000,
    scheduledJobsIntervalMs: 60_000,
  };

  const logger = createLogger({ service: 'atlas-worker-test', level: 'error' });
  const jwtService = createJwtService({
    secret: config.jwtSecret,
    accessTtlSeconds: config.jwtAccessTtlSeconds,
    refreshTtlSeconds: config.jwtRefreshTtlSeconds,
  });
  const passwordHasher = createPasswordHasher({ algorithm: 'bcrypt', bcryptRounds: 10 });

  const prisma = {
    $queryRaw: async () => [{ '?column?': 1 }],
    $disconnect: async () => undefined,
  } as unknown as PrismaClient;

  const tenantIdentity = createTenantIdentityModule({
    prisma,
    passwordHasher,
    accessTtlSeconds: config.jwtAccessTtlSeconds,
    jwt: {
      secret: config.jwtSecret,
      accessTtlSeconds: config.jwtAccessTtlSeconds,
      refreshTtlSeconds: config.jwtRefreshTtlSeconds,
    },
  });

  const notifications = createNotificationsModule({
    prisma,
    logger: logger.child({ module: 'notifications' }),
  });

  const storage = await createStorageModule({ prisma });
  const audit = createAuditModule({ prisma });
  const workflow = createWorkflowModule({
    prisma,
    logger: logger.child({ module: 'workflow' }),
  });
  const automation = createAutomationModule({ prisma });
  const ai = createAiModule({ prisma });
  const crm = createCrmModule({
    prisma,
    logger: logger.child({ module: 'crm' }),
  });
  const projects = createProjectsModule({
    prisma,
    logger: logger.child({ module: 'projects' }),
  });
  const finance = createFinanceModule({
    prisma,
    logger: logger.child({ module: 'finance' }),
  });

  const producer = createKafkaProducer(null, { mock: true });
  const pubsub = new RedisPubSub(new InMemoryPubSubRedis() as never);
  const eventBus = new AtlasEventBus(producer, pubsub, { localFanout: false });

  return {
    config,
    logger,
    prisma,
    jwtService,
    passwordHasher,
    metrics: createNoopMetricsCollector(),
    queueManager: {
      close: async () => undefined,
      registerProcessor: () => undefined,
      enqueue: async () => 'test-job-id',
      getQueue: () => {
        throw new Error('Queue not available in health tests');
      },
    } as unknown as AtlasQueueManager,
    eventBus,
    kafkaConsumer: null,
    tenantIdentity,
    notifications,
    storage,
    audit,
    workflow,
    automation,
    ai,
    crm,
    projects,
    finance,
  };
}

async function request(
  port: number,
  path: string,
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  const body = (await response.json()) as Record<string, unknown>;
  return { statusCode: response.status, body };
}

describe('health endpoints', () => {
  let container: WorkerContainer;
  let healthServer: ReturnType<typeof createHealthServer> | undefined;

  afterEach(async () => {
    if (healthServer !== undefined) {
      await healthServer.stop();
      await container.eventBus.disconnect();
      await container.queueManager.close();
      healthServer = undefined;
    }
  });

  it('GET /health returns ok status', async () => {
    container = await createTestContainer();
    healthServer = createHealthServer({ container, skipReadyCheck: true });
    await healthServer.start();

    const response = await request(container.config.workerPort, '/health');

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('atlas-worker');
  });

  it('GET /ready returns ready when database check is skipped', async () => {
    container = await createTestContainer();
    healthServer = createHealthServer({ container, skipReadyCheck: true });
    await healthServer.start();

    const response = await request(container.config.workerPort, '/ready');

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('ready');
    expect((response.body.checks as { database: string }).database).toBe('skipped');
  });
});