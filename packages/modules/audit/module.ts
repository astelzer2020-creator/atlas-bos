import type { PrismaClient } from '@atlas/database';

import { AuditService } from './application/services/audit.service.js';
import { DomainEventService } from './application/services/domain-event.service.js';
import { OutboxService } from './application/services/outbox.service.js';
import { PrismaAuditLogRepository } from './infrastructure/persistence/prisma-audit-log.repository.js';
import { PrismaEventOutboxRepository } from './infrastructure/persistence/prisma-event-outbox.repository.js';

export { AuditService } from './application/services/audit.service.js';
export { DomainEventService } from './application/services/domain-event.service.js';
export { OutboxService } from './application/services/outbox.service.js';
export { registerAuditRoutes } from './presentation/rest/audit.routes.js';
export { createAuditRecorder, registerAuditMiddleware } from './presentation/middleware/audit.middleware.js';

export type { AuditRoutesDeps } from './presentation/rest/audit.routes.js';
export type {
  AuditMiddlewareOptions,
  AuditRecorderContext,
  CreateAuditRecorderOptions,
} from './presentation/middleware/audit.middleware.js';
export type {
  RecordAuditEntryInput,
  QueryAuditLogInput,
  AuditLogEntryDto,
} from './application/services/audit.service.js';
export type {
  AppendToOutboxInput,
  PollPendingEventsOptions,
  OutboxEventDto,
} from './application/services/outbox.service.js';
export type {
  PublishDomainEventInput,
  PublishedDomainEventDto,
} from './application/services/domain-event.service.js';

export interface AuditModuleOptions {
  readonly prisma: PrismaClient;
}

export interface AuditModule {
  readonly auditService: AuditService;
  readonly outboxService: OutboxService;
  readonly domainEventService: DomainEventService;
}

/**
 * Wires audit & events bounded context services with Prisma repositories.
 */
export function createAuditModule(options: AuditModuleOptions): AuditModule {
  const auditLogRepository = new PrismaAuditLogRepository(options.prisma);
  const eventOutboxRepository = new PrismaEventOutboxRepository(options.prisma);

  const auditService = new AuditService({ auditLogRepository });
  const outboxService = new OutboxService({ eventOutboxRepository });
  const domainEventService = new DomainEventService({ eventOutboxRepository });

  return {
    auditService,
    outboxService,
    domainEventService,
  };
}