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

import type {
  CreatePipelineStageData,
  PipelineStageRecord,
  PipelineStageRepository,
  UpdatePipelineStageData,
} from '../../domain/repositories/pipeline-stage.repository.js';
import { resolveListLimit, type CursorPageResult } from '../../domain/types/pagination.js';

export interface PipelineStageDto {
  readonly id: string;
  readonly organizationId: string;
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
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly version: number;
}

export interface CreatePipelineStageInput {
  readonly name: string;
  readonly pipelineId?: string;
  readonly pipelineName?: string;
  readonly description?: string;
  readonly sortOrder?: number;
  readonly probability?: number;
  readonly isDefault?: boolean;
  readonly isWon?: boolean;
  readonly isLost?: boolean;
  readonly isClosed?: boolean;
  readonly color?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdatePipelineStageInput {
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
  readonly version: number;
}

export interface ListPipelineStagesInput {
  readonly limit?: number;
  readonly cursor?: string;
  readonly pipelineId?: string;
}

export interface PipelineStageServiceDeps {
  readonly pipelineStageRepository: PipelineStageRepository;
}

export class PipelineStageService {
  constructor(private readonly deps: PipelineStageServiceDeps) {}

  async createPipelineStage(
    organizationId: OrganizationId,
    input: CreatePipelineStageInput,
    actorId?: UserId,
  ): Promise<Result<PipelineStageDto, ValidationError>> {
    const name = input.name.trim();
    if (name.length === 0) {
      return err(new ValidationError('Pipeline stage name is required', { field: 'name' }));
    }

    const existingCount = await this.deps.pipelineStageRepository.countByOrganization(
      organizationId,
      input.pipelineId,
    );

    const sortOrder = existingCount === 0 ? 1 : (input.sortOrder ?? 1);

    if (sortOrder < 1) {
      return err(
        new ValidationError('Pipeline stage sort order must be at least 1', { field: 'sortOrder' }),
      );
    }

    if (input.probability !== undefined && (input.probability < 0 || input.probability > 100)) {
      return err(
        new ValidationError('Pipeline stage probability must be between 0 and 100', {
          field: 'probability',
        }),
      );
    }

    const createData: CreatePipelineStageData = {
      organizationId,
      name,
      sortOrder,
      ...(input.pipelineId !== undefined ? { pipelineId: input.pipelineId } : {}),
      ...(input.pipelineName !== undefined ? { pipelineName: input.pipelineName } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.probability !== undefined ? { probability: input.probability } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      ...(input.isWon !== undefined ? { isWon: input.isWon } : {}),
      ...(input.isLost !== undefined ? { isLost: input.isLost } : {}),
      ...(input.isClosed !== undefined ? { isClosed: input.isClosed } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(actorId !== undefined ? { createdBy: actorId } : {}),
    };

    const stage = await this.deps.pipelineStageRepository.create(createData);
    return ok(this.toDto(stage));
  }

  async getPipelineStage(
    organizationId: OrganizationId,
    stageId: string,
  ): Promise<Result<PipelineStageDto, NotFoundError>> {
    const stage = await this.deps.pipelineStageRepository.findById(organizationId, stageId);
    if (stage === null) {
      return err(new NotFoundError('PipelineStage', stageId));
    }
    return ok(this.toDto(stage));
  }

  async updatePipelineStage(
    organizationId: OrganizationId,
    stageId: string,
    input: UpdatePipelineStageInput,
    actorId?: UserId,
  ): Promise<Result<PipelineStageDto, ValidationError | NotFoundError | ConflictError>> {
    const existing = await this.deps.pipelineStageRepository.findById(organizationId, stageId);
    if (existing === null) {
      return err(new NotFoundError('PipelineStage', stageId));
    }

    if (input.version !== existing.version) {
      return err(
        new ConflictError('Pipeline stage version mismatch', {
          details: { expected: input.version, actual: existing.version },
        }),
      );
    }

    if (input.name !== undefined && input.name.trim().length === 0) {
      return err(
        new ValidationError('Pipeline stage name cannot be empty', { field: 'name' }),
      );
    }

    if (input.probability !== undefined && (input.probability < 0 || input.probability > 100)) {
      return err(
        new ValidationError('Pipeline stage probability must be between 0 and 100', {
          field: 'probability',
        }),
      );
    }

    const updateData: UpdatePipelineStageData = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.pipelineName !== undefined ? { pipelineName: input.pipelineName } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.probability !== undefined ? { probability: input.probability } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      ...(input.isWon !== undefined ? { isWon: input.isWon } : {}),
      ...(input.isLost !== undefined ? { isLost: input.isLost } : {}),
      ...(input.isClosed !== undefined ? { isClosed: input.isClosed } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(actorId !== undefined ? { updatedBy: actorId } : {}),
    };

    const updated = await this.deps.pipelineStageRepository.update(
      organizationId,
      stageId,
      updateData,
      input.version,
    );

    if (updated === null) {
      return err(
        new ConflictError('Pipeline stage was modified concurrently', {
          details: { id: stageId, expectedVersion: input.version },
        }),
      );
    }

    return ok(this.toDto(updated));
  }

  async listPipelineStages(
    organizationId: OrganizationId,
    input: ListPipelineStagesInput = {},
  ): Promise<CursorPageResult<PipelineStageDto>> {
    const limit = resolveListLimit(input.limit);

    const stages = await this.deps.pipelineStageRepository.list({
      organizationId,
      limit,
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
      ...(input.pipelineId !== undefined ? { pipelineId: input.pipelineId } : {}),
    });

    return {
      data: stages.map((stage) => this.toDto(stage)),
      nextCursor: stages.length === limit ? (stages.at(-1)?.id ?? null) : null,
    };
  }

  toDto(record: PipelineStageRecord): PipelineStageDto {
    return {
      id: record.id,
      organizationId: record.organizationId,
      pipelineId: record.pipelineId,
      pipelineName: record.pipelineName,
      name: record.name,
      description: record.description,
      sortOrder: record.sortOrder,
      probability: record.probability,
      isDefault: record.isDefault,
      isWon: record.isWon,
      isLost: record.isLost,
      isClosed: record.isClosed,
      color: record.color,
      metadata: record.metadata,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      deletedAt: record.deletedAt?.toISOString() ?? null,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      version: record.version,
    };
  }
}