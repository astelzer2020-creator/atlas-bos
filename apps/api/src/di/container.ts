import { createPrismaClient } from '@atlas/database';
import { createAuditModule, type AuditModule } from '@atlas/module-audit';
import {
  createNotificationsModule,
  type NotificationsModule,
} from '@atlas/module-notifications';
import { createStorageModule, type StorageModule } from '@atlas/module-storage';
import {
  createTenantIdentityModule,
  type TenantIdentityModule,
} from '@atlas/module-tenant-identity';
import { createAutomationModule, type AutomationModule } from '@atlas/module-automation';
import { createAutomationActionPorts } from '../wiring/automation-action-ports.js';
import { createAiModule, type AiModule } from '@atlas/module-ai';
import { createAiMemoryModule, type AiMemoryModule } from '@atlas/module-ai-memory';
import { createCrmModule, type CrmModule } from '@atlas/module-crm';
import { createFinanceModule, type FinanceModule } from '@atlas/module-finance';
import { createProjectsModule, type ProjectsModule } from '@atlas/module-projects';
import { createWorkflowModule, type WorkflowModule } from '@atlas/module-workflow';
import {
  createJwtService,
  createLogger,
  createNoopMetricsCollector,
  createPasswordHasher,
  loadConfig,
} from '@atlas/platform';
import type {
  AppConfig,
  JwtService,
  Logger,
  MetricsCollector,
  PasswordHasher,
} from '@atlas/platform';
import type { PrismaClient } from '@atlas/database';

export interface AppContainer {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly prisma: PrismaClient;
  readonly jwtService: JwtService;
  readonly passwordHasher: PasswordHasher;
  readonly metrics: MetricsCollector;
  readonly tenantIdentity: TenantIdentityModule;
  readonly notifications: NotificationsModule;
  readonly storage: StorageModule;
  readonly audit: AuditModule;
  readonly workflow: WorkflowModule;
  readonly automation: AutomationModule;
  readonly ai: AiModule;
  readonly aiMemory: AiMemoryModule;
  readonly crm: CrmModule;
  readonly projects: ProjectsModule;
  readonly finance: FinanceModule;
}

export async function createContainer(
  overrides?: Partial<AppContainer>,
): Promise<AppContainer> {
  const config = overrides?.config ?? loadConfig();
  const logger =
    overrides?.logger ??
    createLogger({
      service: 'atlas-api',
      level: config.nodeEnv === 'production' ? 'info' : 'debug',
    });

  const prisma = overrides?.prisma ?? createPrismaClient(config.databaseUrl);

  const jwtService =
    overrides?.jwtService ??
    createJwtService({
      secret: config.jwtSecret,
      accessTtlSeconds: config.jwtAccessTtlSeconds,
      refreshTtlSeconds: config.jwtRefreshTtlSeconds,
      issuer: 'atlas-api',
      audience: 'atlas',
    });

  const passwordHasher =
    overrides?.passwordHasher ??
    createPasswordHasher({
      algorithm: 'bcrypt',
      bcryptRounds: config.bcryptRounds,
    });

  const metrics = overrides?.metrics ?? createNoopMetricsCollector();

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
        issuer: 'atlas-api',
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

  const aiMemory =
    overrides?.aiMemory ??
    createAiMemoryModule({
      prisma,
      logger: logger.child({ module: 'ai-memory' }),
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