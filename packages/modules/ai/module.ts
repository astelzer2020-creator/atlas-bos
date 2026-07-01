import type { PrismaClient } from '@atlas/database';

import { DefaultAgentExecutor } from './application/executors/default-agent-executor.js';
import type { AgentExecutor } from './application/executors/agent-executor.js';
import { AgentDefinitionService } from './application/services/agent-definition.service.js';
import { AgentRunService } from './application/services/agent-run.service.js';
import {
  AgentToolRegistry,
  createDefaultToolRegistry,
} from './application/tools/tool-registry.js';
import { PrismaAgentDefinitionRepository } from './infrastructure/persistence/prisma-agent-definition.repository.js';
import { PrismaAgentRunRepository } from './infrastructure/persistence/prisma-agent-run.repository.js';

export type { AgentExecutor, AgentExecutionResult } from './application/executors/agent-executor.js';
export {
  DefaultAgentExecutor,
  DEFAULT_RUN_RESULT_SUMMARY,
} from './application/executors/default-agent-executor.js';
export { StubAgentExecutor, STUB_RUN_RESULT_SUMMARY } from './application/executors/stub-agent-executor.js';
export { AgentDefinitionService } from './application/services/agent-definition.service.js';
export { AgentRunService } from './application/services/agent-run.service.js';
export {
  AgentToolRegistry,
  createDefaultToolRegistry,
} from './application/tools/tool-registry.js';
export type {
  AgentToolDefinition,
  AgentToolInvocation,
  AgentToolResult,
} from './application/tools/tool-registry.js';
export { registerAiRoutes } from './presentation/rest/ai.routes.js';

export type { AiRoutesDeps } from './presentation/rest/ai.routes.js';
export type {
  AgentDefinitionDto,
  CreateAgentDefinitionInput,
  UpdateAgentDefinitionInput,
} from './application/services/agent-definition.service.js';
export type {
  AgentRunDto,
  AgentRunDetailDto,
  StartAgentRunInput,
} from './application/services/agent-run.service.js';

export interface AiModuleOptions {
  readonly prisma: PrismaClient;
  readonly toolRegistry?: AgentToolRegistry;
  readonly agentExecutor?: AgentExecutor;
}

export interface AiModule {
  readonly definitionService: AgentDefinitionService;
  readonly runService: AgentRunService;
  readonly toolRegistry: AgentToolRegistry;
  readonly agentExecutor: AgentExecutor;
}

/**
 * Wires AI agents bounded context services with Prisma repositories.
 */
export function createAiModule(options: AiModuleOptions): AiModule {
  const definitionRepository = new PrismaAgentDefinitionRepository(options.prisma);
  const runRepository = new PrismaAgentRunRepository(options.prisma);

  const toolRegistry = options.toolRegistry ?? createDefaultToolRegistry();
  const agentExecutor =
    options.agentExecutor ?? new DefaultAgentExecutor({ toolRegistry });
  const definitionService = new AgentDefinitionService({ definitionRepository });
  const runService = new AgentRunService({
    definitionRepository,
    runRepository,
    agentExecutor,
  });

  return {
    definitionService,
    runService,
    toolRegistry,
    agentExecutor,
  };
}