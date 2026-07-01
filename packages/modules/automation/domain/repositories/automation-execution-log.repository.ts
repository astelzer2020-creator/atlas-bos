import type { OrganizationId } from '@atlas/shared-kernel';

export type AutomationExecutionStatus = 'started' | 'completed' | 'failed' | 'skipped' | 'dry_run';

export interface ActionExecutedRecord {
  readonly action_type: string;
  readonly name: string;
  readonly status: 'success' | 'failed' | 'skipped';
  readonly config: Record<string, unknown>;
  readonly result?: Record<string, unknown>;
  readonly error?: string;
}

export interface AutomationExecutionLogRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly ruleId: string;
  readonly status: AutomationExecutionStatus;
  readonly triggerType: string | null;
  readonly triggerPayload: Record<string, unknown>;
  readonly actionsExecuted: ActionExecutedRecord[];
  readonly errorMessage: string | null;
  readonly durationMs: number | null;
  readonly idempotencyKey: string | null;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
}

export interface CreateAutomationExecutionLogData {
  readonly organizationId: OrganizationId;
  readonly ruleId: string;
  readonly status: AutomationExecutionStatus;
  readonly triggerType?: string | null;
  readonly triggerPayload?: Record<string, unknown>;
  readonly actionsExecuted?: ActionExecutedRecord[];
  readonly errorMessage?: string;
  readonly durationMs?: number;
  readonly idempotencyKey?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateAutomationExecutionLogData {
  readonly status?: AutomationExecutionStatus;
  readonly actionsExecuted?: ActionExecutedRecord[];
  readonly errorMessage?: string | null;
  readonly durationMs?: number;
  readonly completedAt?: Date;
}

export interface AutomationExecutionLogRepository {
  create(data: CreateAutomationExecutionLogData): Promise<AutomationExecutionLogRecord>;

  update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateAutomationExecutionLogData,
  ): Promise<AutomationExecutionLogRecord | null>;

  findById(
    organizationId: OrganizationId,
    id: string,
  ): Promise<AutomationExecutionLogRecord | null>;
}