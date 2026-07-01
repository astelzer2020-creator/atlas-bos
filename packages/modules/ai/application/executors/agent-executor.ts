import type { OrganizationId } from '@atlas/shared-kernel';

import type { AgentRunRecord } from '../../domain/repositories/agent-run.repository.js';

export interface AgentExecutionContext {
  readonly organizationId: OrganizationId;
  readonly run: AgentRunRecord;
}

export interface AgentExecutionResult {
  readonly status: 'completed' | 'failed' | 'awaiting_human';
  readonly resultSummary: string;
  readonly resultPayload: Record<string, unknown>;
  readonly costCents?: number;
  readonly llmInputTokens?: bigint;
  readonly llmOutputTokens?: bigint;
}

export interface AgentExecutor {
  readonly name: string;
  execute(context: AgentExecutionContext): Promise<AgentExecutionResult>;
}