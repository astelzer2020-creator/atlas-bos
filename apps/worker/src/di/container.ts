import { createPrismaClient } from '@atlas/database';
import {
  AtlasEventBus,
  AtlasKafkaConsumer,
  createKafkaClient,
  createKafkaProducer,
  InMemoryPubSub,
  RedisPubSub,
} from '@atlas/event-bus';
import { createAuditModule, type AuditModule } from '@atlas/module-audit';
import { createAiModule, type AiModule } from '@atlas/module-ai';
import { createAutomationModule, type AutomationModule } from '@atlas/module-automation';
import { createAutomationActionPorts } from '../wiring/automation-action-ports.js';
import { createCrmModule, type CrmModule } from '@atlas/module-crm';
import { createFinanceModule, type FinanceModule } from '@atlas/module-finance';
import {
  createNotificationsModule,
  type NotificationsModule,
} from '@atlas/module-notifications';
import { createProjectsModule, type ProjectsModule } from '@atlas/module-projects';
import { createStorageModule, type StorageModule } from '@atlas/module-storage';
import {
  createTenantIdentityModule,
  type TenantIdentityModule,
} from '@atlas/module-tenant-identity';
import { createWorkflowModule, type WorkflowModule } from '@atlas/module-workflow';
import {
  createQueueManager,
  createRedisConnection,
  type AtlasQueueManagerLike,
} from '@atlas/queue';
import {
  createJwtService,
  createLogger,
  createNoopMetricsCollector,
  createPasswordHasher,
  type JwtService,
  type Logger,
  type MetricsCollector,
  type PasswordHasher,
} from '@atlas/platform';
import type { PrismaClient } from '@atlas/database';


import { loadWorkerConfig, type WorkerConfig } from '../config.js';

export interface WorkerContainer {
  readonly config: WorkerConfig;
  readonly logger: Logger;
  readonly prisma: PrismaClient;
  readonly jwtService: JwtService;
  readonly passwordHasher: PasswordHasher;
  readonly metrics: MetricsCollector;
  readonly queueManager: AtlasQueueManagerLike;
  readonly eventBus: AtlasEventBus;
  readonly kafkaConsumer: AtlasKafkaConsumer | null;
  readonly tenantIdentity: TenantIdentityModule;
  readonly notifications: NotificationsModule;
  readonly storage: StorageModule;
  readonly audit: AuditModule;
  readonly workflow: WorkflowModule;
  readonly automation: AutomationModule;
  readonly ai: AiModule;
  readonly crm: CrmModule;
  readonly projects: ProjectsModule;
  readonly finance: FinanceModule;
}

export async function createContainer(
  overrides?: Partial<WorkerContainer>,
): Promise<WorkerContainer> {
  const config = overrides?.config ?? loadWorkerConfig();
  const logger =
    overrides?.logger ??
    createLogger({
      service: 'atlas-worker',
      level: config.nodeEnv === 'production' ? 'info' : 'debug',
    });

  const prisma = overrides?.prisma ?? createPrismaClient(config.databaseUrl);

  const jwtService =
    overrides?.jwtService ??
    createJwtService({
      secret: config.jwtSecret,
      accessTtlSeconds: config.jwtAccessTtlSeconds,
      refreshTtlSeconds: config.jwtRefreshTtlSeconds,
      issuer: 'atlas-worker',
      audience: 'atlas',
    });

  const passwordHasher =
    overrides?.passwordHasher ??
    createPasswordHasher({
      algorithm: 'bcrypt',
      bcryptRounds: config.bcryptRounds,
    });

  const metrics = overrides?.metrics ?? createNoopMetricsCollector();

  const queueManager =
    overrides?.queueManager ??
    createQueueManager({
      redisUrl: config.redisUrl,
      workerId: 'atlas-worker',
    });

  let eventBus = overrides?.eventBus;
  let kafkaConsumer = overrides?.kafkaConsumer;

  if (eventBus === undefined || kafkaConsumer === undefined) {
    const kafka =
      config.kafkaMock
        ? null
        : createKafkaClient({
            brokers: config.kafkaBrokers,
            clientId: config.kafkaClientId,
          });

    const producer = createKafkaProducer(kafka, { mock: config.kafkaMock });
    const redisMock = process.env.REDIS_MOCK === 'true' || process.env.REDIS_MOCK === '1';
    const pubsub = redisMock
      ? (new InMemoryPubSub() as unknown as RedisPubSub)
      : new RedisPubSub(createRedisConnection(config.redisUrl));
    eventBus = new AtlasEventBus(producer, pubsub);

    kafkaConsumer =
      kafka === null
        ? null
        : new AtlasKafkaConsumer(kafka, { groupId: config.kafkaGroupId, dlqOnFailure: true });
  }

  const tenantIdentity =
    overrides?.tenantIdentity ??
    createTenantIdentityModule({
      prisma,
      passwordHasher,
      accessTtlSeconds: config.jwtAccessTtlSeconds,
      jwt: {
        secret: config.jwtSecret,
        accessTtlSeconds: config.jwtAccessTtlSeconds,
        refreshTtlSeconds: config.jwtRefreshTtlSeconds,
        issuer: 'atlas-worker',
        audience: 'atlas',
      },
    });

  const notifications =
    overrides?.notifications ??
    createNotificationsModule({
      prisma,
      logger: logger.child({ module: 'notifications' }),
    });

  const storage =
    overrides?.storage ??
    (await createStorageModule({
      prisma,
    }));

  const audit = overrides?.audit ?? createAuditModule({ prisma });

  const workflow =
    overrides?.workflow ??
    createWorkflowModule({
      prisma,
      logger: logger.child({ module: 'workflow' }),
    });

  const ai = overrides?.ai ?? createAiModule({ prisma });

  const crm =
    overrides?.crm ??
    createCrmModule({
      prisma,
      logger: logger.child({ module: 'crm' }),
    });

  const projects =
    overrides?.projects ??
    createProjectsModule({
      prisma,
      logger: logger.child({ module: 'projects' }),
    });

  const automation =
    overrides?.automation ??
    createAutomationModule({
      prisma,
      actionPorts: createAutomationActionPorts({
        notificationService: notifications.notificationService,
        workflowInstanceService: workflow.instanceService,
        agentRunService: ai.runService,
        contactService: crm.contactService,
        accountService: crm.accountService,
        dealService: crm.dealService,
        projectService: projects.projectService,
        taskService: projects.taskService,
        logger: logger.child({ module: 'automation' }),
      }),
    });

  const finance =
    overrides?.finance ??
    createFinanceModule({
      prisma,
      logger: logger.child({ module: 'finance' }),
    });

  return {
    config,
    logger,
    prisma,
    jwtService,
    passwordHasher,
    metrics,
    queueManager,
    eventBus,
    kafkaConsumer,
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
