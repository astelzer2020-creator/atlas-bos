import type { Prisma } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';

export type WorkflowInstanceStatus =
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'compensating'
  | 'suspended';

export type WorkflowInitiatorType = 'user' | 'automation' | 'agent' | 'system' | 'api';

export interface WorkflowInstanceRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly definitionId: string;
  readonly definitionVersion: number;
  readonly parentInstanceId: string | null;
  readonly status: WorkflowInstanceStatus;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly correlationId: string | null;
  readonly initiatorType: WorkflowInitiatorType;
  readonly initiatorId: string | null;
  readonly currentNodeId: string | null;
  readonly contextVariables: Record<string, unknown>;
  readonly inputPayload: Record<string, unknown>;
  readonly outputPayload: Record<string, unknown> | null;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
  readonly dueAt: Date | null;
  readonly slaBreachAt: Date | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface CreateWorkflowInstanceData {
  readonly organizationId: OrganizationId;
  readonly definitionId: string;
  readonly definitionVersion: number;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly correlationId?: string;
  readonly initiatorType?: WorkflowInitiatorType;
  readonly initiatorId?: UserId;
  readonly inputPayload?: Record<string, unknown>;
  readonly contextVariables?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  readonly createdBy?: UserId;
}

export interface UpdateWorkflowInstanceData {
  readonly status?: WorkflowInstanceStatus;
  readonly currentNodeId?: string | null;
  readonly outputPayload?: Record<string, unknown> | null;
  readonly completedAt?: Date | null;
  readonly metadata?: Record<string, unknown>;
  readonly updatedBy?: UserId;
}

export interface ListWorkflowInstancesFilter {
  readonly organizationId: OrganizationId;
  readonly status?: WorkflowInstanceStatus;
  readonly definitionId?: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly limit: number;
  readonly cursor?: string;
}

export interface WorkflowInstanceRepository {
  findById(
    organizationId: OrganizationId,
    id: string,
  ): Promise<WorkflowInstanceRecord | null>;

  create(data: CreateWorkflowInstanceData): Promise<WorkflowInstanceRecord>;

  update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateWorkflowInstanceData,
  ): Promise<WorkflowInstanceRecord | null>;

  list(filter: ListWorkflowInstancesFilter): Promise<WorkflowInstanceRecord[]>;
}

export type WorkflowInstanceRepositoryTx = Prisma.TransactionClient;