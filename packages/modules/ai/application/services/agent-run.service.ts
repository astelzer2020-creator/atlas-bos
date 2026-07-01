import {
  ConflictError,
  err,
  NotFoundError,
  ok,
  ValidationError,
  type OrganizationId,
  type Result,
  type UserId,
} from '@atlas/shared-kernel';

import type { AgentDefinitionRepository } from '../../domain/repositories/agent-definition.repository.js';
import type {
  AgentRunRecord,
  AgentRunRepository,
  AgentRunStatus,
  OrchestrationPattern,
} from '../../domain/repositories/agent-run.repository.js';

import type { AgentExecutor } from '../executors/agent-executor.js';
import { DEFAULT_RUN_RESULT_SUMMARY } from '../executors/default-agent-executor.js';

export { DEFAULT_RUN_RESULT_SUMMARY };

export interface AgentRunDto {
  readonly id: string;
  readonly organization_id: string;
  readonly agent_definition_id: string;
  readonly definition_version: number;
  readonly invoker_type: string;
  readonly invoker_id: string | null;
  readonly conversation_session_id: string | null;
  readonly goal: string;
  readonly status: AgentRunStatus;
  readonly status_reason: string | null;
  readonly orchestration_pattern: OrchestrationPattern;
  readonly iteration_count: number;
  readonly max_iterations: number;
  readonly budget_cents: number;
  readonly cost_cents: number;
  readonly llm_input_tokens: string;
  readonly llm_output_tokens: string;
  readonly started_at: string;
  readonly completed_at: string | null;
  readonly result_summary: string | null;
  readonly result_payload: Record<string, unknown> | null;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
  readonly updated_at: string;
  readonly version: number;
}

export interface AgentRunDetailDto extends AgentRunDto {
  readonly steps: never[];
}

export interface StartAgentRunInput {
  readonly agentDefinitionId: string;
  readonly goal: string;
  readonly conversationSessionId?: string;
  readonly maxIterations?: number;
  readonly budgetCents?: number;
  readonly orchestrationPattern?: OrchestrationPattern;
  readonly metadata?: Record<string, unknown>;
}

export interface ListAgentRunsInput {
  readonly status?: AgentRunStatus;
  readonly agentDefinitionId?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface AgentRunServiceDeps {
  readonly definitionRepository: AgentDefinitionRepository;
  readonly runRepository: AgentRunRepository;
  readonly agentExecutor: AgentExecutor;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

const CANCELLABLE_STATUSES: readonly AgentRunStatus[] = [
  'init',
  'planning',
  'executing',
  'review_pending',
  'awaiting_human',
];

export class AgentRunService {
  constructor(private readonly deps: AgentRunServiceDeps) {}

  async startRun(
    organizationId: OrganizationId,
    input: StartAgentRunInput,
    actorId?: UserId,
  ): Promise<Result<AgentRunDto, ValidationError | NotFoundError | ConflictError>> {
    const goal = input.goal.trim();
    if (goal.length === 0) {
      return err(new ValidationError('Agent run goal is required', { field: 'goal' }));
    }

    const definition = await this.deps.definitionRepository.findById(
      organizationId,
      input.agentDefinitionId,
    );

    if (definition === null) {
      return err(new NotFoundError('AgentDefinition', input.agentDefinitionId));
    }

    if (definition.status !== 'published') {
      return err(
        new ConflictError('Agent definition must be published to start a run', {
          details: {
            agentDefinitionId: input.agentDefinitionId,
            status: definition.status,
          },
        }),
      );
    }

    const run = await this.deps.runRepository.create({
      organizationId,
      agentDefinitionId: definition.id,
      definitionVersion: definition.definitionVersion,
      goal,
      invokerType: actorId !== undefined ? 'user' : 'system',
      ...(actorId !== undefined ? { invokerId: actorId, createdBy: actorId } : {}),
      ...(input.conversationSessionId !== undefined
        ? { conversationSessionId: input.conversationSessionId }
        : {}),
      ...(input.orchestrationPattern !== undefined
        ? { orchestrationPattern: input.orchestrationPattern }
        : {}),
      ...(input.maxIterations !== undefined ? { maxIterations: input.maxIterations } : {}),
      ...(input.budgetCents !== undefined ? { budgetCents: input.budgetCents } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    });

    const executing = await this.deps.runRepository.update(organizationId, run.id, {
      status: 'executing',
      ...(actorId !== undefined ? { updatedBy: actorId } : {}),
    });

    if (executing === null) {
      return err(new NotFoundError('AgentRun', run.id));
    }

    const execution = await this.deps.agentExecutor.execute({
      organizationId,
      run: executing,
    });

    const completed = await this.deps.runRepository.update(organizationId, run.id, {
      status: execution.status === 'failed' ? 'failed' : 'completed',
      resultSummary: execution.resultSummary,
      resultPayload: execution.resultPayload,
      completedAt: new Date(),
      ...(execution.costCents !== undefined ? { costCents: execution.costCents } : {}),
      ...(execution.llmInputTokens !== undefined
        ? { llmInputTokens: execution.llmInputTokens }
        : {}),
      ...(execution.llmOutputTokens !== undefined
        ? { llmOutputTokens: execution.llmOutputTokens }
        : {}),
      ...(actorId !== undefined ? { updatedBy: actorId } : {}),
    });

    if (completed === null) {
      return err(new NotFoundError('AgentRun', run.id));
    }

    return ok(this.toDto(completed));
  }

  async getRunRecord(
    organizationId: OrganizationId,
    runId: string,
  ): Promise<Result<AgentRunRecord, NotFoundError>> {
    const run = await this.deps.runRepository.findById(organizationId, runId);

    if (run === null) {
      return err(new NotFoundError('AgentRun', runId));
    }

    return ok(run);
  }

  async getRun(
    organizationId: OrganizationId,
    runId: string,
    _includeSteps = true,
  ): Promise<Result<AgentRunDetailDto, NotFoundError>> {
    const runResult = await this.getRunRecord(organizationId, runId);

    if (!runResult.ok) {
      return runResult;
    }

    return ok({
      ...this.toDto(runResult.value),
      steps: [],
    });
  }

  async listRuns(
    organizationId: OrganizationId,
    input: ListAgentRunsInput = {},
  ): Promise<{ data: AgentRunDto[]; next_cursor: string | null }> {
    const limit = Math.min(input.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);

    const runs = await this.deps.runRepository.list({
      organizationId,
      limit,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.agentDefinitionId !== undefined
        ? { agentDefinitionId: input.agentDefinitionId }
        : {}),
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
    });

    return {
      data: runs.map((run) => this.toDto(run)),
      next_cursor: runs.length === limit ? (runs.at(-1)?.id ?? null) : null,
    };
  }

  async cancelRun(
    organizationId: OrganizationId,
    runId: string,
    reason?: string,
    actorId?: UserId,
  ): Promise<Result<AgentRunDto, NotFoundError | ConflictError>> {
    const run = await this.deps.runRepository.findById(organizationId, runId);

    if (run === null) {
      return err(new NotFoundError('AgentRun', runId));
    }

    if (!CANCELLABLE_STATUSES.includes(run.status)) {
      return err(
        new ConflictError('Agent run cannot be cancelled in its current status', {
          details: { status: run.status },
        }),
      );
    }

    const trimmedReason = reason?.trim();
    const cancelled = await this.deps.runRepository.update(organizationId, runId, {
      status: 'cancelled',
      statusReason: trimmedReason !== undefined && trimmedReason.length > 0 ? trimmedReason : null,
      completedAt: new Date(),
      ...(actorId !== undefined ? { updatedBy: actorId } : {}),
    });

    if (cancelled === null) {
      return err(new NotFoundError('AgentRun', runId));
    }

    return ok(this.toDto(cancelled));
  }

  toDto(record: AgentRunRecord): AgentRunDto {
    return {
      id: record.id,
      organization_id: record.organizationId,
      agent_definition_id: record.agentDefinitionId,
      definition_version: record.definitionVersion,
      invoker_type: record.invokerType,
      invoker_id: record.invokerId,
      conversation_session_id: record.conversationSessionId,
      goal: record.goal,
      status: record.status,
      status_reason: record.statusReason,
      orchestration_pattern: record.orchestrationPattern,
      iteration_count: record.iterationCount,
      max_iterations: record.maxIterations,
      budget_cents: record.budgetCents,
      cost_cents: record.costCents,
      llm_input_tokens: record.llmInputTokens.toString(),
      llm_output_tokens: record.llmOutputTokens.toString(),
      started_at: record.startedAt.toISOString(),
      completed_at: record.completedAt?.toISOString() ?? null,
      result_summary: record.resultSummary,
      result_payload: record.resultPayload,
      metadata: record.metadata,
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString(),
      version: record.version,
    };
  }
}