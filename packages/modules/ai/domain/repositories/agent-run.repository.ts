import type { Prisma } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';

export type AgentInvokerType = 'user' | 'workflow' | 'automation' | 'schedule' | 'system';

export type AgentRunStatus =
  | 'init'
  | 'planning'
  | 'executing'
  | 'review_pending'
  | 'awaiting_human'
  | 'completed'
  | 'failed'
  | 'terminated'
  | 'cancelled';

export type OrchestrationPattern = 'sequential' | 'parallel' | 'hierarchical';

export interface AgentRunRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly agentDefinitionId: string;
  readonly definitionVersion: number;
  readonly invokerType: AgentInvokerType;
  readonly invokerId: string | null;
  readonly conversationSessionId: string | null;
  readonly goal: string;
  readonly status: AgentRunStatus;
  readonly statusReason: string | null;
  readonly orchestrationPattern: OrchestrationPattern;
  readonly iterationCount: number;
  readonly maxIterations: number;
  readonly budgetCents: number;
  readonly costCents: number;
  readonly llmInputTokens: bigint;
  readonly llmOutputTokens: bigint;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
  readonly resultSummary: string | null;
  readonly resultPayload: Record<string, unknown> | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface CreateAgentRunData {
  readonly organizationId: OrganizationId;
  readonly agentDefinitionId: string;
  readonly definitionVersion: number;
  readonly goal: string;
  readonly invokerType?: AgentInvokerType;
  readonly invokerId?: UserId;
  readonly conversationSessionId?: string;
  readonly orchestrationPattern?: OrchestrationPattern;
  readonly maxIterations?: number;
  readonly budgetCents?: number;
  readonly metadata?: Record<string, unknown>;
  readonly createdBy?: UserId;
}

export interface UpdateAgentRunData {
  readonly status?: AgentRunStatus;
  readonly statusReason?: string | null;
  readonly iterationCount?: number;
  readonly costCents?: number;
  readonly completedAt?: Date | null;
  readonly resultSummary?: string | null;
  readonly resultPayload?: Record<string, unknown> | null;
  readonly metadata?: Record<string, unknown>;
  readonly updatedBy?: UserId;
}

export interface ListAgentRunsFilter {
  readonly organizationId: OrganizationId;
  readonly status?: AgentRunStatus;
  readonly agentDefinitionId?: string;
  readonly limit: number;
  readonly cursor?: string;
}

export interface AgentRunRepository {
  findById(
    organizationId: OrganizationId,
    id: string,
  ): Promise<AgentRunRecord | null>;

  create(data: CreateAgentRunData): Promise<AgentRunRecord>;

  update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateAgentRunData,
  ): Promise<AgentRunRecord | null>;

  list(filter: ListAgentRunsFilter): Promise<AgentRunRecord[]>;
}

export type AgentRunRepositoryTx = Prisma.TransactionClient;