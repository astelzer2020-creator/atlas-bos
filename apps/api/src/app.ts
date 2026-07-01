import { registerAuditRoutes } from '@atlas/module-audit';
import { registerNotificationRoutes } from '@atlas/module-notifications';
import { registerStorageRoutes } from '@atlas/module-storage';
import {
  registerAuthRoutes,
  registerPlatformRoutes,
} from '@atlas/module-tenant-identity';
import { registerAutomationRoutes } from '@atlas/module-automation';
import { registerAiRoutes } from '@atlas/module-ai';
import { registerAiMemoryRoutes } from '@atlas/module-ai-memory';
import { registerCrmRoutes } from '@atlas/module-crm';
import { registerFinanceRoutes } from '@atlas/module-finance';
import { registerProjectsRoutes } from '@atlas/module-projects';
import { registerWorkflowRoutes } from '@atlas/module-workflow';
import {
  createPrometheusMetrics,
  registerMetricsRoute,
  registerPrometheusMiddleware,
  toProblemDetails,
} from '@atlas/platform';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';

import { type AppContainer, createContainer } from './di/container.js';
import { createAuthenticate, registerAuthMiddleware } from './middleware/auth.middleware.js';
import { registerRequestLogging } from './middleware/request-logging.js';

export interface CreateAppOptions {
  readonly container?: AppContainer;
  readonly skipReadyCheck?: boolean;
}

declare module 'fastify' {
  interface FastifyInstance {
    container: AppContainer;
  }
}

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const container = options.container ?? (await createContainer());

  const app = Fastify({
    logger: false,
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    genReqId: (req) => {
      const header = req.headers['x-request-id'];
      if (typeof header === 'string' && header.length > 0) {
        return header;
      }
      return crypto.randomUUID();
    },
  });

  app.decorate('container', container);

  app.addHook('onRequest', async (request, reply) => {
    request.correlationId = request.id;
    reply.header('x-request-id', request.correlationId);
  });

  const isProduction = container.config.nodeEnv === 'production';

  await app.register(helmet, {
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: [],
          },
        }
      : false,
    crossOriginEmbedderPolicy: isProduction,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    hsts: isProduction
      ? {
          maxAge: 31_536_000,
          includeSubDomains: true,
          preload: true,
        }
      : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  });

  await app.register(cors, {
    origin: container.config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Atlas-Version'],
    exposedHeaders: ['X-Request-Id'],
  });

  await app.register(rateLimit, {
    max: container.config.nodeEnv === 'production' ? 200 : 1000,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.auth?.userId ?? request.ip,
  });

  await app.register(cookie, {
    secret: container.config.jwtSecret,
    parseOptions: {},
  });

  const prometheusMetrics = createPrometheusMetrics({
    serviceName: 'atlas-api',
    collectProcessMetrics: container.config.nodeEnv !== 'test',
  });

  registerPrometheusMiddleware(app, prometheusMetrics, {
    enabled:
      container.config.prometheusEnabled && container.config.nodeEnv !== 'test',
  });

  registerMetricsRoute(app, prometheusMetrics, {
    enabled: container.config.prometheusEnabled,
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'atlas-api',
    timestamp: new Date().toISOString(),
  }));

  app.get('/ready', async (_request, reply) => {
    if (options.skipReadyCheck) {
      return { status: 'ready', checks: { database: 'skipped' } };
    }

    try {
      await container.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', checks: { database: 'ok' } };
    } catch {
      return reply.status(503).send({
        status: 'not_ready',
        checks: { database: 'failed' },
      });
    }
  });

  registerRequestLogging(app);
  registerAuthMiddleware(app);

  app.setErrorHandler((error, request, reply) => {
    const problem = toProblemDetails(error, {
      instance: request.url,
      requestId: request.correlationId,
    });

    container.logger.error('Request failed', {
      correlationId: request.correlationId,
      status: problem.status,
      code: problem.code,
      error: error instanceof Error ? error.message : String(error),
    });

    return reply
      .status(problem.status)
      .type('application/problem+json')
      .send(problem);
  });

  const authenticate = createAuthenticate(app);

  await registerAuthRoutes(app, {
    authService: container.tenantIdentity.authService,
    authenticate,
  });

  await registerPlatformRoutes(app, {
    organizationService: container.tenantIdentity.organizationService,
    workspaceService: container.tenantIdentity.workspaceService,
    teamService: container.tenantIdentity.teamService,
    userService: container.tenantIdentity.userService,
    authenticate,
  });

  await registerNotificationRoutes(app, {
    notificationService: container.notifications.notificationService,
    authenticate: async (request) => {
      const ctx = await authenticate(request);
      if (!ctx?.userId) {
        return null;
      }
      return { userId: ctx.userId };
    },
  });

  await registerStorageRoutes(app, {
    folderService: container.storage.folderService,
    fileService: container.storage.fileService,
    authenticate: async (request) => {
      const ctx = await authenticate(request);
      if (!ctx?.userId) {
        return null;
      }
      return { userId: ctx.userId };
    },
  });

  await registerAuditRoutes(app, {
    auditService: container.audit.auditService,
    authenticate: async (request) => {
      const ctx = await authenticate(request);
      if (!ctx?.userId) {
        return null;
      }
      return { userId: ctx.userId };
    },
  });

  await registerWorkflowRoutes(app, {
    definitionService: container.workflow.definitionService,
    instanceService: container.workflow.instanceService,
    approvalService: container.workflow.approvalService,
    authenticate: async (request) => {
      const ctx = await authenticate(request);
      if (!ctx?.userId) {
        return null;
      }
      return { userId: ctx.userId };
    },
  });

  await registerAutomationRoutes(app, {
    ruleService: container.automation.ruleService,
    executorService: container.automation.executorService,
    authenticate: async (request) => {
      const ctx = await authenticate(request);
      if (!ctx?.userId) {
        return null;
      }
      return { userId: ctx.userId };
    },
  });

  await registerAiRoutes(app, {
    definitionService: container.ai.definitionService,
    runService: container.ai.runService,
    authenticate: async (request) => {
      const ctx = await authenticate(request);
      if (!ctx?.userId) {
        return null;
      }
      return { userId: ctx.userId };
    },
  });

  await registerAiMemoryRoutes(app, {
    conversationService: container.aiMemory.conversationService,
    memoryService: container.aiMemory.memoryService,
    knowledgeBaseService: container.aiMemory.knowledgeBaseService,
    authenticate: async (request) => {
      const ctx = await authenticate(request);
      if (!ctx?.userId) {
        return null;
      }
      return { userId: ctx.userId };
    },
  });

  await registerCrmRoutes(app, {
    accountService: container.crm.accountService,
    contactService: container.crm.contactService,
    dealService: container.crm.dealService,
    pipelineStageService: container.crm.pipelineStageService,
    authenticate: async (request) => {
      const ctx = await authenticate(request);
      if (!ctx?.userId) {
        return null;
      }
      return { userId: ctx.userId };
    },
  });

  await registerProjectsRoutes(app, {
    projectService: container.projects.projectService,
    taskService: container.projects.taskService,
    authenticate: async (request) => {
      const ctx = await authenticate(request);
      if (!ctx?.userId) {
        return null;
      }
      return { userId: ctx.userId };
    },
  });

  await registerFinanceRoutes(app, {
    chartOfAccountService: container.finance.chartOfAccountService,
    journalEntryService: container.finance.journalEntryService,
    authenticate: async (request) => {
      const ctx = await authenticate(request);
      if (!ctx?.userId) {
        return null;
      }
      return { userId: ctx.userId };
    },
  });

  return app;
}