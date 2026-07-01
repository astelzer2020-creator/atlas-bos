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
import {
  createJwtService,
  createLogger,
  createNoopMetricsCollector,
  createPasswordHasher,
} from '@atlas/platform';
import type { PrismaClient } from '@atlas/database';
import { afterAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import type { AppContainer } from '../src/di/container.js';

async function createTestContainer(): Promise<AppContainer> {
  const config = {
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
    kafkaClientId: 'atlas-api-test',
    workerId: 'test-worker',
    workerPort: 3002,
    workerHost: '0.0.0.0',
    prometheusEnabled: false,
  };

  const logger = createLogger({ service: 'atlas-api-test', level: 'error' });
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

describe('health endpoints', () => {
  let container: AppContainer;
  let app: Awaited<ReturnType<typeof createApp>>;

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /health returns ok status', async () => {
    container = await createTestContainer();
    app = await createApp({ container, skipReadyCheck: true });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json() as { status: string; service: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('atlas-api');
  });

  it('GET /ready returns ready when database check is skipped', async () => {
    container = await createTestContainer();
    app = await createApp({ container, skipReadyCheck: true });

    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json() as { status: string; checks: { database: string } };
    expect(body.status).toBe('ready');
    expect(body.checks.database).toBe('skipped');
  });
});