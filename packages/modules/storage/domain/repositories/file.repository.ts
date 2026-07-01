import type { OrganizationId, UserId } from '@atlas/shared-kernel';

import type { FolderId } from './folder.repository.js';

export type FileId = string & { readonly __brand: 'FileId' };
export type UploadId = string & { readonly __brand: 'UploadId' };

export type FileStatus =
  | 'pending'
  | 'uploading'
  | 'scanning'
  | 'clean'
  | 'infected'
  | 'quarantined'
  | 'rejected'
  | 'deleted';

export type SensitivityClass = 'public' | 'standard' | 'restricted' | 'confidential';

export type FilePermissionGranteeType = 'user' | 'team' | 'role' | 'workspace';

export type FilePermissionLevel = 'read' | 'write' | 'delete' | 'share' | 'admin';

export interface FileRecord {
  readonly id: FileId;
  readonly organizationId: OrganizationId;
  readonly folderId: FolderId | null;
  readonly name: string;
  readonly originalName: string;
  readonly mimeType: string;
  readonly extension: string | null;
  readonly sizeBytes: bigint;
  readonly contentHash: Buffer;
  readonly bucket: string;
  readonly objectKey: string;
  readonly encryptionKeyId: string;
  readonly status: FileStatus;
  readonly currentVersionNumber: number;
  readonly isStarred: boolean;
  readonly sensitivityClass: SensitivityClass;
  readonly legalHold: boolean;
  readonly retentionUntil: Date | null;
  readonly scannedAt: Date | null;
  readonly scanResult: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: UserId;
  readonly version: number;
}

export interface CreateFileData {
  readonly organizationId: OrganizationId;
  readonly folderId?: FolderId;
  readonly name: string;
  readonly originalName: string;
  readonly mimeType: string;
  readonly extension?: string;
  readonly sizeBytes: bigint;
  readonly contentHash: Buffer;
  readonly bucket: string;
  readonly objectKey: string;
  readonly encryptionKeyId: string;
  readonly status: FileStatus;
  readonly sensitivityClass?: SensitivityClass;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly createdById: UserId;
}

export interface CompleteUploadData {
  readonly organizationId: OrganizationId;
  readonly fileId: FileId;
  readonly contentHash: Buffer;
  readonly sizeBytes: bigint;
  readonly updatedById: UserId;
  readonly changeSummary?: string;
}

export interface ListFilesFilter {
  readonly organizationId: OrganizationId;
  readonly folderId?: FolderId;
  readonly status?: FileStatus;
  readonly isStarred?: boolean;
  readonly limit: number;
  readonly cursor?: string;
}

export interface FilePermissionRecord {
  readonly id: string;
  readonly fileId: FileId;
  readonly granteeType: FilePermissionGranteeType;
  readonly granteeId: string;
  readonly permission: FilePermissionLevel;
  readonly grantedBy: UserId;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
}

export interface CreateFilePermissionData {
  readonly organizationId: OrganizationId;
  readonly fileId: FileId;
  readonly granteeType: FilePermissionGranteeType;
  readonly granteeId: string;
  readonly permission: FilePermissionLevel;
  readonly grantedById: UserId;
  readonly expiresAt?: Date;
}

export interface StorageQuotaRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly maxStorageBytes: bigint;
  readonly maxFileCount: bigint;
  readonly maxSingleUploadBytes: bigint;
  readonly usedStorageBytes: bigint;
  readonly usedFileCount: bigint;
  readonly warningThresholdPct: number;
  readonly hardLimitEnforced: boolean;
}

export interface FileRepository {
  findById(organizationId: OrganizationId, fileId: FileId): Promise<FileRecord | null>;
  create(data: CreateFileData): Promise<FileRecord>;
  list(filter: ListFilesFilter): Promise<FileRecord[]>;
  softDelete(organizationId: OrganizationId, fileId: FileId, updatedById: UserId): Promise<FileRecord | null>;
  completeUpload(data: CompleteUploadData): Promise<FileRecord | null>;
  createPermission(data: CreateFilePermissionData): Promise<FilePermissionRecord>;
  getQuota(organizationId: OrganizationId): Promise<StorageQuotaRecord | null>;
  adjustQuotaUsage(
    organizationId: OrganizationId,
    deltaStorageBytes: bigint,
    deltaFileCount: bigint,
  ): Promise<StorageQuotaRecord | null>;
}