import type { OrganizationId, UserId } from '@atlas/shared-kernel';

export interface PipelineStageRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly pipelineId: string;
  readonly pipelineName: string;
  readonly name: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly probability: number;
  readonly isDefault: boolean;
  readonly isWon: boolean;
  readonly isLost: boolean;
  readonly isClosed: boolean;
  readonly color: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly version: number;
}

export interface CreatePipelineStageData {
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly pipelineId?: string;
  readonly pipelineName?: string;
  readonly description?: string;
  readonly sortOrder: number;
  readonly probability?: number;
  readonly isDefault?: boolean;
  readonly isWon?: boolean;
  readonly isLost?: boolean;
  readonly isClosed?: boolean;
  readonly color?: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdBy?: UserId;
}

export interface UpdatePipelineStageData {
  readonly name?: string;
  readonly pipelineName?: string;
  readonly description?: string | null;
  readonly sortOrder?: number;
  readonly probability?: number;
  readonly isDefault?: boolean;
  readonly isWon?: boolean;
  readonly isLost?: boolean;
  readonly isClosed?: boolean;
  readonly color?: string | null;
  readonly metadata?: Record<string, unknown>;
  readonly updatedBy?: UserId;
}

export interface ListPipelineStagesFilter {
  readonly organizationId: OrganizationId;
  readonly limit: number;
  readonly cursor?: string;
  readonly pipelineId?: string;
}

export interface PipelineStageRepository {
  findById(organizationId: OrganizationId, id: string): Promise<PipelineStageRecord | null>;
  countByOrganization(organizationId: OrganizationId, pipelineId?: string): Promise<number>;
  create(data: CreatePipelineStageData): Promise<PipelineStageRecord>;
  update(
    organizationId: OrganizationId,
    id: string,
    data: UpdatePipelineStageData,
    expectedVersion: number,
  ): Promise<PipelineStageRecord | null>;
  list(filter: ListPipelineStagesFilter): Promise<PipelineStageRecord[]>;
}