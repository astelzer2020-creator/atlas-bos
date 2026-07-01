import { createAutomationModule } from '@atlas/module-automation';
import { createAiModule } from '@atlas/module-ai';
import { createAiMemoryModule } from '@atlas/module-ai-memory';
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

import type { AppContainer } from '../../../api/src/di/container.js';
import type { WorkerConfig } from '../../../worker/src/config.js';
import type { WorkerContainer } from '../../../worker/src/di/container.js';

class InMemoryPubSubRedis {
  private readonly messageListeners: Array<(channel: string, message: string) => void> = [];
  private readonly subscribedChannels = new Set<string>();

  duplicate(): InMemoryPubSubRedis {
    const duplicate = new InMemoryPubSubRedis();
    duplicate.messageListeners.push(...this.messageListeners);
    return duplicate;
  }

  on(event: string, handler: (channel: string, message: string) => void): void {
    if (event === 'message') {
      this.messageListeners.push(handler);
    }
  }

  async subscribe(channel: string): Promise<number> {
    this.subscribedChannels.add(channel);
    return 1;
  }

  async unsubscribe(channel: string): Promise<number> {
    this.subscribedChannels.delete(channel);
    return 1;
  }

  async publish(channel: string, message: string): Promise<number> {
    if (!this.subscribedChannels.has(channel)) {
      return 0;
    }

    for (const listener of this.messageListeners) {
      listener(channel, message);
    }

    return this.messageListeners.length;
  }

  async quit(): Promise<'OK'> {
    return 'OK';
  }
}

function createMockPrisma(): PrismaClient {
  return {
    $queryRaw: async () => [{ '?column?': 1 }],
    $disconnect: async () => undefined,
  } as unknown as PrismaClient;
}

function createBaseConfig(prometheusEnabled: boolean) {
  return {
    nodeEnv: 'test' as const,
    databaseUrl: 'postgresql://test:test@localhost:5432/test',
    jwtSecret: 'test-secret-minimum-32-characters-long',
    jwtAccessTtlSeconds: 900,
    jwtRefreshTtlSeconds: 604_800,
    redisUrl: 'redis://localhost:6379',
    apiPort: 3001,
    apiHost: '0.0.0.0',
    corsOrigins: ['http://localhost:3000'],
    bcryptRounds: 12,
    kafkaBrokers: 'localhost:9092',
    kafkaClientId: 'atlas-integration-test',
    workerId: 'integration-test-worker',
    workerPort: 0,
    workerHost: '127.0.0.1',
    prometheusEnabled,
  };
}

export async function createMockApiContainer(
  prometheusEnabled = false,
): Promise<AppContainer> {
  const config = createBaseConfig(prometheusEnabled);
  const logger = createLogger({ service: 'atlas-api-integration', level: 'error' });
  const jwtService = createJwtService({
    secret: config.jwtSecret,
    accessTtlSeconds: config.jwtAccessTtlSeconds,
    refreshTtlSeconds: config.jwtRefreshTtlSeconds,
  });
  const passwordHasher = createPasswordHasher({ algorithm: 'bcrypt', bcryptRounds: 10 });
  const prisma = createMockPrisma();

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
  const aiMemory = createAiMemoryModule({
    prisma,
    logger: logger.child({ module: 'ai-memory' }),
  });
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

  return {
    config,
    logger,
    prisma,
    jwtService,
    passwordHasher,
    metrics: createNoopMetricsCollector(),
    tenantIdentity,
    notifications,
    storage,
    audit,
    workflow,
    automation,
    ai,
    aiMemory,
    crm,
    projects,
    finance,
  };
}

export async function createMockWorkerContainer(workerPort = 0): Promise<WorkerContainer> {
  const base = createBaseConfig(false);
  const config: WorkerConfig = {
    ...base,
    workerPort,
    kafkaBrokers: ['localhost:9092'],
    kafkaGroupId: 'atlas-integration-test-consumers',
    kafkaMock: true,
    outboxPollIntervalMs: 5000,
    scheduledJobsIntervalMs: 60_000,
  };

  const logger = createLogger({ service: 'atlas-worker-integration', level: 'error' });
  const jwtService = createJwtService({
    secret: config.jwtSecret,
    accessTtlSeconds: config.jwtAccessTtlSeconds,
    refreshTtlSeconds: config.jwtRefreshTtlSeconds,
    issuer: 'atlas-worker',
    audience: 'atlas',
  });
  const passwordHasher = createPasswordHasher({ algorithm: 'bcrypt', bcryptRounds: 10 });
  const prisma = createMockPrisma();

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
        throw new Error('Queue not available in mock worker container');
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