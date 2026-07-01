import type { UserId, WorkspaceId } from '@atlas/shared-kernel';

export interface WorkspaceRecord {
  readonly id: WorkspaceId;
  readonly slug: string;
  readonly name: string;
  readonly displayName: string | null;
  readonly ownerUserId: UserId;
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateWorkspaceData {
  readonly slug: string;
  readonly name: string;
  readonly displayName?: string;
  readonly ownerUserId: UserId;
  readonly createdById: UserId;
}

export interface ListWorkspacesFilter {
  readonly userId: UserId;
  readonly limit: number;
  readonly cursor?: string;
}

export interface WorkspaceRepository {
  findById(id: WorkspaceId): Promise<WorkspaceRecord | null>;
  findBySlug(slug: string): Promise<WorkspaceRecord | null>;
  create(data: CreateWorkspaceData): Promise<WorkspaceRecord>;
  list(filter: ListWorkspacesFilter): Promise<WorkspaceRecord[]>;
  addMember(workspaceId: WorkspaceId, userId: UserId, isAdmin?: boolean): Promise<void>;
}