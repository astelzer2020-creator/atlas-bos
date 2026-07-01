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
  CreateProjectData,
  ProjectPriority,
  ProjectRecord,
  ProjectRepository,
  ProjectStatus,
  UpdateProjectData,
} from '../../domain/repositories/project.repository.js';
import { resolveListLimit, type CursorPageResult } from '../../domain/types/pagination.js';

export interface ProjectDto {
  readonly id: string;
  readonly organizationId: string;
  readonly workspaceId: string | null;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: ProjectStatus;
  readonly priority: ProjectPriority;
  readonly startDate: string | null;
  readonly targetEndDate: string | null;
  readonly progressPercent: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly version: number;
}

export interface CreateProjectInput {
  readonly code: string;
  readonly name: string;
  readonly workspaceId?: string;
  readonly description?: string;
  readonly status?: ProjectStatus;
  readonly priority?: ProjectPriority;
  readonly startDate?: string;
  readonly targetEndDate?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateProjectInput {
  readonly workspaceId?: string | null;
  readonly code?: string;
  readonly name?: string;
  readonly description?: string | null;
  readonly status?: ProjectStatus;
  readonly priority?: ProjectPriority;
  readonly startDate?: string | null;
  readonly targetEndDate?: string | null;
  readonly progressPercent?: string;
  readonly metadata?: Record<string, unknown>;
  readonly version: number;
}

export interface ListProjectsInput {
  readonly limit?: number;
  readonly cursor?: string;
  readonly status?: ProjectStatus;
  readonly priority?: ProjectPriority;
  readonly workspaceId?: string;
}

export interface ProjectServiceDeps {
  readonly projectRepository: ProjectRepository;
}

function parseDateOnly(value: string, field: string): Result<Date, ValidationError> {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return err(new ValidationError(`Invalid date for ${field}`, { field }));
  }
  return ok(parsed);
}

function validateProgressPercent(value: string): Result<string, ValidationError> {
  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric) || numeric < 0 || numeric > 100) {
    return err(
      new ValidationError('Progress percent must be between 0 and 100', { field: 'progressPercent' }),
    );
  }
  return ok(value);
}

export class ProjectService {
  constructor(private readonly deps: ProjectServiceDeps) {}

  async createProject(
    organizationId: OrganizationId,
    input: CreateProjectInput,
    actorId?: UserId,
  ): Promise<Result<ProjectDto, ValidationError | ConflictError>> {
    const code = input.code.trim();
    if (code.length === 0) {
      return err(new ValidationError('Project code is required', { field: 'code' }));
    }

    const name = input.name.trim();
    if (name.length === 0) {
      return err(new ValidationError('Project name is required', { field: 'name' }));
    }

    const existing = await this.deps.projectRepository.findByCode(organizationId, code);
    if (existing !== null) {
      return err(
        new ConflictError('Project code already exists in organization', {
          details: { code },
        }),
      );
    }

    let startDate: Date | undefined;
    if (input.startDate !== undefined) {
      const startDateResult = parseDateOnly(input.startDate, 'startDate');
      if (!startDateResult.ok) {
        return startDateResult;
      }
      startDate = startDateResult.value;
    }

    let targetEndDate: Date | undefined;
    if (input.targetEndDate !== undefined) {
      const targetEndDateResult = parseDateOnly(input.targetEndDate, 'targetEndDate');
      if (!targetEndDateResult.ok) {
        return targetEndDateResult;
      }
      targetEndDate = targetEndDateResult.value;
    }

    const createData: CreateProjectData = {
      organizationId,
      code,
      name,
      ...(input.workspaceId !== undefined ? { workspaceId: input.workspaceId } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(startDate !== undefined ? { startDate } : {}),
      ...(targetEndDate !== undefined ? { targetEndDate } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(actorId !== undefined ? { createdBy: actorId } : {}),
    };

    const project = await this.deps.projectRepository.create(createData);
    return ok(this.toDto(project));
  }

  async getProject(
    organizationId: OrganizationId,
    projectId: string,
  ): Promise<Result<ProjectDto, NotFoundError>> {
    const project = await this.deps.projectRepository.findById(organizationId, projectId);
    if (project === null) {
      return err(new NotFoundError('Project', projectId));
    }
    return ok(this.toDto(project));
  }

  async updateProject(
    organizationId: OrganizationId,
    projectId: string,
    input: UpdateProjectInput,
    actorId?: UserId,
  ): Promise<Result<ProjectDto, ValidationError | NotFoundError | ConflictError>> {
    const existing = await this.deps.projectRepository.findById(organizationId, projectId);
    if (existing === null) {
      return err(new NotFoundError('Project', projectId));
    }

    if (input.version !== existing.version) {
      return err(
        new ConflictError('Project version mismatch', {
          details: { expected: input.version, actual: existing.version },
        }),
      );
    }

    if (input.name !== undefined && input.name.trim().length === 0) {
      return err(new ValidationError('Project name cannot be empty', { field: 'name' }));
    }

    if (input.code !== undefined) {
      const code = input.code.trim();
      if (code.length === 0) {
        return err(new ValidationError('Project code cannot be empty', { field: 'code' }));
      }

      if (code !== existing.code) {
        const duplicate = await this.deps.projectRepository.findByCode(organizationId, code);
        if (duplicate !== null && duplicate.id !== projectId) {
          return err(
            new ConflictError('Project code already exists in organization', {
              details: { code },
            }),
          );
        }
      }
    }

    if (input.progressPercent !== undefined) {
      const progressResult = validateProgressPercent(input.progressPercent);
      if (!progressResult.ok) {
        return progressResult;
      }
    }

    let startDate: Date | null | undefined;
    if (input.startDate !== undefined) {
      if (input.startDate === null) {
        startDate = null;
      } else {
        const startDateResult = parseDateOnly(input.startDate, 'startDate');
        if (!startDateResult.ok) {
          return startDateResult;
        }
        startDate = startDateResult.value;
      }
    }

    let targetEndDate: Date | null | undefined;
    if (input.targetEndDate !== undefined) {
      if (input.targetEndDate === null) {
        targetEndDate = null;
      } else {
        const targetEndDateResult = parseDateOnly(input.targetEndDate, 'targetEndDate');
        if (!targetEndDateResult.ok) {
          return targetEndDateResult;
        }
        targetEndDate = targetEndDateResult.value;
      }
    }

    const updateData: UpdateProjectData = {
      ...(input.workspaceId !== undefined ? { workspaceId: input.workspaceId } : {}),
      ...(input.code !== undefined ? { code: input.code.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(startDate !== undefined ? { startDate } : {}),
      ...(targetEndDate !== undefined ? { targetEndDate } : {}),
      ...(input.progressPercent !== undefined ? { progressPercent: input.progressPercent } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(actorId !== undefined ? { updatedBy: actorId } : {}),
    };

    const updated = await this.deps.projectRepository.update(
      organizationId,
      projectId,
      updateData,
      input.version,
    );

    if (updated === null) {
      return err(
        new ConflictError('Project was modified concurrently', {
          details: { id: projectId, expectedVersion: input.version },
        }),
      );
    }

    return ok(this.toDto(updated));
  }

  async listProjects(
    organizationId: OrganizationId,
    input: ListProjectsInput = {},
  ): Promise<CursorPageResult<ProjectDto>> {
    const limit = resolveListLimit(input.limit);

    const projects = await this.deps.projectRepository.list({
      organizationId,
      limit,
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.workspaceId !== undefined ? { workspaceId: input.workspaceId } : {}),
    });

    return {
      data: projects.map((project) => this.toDto(project)),
      nextCursor: projects.length === limit ? (projects.at(-1)?.id ?? null) : null,
    };
  }

  toDto(record: ProjectRecord): ProjectDto {
    return {
      id: record.id,
      organizationId: record.organizationId,
      workspaceId: record.workspaceId,
      code: record.code,
      name: record.name,
      description: record.description,
      status: record.status,
      priority: record.priority,
      startDate: record.startDate?.toISOString().slice(0, 10) ?? null,
      targetEndDate: record.targetEndDate?.toISOString().slice(0, 10) ?? null,
      progressPercent: record.progressPercent,
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