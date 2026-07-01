import type { PrismaClient } from '@atlas/database';
import type { Logger } from '@atlas/platform';

import { AccountService } from './application/services/account.service.js';
import { ContactService } from './application/services/contact.service.js';
import { DealService } from './application/services/deal.service.js';
import { PipelineStageService } from './application/services/pipeline-stage.service.js';
import { PrismaCrmAccountRepository } from './infrastructure/persistence/prisma-account.repository.js';
import { PrismaCrmContactRepository } from './infrastructure/persistence/prisma-contact.repository.js';
import { PrismaDealRepository } from './infrastructure/persistence/prisma-deal.repository.js';
import { PrismaOrganizationMembershipAdapter } from './infrastructure/persistence/prisma-organization-membership.adapter.js';
import { PrismaPipelineStageRepository } from './infrastructure/persistence/prisma-pipeline-stage.repository.js';

export { AccountService } from './application/services/account.service.js';
export { ContactService } from './application/services/contact.service.js';
export { DealService } from './application/services/deal.service.js';
export { PipelineStageService } from './application/services/pipeline-stage.service.js';
export { registerCrmRoutes } from './presentation/rest/crm.routes.js';

export type { CrmRoutesDeps } from './presentation/rest/crm.routes.js';
export type {
  AccountDto,
  CreateAccountInput,
  UpdateAccountInput,
} from './application/services/account.service.js';
export type {
  ContactDto,
  CreateContactInput,
  UpdateContactInput,
} from './application/services/contact.service.js';
export type {
  DealDto,
  CreateDealInput,
  UpdateDealInput,
} from './application/services/deal.service.js';
export type {
  PipelineStageDto,
  CreatePipelineStageInput,
  UpdatePipelineStageInput,
} from './application/services/pipeline-stage.service.js';

export interface CrmModuleOptions {
  readonly prisma: PrismaClient;
  readonly logger?: Logger;
}

export interface CrmModule {
  readonly accountService: AccountService;
  readonly contactService: ContactService;
  readonly dealService: DealService;
  readonly pipelineStageService: PipelineStageService;
}

/**
 * Wires CRM bounded context services with Prisma repositories.
 */
export function createCrmModule(options: CrmModuleOptions): CrmModule {
  void options.logger;

  const accountRepository = new PrismaCrmAccountRepository(options.prisma);
  const contactRepository = new PrismaCrmContactRepository(options.prisma);
  const pipelineStageRepository = new PrismaPipelineStageRepository(options.prisma);
  const dealRepository = new PrismaDealRepository(options.prisma);
  const membershipPort = new PrismaOrganizationMembershipAdapter(options.prisma);

  const accountService = new AccountService({ accountRepository });
  const contactService = new ContactService({ contactRepository, accountRepository });
  const pipelineStageService = new PipelineStageService({ pipelineStageRepository });
  const dealService = new DealService({
    dealRepository,
    pipelineStageRepository,
    accountRepository,
    contactRepository,
    membershipPort,
  });

  return {
    accountService,
    contactService,
    dealService,
    pipelineStageService,
  };
}