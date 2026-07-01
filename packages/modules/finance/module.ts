import type { PrismaClient } from '@atlas/database';
import { createLogger, type Logger } from '@atlas/platform';

import { ChartOfAccountService } from './application/services/chart-of-account.service.js';
import { JournalEntryService } from './application/services/journal-entry.service.js';
import { PrismaChartOfAccountRepository } from './infrastructure/persistence/prisma-chart-of-account.repository.js';
import { PrismaJournalEntryRepository } from './infrastructure/persistence/prisma-journal-entry.repository.js';

export { ChartOfAccountService } from './application/services/chart-of-account.service.js';
export { JournalEntryService } from './application/services/journal-entry.service.js';
export { registerFinanceRoutes } from './presentation/rest/finance.routes.js';

export type { FinanceRoutesDeps } from './presentation/rest/finance.routes.js';
export type {
  ChartOfAccountDto,
  CreateChartOfAccountInput,
  UpdateChartOfAccountInput,
} from './application/services/chart-of-account.service.js';
export type {
  JournalEntryDto,
  JournalLineDto,
  CreateJournalEntryInput,
  CreateJournalLineInput,
} from './application/services/journal-entry.service.js';

export interface FinanceModuleOptions {
  readonly prisma: PrismaClient;
  readonly logger?: Logger;
}

export interface FinanceModule {
  readonly chartOfAccountService: ChartOfAccountService;
  readonly journalEntryService: JournalEntryService;
}

/**
 * Wires finance bounded context services with Prisma repositories.
 */
export function createFinanceModule(options: FinanceModuleOptions): FinanceModule {
  void (options.logger ??
    createLogger({
      service: 'atlas',
      bindings: { module: 'finance' },
    }));

  const chartOfAccountRepository = new PrismaChartOfAccountRepository(options.prisma);
  const journalEntryRepository = new PrismaJournalEntryRepository(options.prisma);

  const chartOfAccountService = new ChartOfAccountService({ chartOfAccountRepository });
  const journalEntryService = new JournalEntryService({
    journalEntryRepository,
    chartOfAccountRepository,
  });

  return {
    chartOfAccountService,
    journalEntryService,
  };
}