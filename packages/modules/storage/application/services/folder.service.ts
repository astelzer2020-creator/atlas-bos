import {
  ConflictError,
  err,
  ForbiddenError,
  NotFoundError,
  ok,
  Slug,
  ValidationError,
  type OrganizationId,
  type Result,
  type UserId,
} from '@atlas/shared-kernel';

import type {
  CreateFolderData,
  FolderId,
  FolderRecord,
  FolderRepository,
} from '../../domain/repositories/folder.repository.js';
import type { OrganizationMembershipPort } from '../ports/organization-membership.port.js';

export interface CreateFolderRequest {
  readonly name: string;
  readonly slug: string;
  readonly parent_folder_id?: string;
  readonly workspace_id?: string;
  readonly description?: string;
  readonly color?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface FolderDto {
  readonly id: string;
  readonly organization_id: string;
  readonly workspace_id: string | null;
  readonly parent_folder_id: string | null;
  readonly name: string;
  readonly slug: string;
  readonly path: string;
  readonly depth: number;
  readonly description: string | null;
  readonly color: string | null;
  readonly is_system: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly created_at: string;
  readonly updated_at: string;
  readonly created_by: string;
  readonly version: number;
}

export interface FolderServiceDeps {
  readonly folderRepository: FolderRepository;
  readonly membershipPort: OrganizationMembershipPort;
}

export class FolderService {
  constructor(private readonly deps: FolderServiceDeps) {}

  async createFolder(
    organizationId: OrganizationId,
    request: CreateFolderRequest,
    actorId: UserId,
  ): Promise<Result<FolderDto, ValidationError | ConflictError | ForbiddenError | NotFoundError>> {
    const access = await this.ensureMembership(organizationId, actorId);
    if (!access.ok) {
      return access;
    }

    const slugResult = Slug.create(request.slug);
    if (!slugResult.ok) {
      return slugResult;
    }

    const name = request.name.trim();
    if (name.length === 0) {
      return err(new ValidationError('Folder name is required', { field: 'name' }));
    }

    let parentFolder: FolderRecord | null = null;
    let parentFolderId: FolderId | null = null;

    if (request.parent_folder_id !== undefined) {
      parentFolderId = request.parent_folder_id as FolderId;
      parentFolder = await this.deps.folderRepository.findById(organizationId, parentFolderId);

      if (parentFolder === null) {
        return err(new NotFoundError('Folder', request.parent_folder_id));
      }

      if (parentFolder.depth >= 20) {
        return err(
          new ValidationError('Maximum folder depth of 20 exceeded', { field: 'parent_folder_id' }),
        );
      }
    }

    const existing = await this.deps.folderRepository.findBySlug(
      organizationId,
      parentFolderId,
      slugResult.value.value,
    );

    if (existing !== null) {
      return err(
        new ConflictError('Folder slug already exists at this level', {
          details: { slug: request.slug },
        }),
      );
    }

    const path = parentFolder === null
      ? `root.${slugResult.value.value}`
      : `${parentFolder.path}.${slugResult.value.value}`;

    const createData: CreateFolderData = {
      organizationId,
      name,
      slug: slugResult.value.value,
      path,
      depth: parentFolder === null ? 0 : parentFolder.depth + 1,
      createdById: actorId,
      ...(request.workspace_id !== undefined ? { workspaceId: request.workspace_id } : {}),
      ...(parentFolderId !== null ? { parentFolderId } : {}),
      ...(request.description !== undefined ? { description: request.description } : {}),
      ...(request.color !== undefined ? { color: request.color } : {}),
      ...(request.metadata !== undefined ? { metadata: request.metadata } : {}),
    };

    const folder = await this.deps.folderRepository.create(createData);

    return ok(this.toDto(folder));
  }

  async listFolders(
    organizationId: OrganizationId,
    actorId: UserId,
    options: {
      workspaceId?: string;
      parentFolderId?: string | null;
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<Result<FolderDto[], ForbiddenError>> {
    const access = await this.ensureMembership(organizationId, actorId);
    if (!access.ok) {
      return access;
    }

    const folders = await this.deps.folderRepository.list({
      organizationId,
      limit: options.limit ?? 50,
      ...(options.workspaceId !== undefined ? { workspaceId: options.workspaceId } : {}),
      ...(options.parentFolderId !== undefined
        ? { parentFolderId: options.parentFolderId as FolderId | null }
        : {}),
      ...(options.cursor !== undefined ? { cursor: options.cursor } : {}),
    });

    return ok(folders.map((folder) => this.toDto(folder)));
  }

  async getFolder(
    organizationId: OrganizationId,
    folderId: FolderId,
    actorId: UserId,
  ): Promise<Result<FolderDto, NotFoundError | ForbiddenError>> {
    const access = await this.ensureMembership(organizationId, actorId);
    if (!access.ok) {
      return access;
    }

    const folder = await this.deps.folderRepository.findById(organizationId, folderId);

    if (folder === null) {
      return err(new NotFoundError('Folder', folderId));
    }

    return ok(this.toDto(folder));
  }

  private async ensureMembership(
    organizationId: OrganizationId,
    actorId: UserId,
  ): Promise<Result<void, ForbiddenError>> {
    const isMember = await this.deps.membershipPort.isActiveMember(organizationId, actorId);

    if (!isMember) {
      return err(new ForbiddenError('You do not have access to this organization'));
    }

    return ok(undefined);
  }

  private toDto(record: FolderRecord): FolderDto {
    return {
      id: record.id,
      organization_id: record.organizationId,
      workspace_id: record.workspaceId,
      parent_folder_id: record.parentFolderId,
      name: record.name,
      slug: record.slug,
      path: record.path,
      depth: record.depth,
      description: record.description,
      color: record.color,
      is_system: record.isSystem,
      metadata: record.metadata,
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString(),
      created_by: record.createdBy,
      version: record.version,
    };
  }
}