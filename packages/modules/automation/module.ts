import type { PrismaClient } from '@atlas/database';

import type { ActionExecutionPorts } from './application/ports/action-integration.ports.js';
import { AutomationExecutorService } from './application/services/automation-executor.service.js';
import { AutomationRuleService } from './application/services/automation-rule.service.js';
import { PrismaAutomationExecutionLogRepository } from './infrastructure/persistence/prisma-automation-execution-log.repository.js';
import { PrismaAutomationRuleRepository } from './infrastructure/persistence/prisma-automation-rule.repository.js';

export {
  AUTOMATION_SYSTEM_ACTOR_ID,
  type ActionExecutionPorts,
  type EntityMutationPort,
} from './application/ports/action-integration.ports.js';
export { evaluateCondition } from './application/engine/condition-evaluator.js';
export { evaluateTriggers } from './application/engine/trigger-evaluator.js';
export {
  evaluateCronSchedule,
  isAnyScheduleDue,
} from './application/engine/cron-schedule.evaluator.js';
export { AutomationExecutorService } from './application/services/automation-executor.service.js';
export { AutomationRuleService } from './application/services/automation-rule.service.js';
export { registerAutomationRoutes } from './presentation/rest/automation.routes.js';

export type { AutomationRoutesDeps } from './presentation/rest/automation.routes.js';
export type {
  AutomationRuleDto,
  AutomationRuleDetailDto,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from './application/services/automation-rule.service.js';
export type {
  AutomationDryRunResultDto,
  AutomationExecuteResultDto,
} from './application/services/automation-executor.service.js';

export interface AutomationModuleOptions {
  readonly prisma: PrismaClient;
  readonly actionPorts?: ActionExecutionPorts;
}

export interface AutomationModule {
  readonly ruleService: AutomationRuleService;
  readonly executorService: AutomationExecutorService;
}

/**
 * Wires automation bounded context services with Prisma repositories.
 */
export function createAutomationModule(options: AutomationModuleOptions): AutomationModule {
  const ruleRepository = new PrismaAutomationRuleRepository(options.prisma);
  const executionLogRepository = new PrismaAutomationExecutionLogRepository(options.prisma);

  const ruleService = new AutomationRuleService({ ruleRepository });

  const executorService = new AutomationExecutorService({
    ruleRepository,
    executionLogRepository,
    ...(options.actionPorts !== undefined ? { actionPorts: options.actionPorts } : {}),
  });

  return {
    ruleService,
    executorService,
  };
}