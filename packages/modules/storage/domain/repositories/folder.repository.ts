import type { OrganizationId, UserId } from '@atlas/shared-kernel';

export type FolderId = string & { readonly __brand: 'FolderId' };

export interface FolderRecord {
  readonly id: FolderId;
  readonly organizationId: OrganizationId;
  readonly workspaceId: string | null;
  readonly parentFolderId: FolderId | null;
  readonly name: string;
  readonly slug: string;
  readonly path: string;
  readonly depth: number;
  readonly description: string | null;
  readonly color: string | null;
  readonly isSystem: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: UserId;
  readonly version: number;
}

export interface CreateFolderData {
  readonly organizationId: OrganizationId;
  readonly workspaceId?: string;
  readonly parentFolderId?: FolderId;
  readonly name: string;
  readonly slug: string;
  readonly path: string;
  readonly depth: number;
  readonly description?: string;
  readonly color?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly createdById: UserId;
}

export interface ListFoldersFilter {
  readonly organizationId: OrganizationId;
  readonly workspaceId?: string;
  readonly parentFolderId?: FolderId | null;
  readonly limit: number;
  readonly cursor?: string;
}

export interface FolderRepository {
  findById(organizationId: OrganizationId, folderId: FolderId): Promise<FolderRecord | null>;
  findBySlug(
    organizationId: OrganizationId,
    parentFolderId: FolderId | null,
    slug: string,
  ): Promise<FolderRecord | null>;
  create(data: CreateFolderData): Promise<FolderRecord>;
  list(filter: ListFoldersFilter): Promise<FolderRecord[]>;
}