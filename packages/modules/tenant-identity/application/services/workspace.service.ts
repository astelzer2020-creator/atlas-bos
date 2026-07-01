import {
  ConflictError,
  err,
  NotFoundError,
  ok,
  Slug,
  ValidationError,
  type Result,
  type UserId,
  type WorkspaceId,
} from '@atlas/shared-kernel';

import type {
  CreateWorkspaceData,
  WorkspaceRecord,
  WorkspaceRepository,
} from '../../domain/repositories/workspace.repository.js';

export interface CreateWorkspaceRequest {
  readonly slug: string;
  readonly name: string;
  readonly display_name?: string;
}

export interface WorkspaceDto {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly display_name: string | null;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface WorkspaceServiceDeps {
  readonly workspaceRepository: WorkspaceRepository;
}

export class WorkspaceService {
  constructor(private readonly deps: WorkspaceServiceDeps) {}

  async createWorkspace(
    request: CreateWorkspaceRequest,
    actorId: UserId,
  ): Promise<Result<WorkspaceDto, ValidationError | ConflictError>> {
    const slugResult = Slug.create(request.slug);
    if (!slugResult.ok) {
      return slugResult;
    }

    const existing = await this.deps.workspaceRepository.findBySlug(slugResult.value.value);

    if (existing !== null) {
      return err(
        new ConflictError('Workspace slug is already taken', { details: { slug: request.slug } }),
      );
    }

    const createData: CreateWorkspaceData = {
      slug: slugResult.value.value,
      name: request.name.trim(),
      ownerUserId: actorId,
      createdById: actorId,
      ...(request.display_name !== undefined ? { displayName: request.display_name } : {}),
    };

    const workspace = await this.deps.workspaceRepository.create(createData);
    await this.deps.workspaceRepository.addMember(workspace.id, actorId, true);

    return ok(this.toDto(workspace));
  }

  async getWorkspace(
    workspaceId: WorkspaceId,
    actorId: UserId,
  ): Promise<Result<WorkspaceDto, NotFoundError>> {
    const workspace = await this.deps.workspaceRepository.findById(workspaceId);

    if (workspace === null) {
      return err(new NotFoundError('Workspace', workspaceId));
    }

    const workspaces = await this.deps.workspaceRepository.list({
      userId: actorId,
      limit: 1000,
    });

    const hasAccess = workspaces.some((w) => w.id === workspaceId) || workspace.ownerUserId === actorId;

    if (!hasAccess) {
      return err(new NotFoundError('Workspace', workspaceId));
    }

    return ok(this.toDto(workspace));
  }

  async listWorkspaces(
    actorId: UserId,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<WorkspaceDto[]> {
    const workspaces = await this.deps.workspaceRepository.list({
      userId: actorId,
      limit: options.limit ?? 50,
      ...(options.cursor !== undefined ? { cursor: options.cursor } : {}),
    });

    return workspaces.map((workspace) => this.toDto(workspace));
  }

  private toDto(record: WorkspaceRecord): WorkspaceDto {
    return {
      id: record.id,
      slug: record.slug,
      name: record.name,
      display_name: record.displayName,
      is_active: record.isActive,
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString(),
    };
  }
}