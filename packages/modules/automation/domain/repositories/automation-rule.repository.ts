import type { Prisma } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';

export type AutomationRuleStatus = 'draft' | 'enabled' | 'disabled' | 'archived';
export type AutomationTriggerType = 'event' | 'schedule' | 'webhook' | 'manual' | 'entity_change';
export type AutomationActionType =
  | 'send_notification'
  | 'send_email'
  | 'update_entity'
  | 'create_entity'
  | 'webhook_call'
  | 'invoke_agent'
  | 'start_workflow'
  | 'tag_entity'
  | 'delay'
  | 'condition_branch';
export type ActionOnFailure = 'stop' | 'continue' | 'retry' | 'compensate';
export type RetryBackoffType = 'fixed' | 'exponential' | 'linear';

export interface AutomationTriggerRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly ruleId: string;
  readonly triggerOrder: number;
  readonly triggerType: AutomationTriggerType;
  readonly eventType: string | null;
  readonly scheduleCron: string | null;
  readonly scheduleTimezone: string | null;
  readonly webhookPath: string | null;
  readonly filterExpression: string | null;
  readonly filterJson: Record<string, unknown>;
  readonly isActive: boolean;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface AutomationActionRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly ruleId: string;
  readonly actionOrder: number;
  readonly actionType: AutomationActionType;
  readonly name: string;
  readonly config: Record<string, unknown>;
  readonly conditionExpression: string | null;
  readonly onFailure: ActionOnFailure;
  readonly timeoutSeconds: number | null;
  readonly isActive: boolean;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface AutomationRuleRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly description: string | null;
  readonly status: AutomationRuleStatus;
  readonly ruleVersion: number;
  readonly ownerId: string | null;
  readonly maxExecutionsHour: number | null;
  readonly maxExecutionsDay: number | null;
  readonly concurrencyLimit: number | null;
  readonly retryMaxAttempts: number | null;
  readonly retryBackoff: RetryBackoffType | null;
  readonly dryRunAvailable: boolean;
  readonly lastExecutedAt: Date | null;
  readonly executionCount: bigint;
  readonly tags: string[];
  readonly settings: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface AutomationRuleDetailRecord extends AutomationRuleRecord {
  readonly triggers: AutomationTriggerRecord[];
  readonly actions: AutomationActionRecord[];
}

export interface CreateAutomationTriggerData {
  readonly triggerOrder?: number;
  readonly triggerType: AutomationTriggerType;
  readonly eventType?: string | null;
  readonly scheduleCron?: string | null;
  readonly scheduleTimezone?: string;
  readonly webhookPath?: string | null;
  readonly filterExpression?: string | null;
  readonly filterJson?: Record<string, unknown>;
  readonly isActive?: boolean;
  readonly metadata?: Record<string, unknown>;
}

export interface CreateAutomationActionData {
  readonly actionOrder: number;
  readonly actionType: AutomationActionType;
  readonly name: string;
  readonly config?: Record<string, unknown>;
  readonly conditionExpression?: string | null;
  readonly onFailure?: ActionOnFailure;
  readonly timeoutSeconds?: number;
  readonly isActive?: boolean;
  readonly metadata?: Record<string, unknown>;
}

export interface CreateAutomationRuleData {
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly description?: string;
  readonly triggers?: CreateAutomationTriggerData[];
  readonly actions?: CreateAutomationActionData[];
  readonly settings?: Record<string, unknown>;
  readonly tags?: string[];
  readonly metadata?: Record<string, unknown>;
  readonly createdBy?: UserId;
}

export interface UpdateAutomationRuleData {
  readonly name?: string;
  readonly description?: string | null;
  readonly triggers?: CreateAutomationTriggerData[];
  readonly actions?: CreateAutomationActionData[];
  readonly settings?: Record<string, unknown>;
  readonly tags?: string[];
  readonly metadata?: Record<string, unknown>;
  readonly updatedBy?: UserId;
}

export interface ListAutomationRulesFilter {
  readonly organizationId: OrganizationId;
  readonly status?: AutomationRuleStatus;
  readonly limit: number;
  readonly cursor?: string;
}

export interface AutomationRuleRepository {
  findById(
    organizationId: OrganizationId,
    id: string,
  ): Promise<AutomationRuleRecord | null>;

  findByIdWithDetails(
    organizationId: OrganizationId,
    id: string,
  ): Promise<AutomationRuleDetailRecord | null>;

  create(data: CreateAutomationRuleData): Promise<AutomationRuleDetailRecord>;

  update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateAutomationRuleData,
    expectedVersion: number,
  ): Promise<AutomationRuleDetailRecord | null>;

  softDelete(
    organizationId: OrganizationId,
    id: string,
    updatedBy?: UserId,
  ): Promise<boolean>;

  enable(
    organizationId: OrganizationId,
    id: string,
    updatedBy?: UserId,
  ): Promise<AutomationRuleRecord | null>;

  disable(
    organizationId: OrganizationId,
    id: string,
    updatedBy?: UserId,
  ): Promise<AutomationRuleRecord | null>;

  list(filter: ListAutomationRulesFilter): Promise<AutomationRuleRecord[]>;

  incrementExecutionCount(
    organizationId: OrganizationId,
    id: string,
    executedAt: Date,
  ): Promise<void>;
}

export type AutomationRuleRepositoryTx = Prisma.TransactionClient;