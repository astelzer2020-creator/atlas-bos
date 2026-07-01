import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';

import {
  err,
  ForbiddenError,
  NotFoundError,
  ok,
  ValidationError,
  type OrganizationId,
  type Result,
  type UserId,
} from '@atlas/shared-kernel';

import type {
  CreateFileData,
  FileId,
  FilePermissionGranteeType,
  FilePermissionLevel,
  FileRecord,
  FileRepository,
  FileStatus,
  SensitivityClass,
  UploadId,
} from '../../domain/repositories/file.repository.js';
import type { FolderId } from '../../domain/repositories/folder.repository.js';
import type { FolderRepository } from '../../domain/repositories/folder.repository.js';
import type { OrganizationMembershipPort } from '../ports/organization-membership.port.js';
import type { QuotaService } from './quota.service.js';
import type { S3StorageAdapter } from '../../infrastructure/storage/s3-storage.adapter.js';

export interface InitiateUploadRequest {
  readonly original_name: string;
  readonly mime_type: string;
  readonly size_bytes: string;
  readonly folder_id?: string;
  readonly sensitivity_class?: SensitivityClass;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface UploadSessionDto {
  readonly upload_id: string;
  readonly file_id: string;
  readonly upload_url: string;
  readonly upload_method: 'PUT' | 'POST';
  readonly upload_headers?: Readonly<Record<string, string>>;
  readonly expires_at: string;
  readonly bucket: string;
  readonly object_key: string;
}

export interface CompleteUploadRequest {
  readonly upload_id: string;
  readonly file_id: string;
  readonly content_hash: string;
  readonly change_summary?: string;
}

export interface FileDto {
  readonly id: string;
  readonly organization_id: string;
  readonly folder_id: string | null;
  readonly name: string;
  readonly original_name: string;
  readonly mime_type: string;
  readonly extension: string | null;
  readonly size_bytes: string;
  readonly status: FileStatus;
  readonly current_version_number: number;
  readonly is_starred: boolean;
  readonly sensitivity_class: SensitivityClass;
  readonly legal_hold: boolean;
  readonly retention_until: string | null;
  readonly scanned_at: string | null;
  readonly scan_result: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly created_at: string;
  readonly updated_at: string;
  readonly created_by: string;
  readonly version: number;
}

export interface ShareLinkRequest {
  readonly grantee_type: FilePermissionGranteeType;
  readonly grantee_id: string;
  readonly permission: FilePermissionLevel;
  readonly expires_at?: string;
  readonly link_ttl_seconds?: number;
}

export interface ShareLinkDto {
  readonly share_id: string;
  readonly file_id: string;
  readonly permission: FilePermissionLevel;
  readonly grantee_type: FilePermissionGranteeType;
  readonly grantee_id: string;
  readonly download_url: string;
  readonly expires_at: string;
}

export interface FileServiceDeps {
  readonly fileRepository: FileRepository;
  readonly folderRepository: FolderRepository;
  readonly membershipPort: OrganizationMembershipPort;
  readonly quotaService: QuotaService;
  readonly storageAdapter: S3StorageAdapter;
  readonly encryptionKeyId: string;
  readonly uploadTtlSeconds?: number;
  readonly shareLinkTtlSeconds?: number;
}

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;
/** Zeroed hash until upload completes and the real content hash is supplied. */
const PENDING_UPLOAD_HASH = Buffer.alloc(32);

export class FileService {
  private readonly uploadTtlSeconds: number;
  private readonly shareLinkTtlSeconds: number;

  constructor(private readonly deps: FileServiceDeps) {
    this.uploadTtlSeconds = deps.uploadTtlSeconds ?? 3600;
    this.shareLinkTtlSeconds = deps.shareLinkTtlSeconds ?? 3600;
  }

  async initiateUpload(
    organizationId: OrganizationId,
    request: InitiateUploadRequest,
    actorId: UserId,
  ): Promise<
    Result<
      UploadSessionDto,
      ValidationError | ForbiddenError | NotFoundError
    >
  > {
    const access = await this.ensureMembership(organizationId, actorId);
    if (!access.ok) {
      return access;
    }

    const originalName = request.original_name.trim();
    if (originalName.length === 0) {
      return err(new ValidationError('original_name is required', { field: 'original_name' }));
    }

    const mimeType = request.mime_type.trim();
    if (mimeType.length === 0) {
      return err(new ValidationError('mime_type is required', { field: 'mime_type' }));
    }

    let sizeBytes: bigint;
    try {
      sizeBytes = BigInt(request.size_bytes);
    } catch {
      return err(new ValidationError('size_bytes must be a valid integer', { field: 'size_bytes' }));
    }

    if (sizeBytes <= 0n) {
      return err(new ValidationError('size_bytes must be greater than zero', { field: 'size_bytes' }));
    }

    if (request.folder_id !== undefined) {
      const folder = await this.deps.folderRepository.findById(
        organizationId,
        request.folder_id as FolderId,
      );

      if (folder === null) {
        return err(new NotFoundError('Folder', request.folder_id));
      }
    }

    const quotaCheck = await this.deps.quotaService.checkQuota(organizationId, sizeBytes);
    if (!quotaCheck.ok) {
      return quotaCheck;
    }

    if (!quotaCheck.value.allowed) {
      return err(
        new ValidationError('Storage quota exceeded', {
          field: 'size_bytes',
          details: { usage: quotaCheck.value.usage },
        }),
      );
    }

    const fileId = randomUUID() as FileId;
    const uploadId = randomUUID() as UploadId;
    const extension = this.extractExtension(originalName);
    const objectKey = this.buildObjectKey(organizationId, fileId, extension);
    const bucket = this.deps.storageAdapter.bucket;

    const createData: CreateFileData = {
      organizationId,
      name: originalName,
      originalName,
      mimeType,
      sizeBytes,
      contentHash: PENDING_UPLOAD_HASH,
      bucket,
      objectKey,
      encryptionKeyId: this.deps.encryptionKeyId,
      status: 'uploading',
      createdById: actorId,
      ...(extension !== null ? { extension } : {}),
      ...(request.folder_id !== undefined ? { folderId: request.folder_id as FolderId } : {}),
      ...(request.sensitivity_class !== undefined
        ? { sensitivityClass: request.sensitivity_class }
        : {}),
      metadata: {
        ...(request.metadata ?? {}),
        upload_id: uploadId,
      },
    };

    await this.deps.fileRepository.create(createData);

    const presigned = await this.deps.storageAdapter.createPresignedUpload({
      bucket,
      objectKey,
      mimeType,
      sizeBytes,
      expiresInSeconds: this.uploadTtlSeconds,
    });

    return ok({
      upload_id: uploadId,
      file_id: fileId,
      upload_url: presigned.uploadUrl,
      upload_method: presigned.uploadMethod,
      ...(presigned.uploadHeaders !== undefined ? { upload_headers: presigned.uploadHeaders } : {}),
      expires_at: presigned.expiresAt.toISOString(),
      bucket,
      object_key: objectKey,
    });
  }

  async completeUpload(
    organizationId: OrganizationId,
    request: CompleteUploadRequest,
    actorId: UserId,
  ): Promise<
    Result<
      FileDto,
      ValidationError | ForbiddenError | NotFoundError
    >
  > {
    const access = await this.ensureMembership(organizationId, actorId);
    if (!access.ok) {
      return access;
    }

    if (!SHA256_HEX_PATTERN.test(request.content_hash)) {
      return err(
        new ValidationError('content_hash must be a 64-character SHA-256 hex digest', {
          field: 'content_hash',
        }),
      );
    }

    const fileId = request.file_id as FileId;
    const existing = await this.deps.fileRepository.findById(organizationId, fileId);

    if (existing === null) {
      return err(new NotFoundError('File', request.file_id));
    }

    if (existing.status !== 'uploading' && existing.status !== 'pending') {
      return err(
        new ValidationError(`File is not awaiting upload completion (status: ${existing.status})`, {
          field: 'file_id',
        }),
      );
    }

    const storedUploadId = existing.metadata['upload_id'];
    if (typeof storedUploadId !== 'string' || storedUploadId !== request.upload_id) {
      return err(new ValidationError('Invalid upload session', { field: 'upload_id' }));
    }

    const objectExists = await this.deps.storageAdapter.objectExists(
      existing.bucket,
      existing.objectKey,
    );

    if (!objectExists) {
      return err(
        new ValidationError('Uploaded object not found in storage', { field: 'content_hash' }),
      );
    }

    const contentHash = Buffer.from(request.content_hash, 'hex');

    const updated = await this.deps.fileRepository.completeUpload({
      organizationId,
      fileId,
      contentHash,
      sizeBytes: existing.sizeBytes,
      updatedById: actorId,
      ...(request.change_summary !== undefined ? { changeSummary: request.change_summary } : {}),
    });

    if (updated === null) {
      return err(new NotFoundError('File', request.file_id));
    }

    await this.deps.fileRepository.adjustQuotaUsage(
      organizationId,
      existing.sizeBytes,
      1n,
    );

    return ok(this.toDto(updated));
  }

  async getFile(
    organizationId: OrganizationId,
    fileId: FileId,
    actorId: UserId,
  ): Promise<Result<FileDto, NotFoundError | ForbiddenError>> {
    const access = await this.ensureMembership(organizationId, actorId);
    if (!access.ok) {
      return access;
    }

    const file = await this.deps.fileRepository.findById(organizationId, fileId);

    if (file === null || file.status === 'deleted') {
      return err(new NotFoundError('File', fileId));
    }

    return ok(this.toDto(file));
  }

  async listFiles(
    organizationId: OrganizationId,
    actorId: UserId,
    options: {
      folderId?: string;
      status?: FileStatus;
      isStarred?: boolean;
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<Result<FileDto[], ForbiddenError>> {
    const access = await this.ensureMembership(organizationId, actorId);
    if (!access.ok) {
      return access;
    }

    const files = await this.deps.fileRepository.list({
      organizationId,
      limit: options.limit ?? 50,
      ...(options.folderId !== undefined ? { folderId: options.folderId as FolderId } : {}),
      ...(options.status !== undefined ? { status: options.status } : {}),
      ...(options.isStarred !== undefined ? { isStarred: options.isStarred } : {}),
      ...(options.cursor !== undefined ? { cursor: options.cursor } : {}),
    });

    return ok(files.map((file) => this.toDto(file)));
  }

  async deleteFile(
    organizationId: OrganizationId,
    fileId: FileId,
    actorId: UserId,
  ): Promise<Result<FileDto, NotFoundError | ForbiddenError | ValidationError>> {
    const access = await this.ensureMembership(organizationId, actorId);
    if (!access.ok) {
      return access;
    }

    const existing = await this.deps.fileRepository.findById(organizationId, fileId);

    if (existing === null || existing.status === 'deleted') {
      return err(new NotFoundError('File', fileId));
    }

    if (existing.legalHold) {
      return err(new ValidationError('File is under legal hold and cannot be deleted', {
        field: 'file_id',
      }));
    }

    const deleted = await this.deps.fileRepository.softDelete(organizationId, fileId, actorId);

    if (deleted === null) {
      return err(new NotFoundError('File', fileId));
    }

    if (existing.status === 'clean' || existing.status === 'scanning') {
      await this.deps.fileRepository.adjustQuotaUsage(
        organizationId,
        -existing.sizeBytes,
        -1n,
      );
    }

    return ok(this.toDto(deleted));
  }

  async createShareLink(
    organizationId: OrganizationId,
    fileId: FileId,
    request: ShareLinkRequest,
    actorId: UserId,
  ): Promise<
    Result<
      ShareLinkDto,
      ValidationError | ForbiddenError | NotFoundError
    >
  > {
    const access = await this.ensureMembership(organizationId, actorId);
    if (!access.ok) {
      return access;
    }

    const file = await this.deps.fileRepository.findById(organizationId, fileId);

    if (file === null || file.status === 'deleted') {
      return err(new NotFoundError('File', fileId));
    }

    if (file.status !== 'clean' && file.status !== 'scanning') {
      return err(
        new ValidationError('File must be uploaded before sharing', { field: 'file_id' }),
      );
    }

    let permissionExpiresAt: Date | undefined;
    if (request.expires_at !== undefined) {
      const parsed = new Date(request.expires_at);
      if (Number.isNaN(parsed.getTime())) {
        return err(new ValidationError('expires_at must be a valid ISO-8601 timestamp', {
          field: 'expires_at',
        }));
      }
      permissionExpiresAt = parsed;
    }

    const linkTtl = request.link_ttl_seconds ?? this.shareLinkTtlSeconds;
    if (linkTtl <= 0 || linkTtl > 604_800) {
      return err(
        new ValidationError('link_ttl_seconds must be between 1 and 604800', {
          field: 'link_ttl_seconds',
        }),
      );
    }

    const permission = await this.deps.fileRepository.createPermission({
      organizationId,
      fileId,
      granteeType: request.grantee_type,
      granteeId: request.grantee_id,
      permission: request.permission,
      grantedById: actorId,
      ...(permissionExpiresAt !== undefined ? { expiresAt: permissionExpiresAt } : {}),
    });

    const presigned = await this.deps.storageAdapter.createPresignedDownload({
      bucket: file.bucket,
      objectKey: file.objectKey,
      expiresInSeconds: linkTtl,
      fileName: file.originalName,
    });

    return ok({
      share_id: permission.id,
      file_id: fileId,
      permission: request.permission,
      grantee_type: request.grantee_type,
      grantee_id: request.grantee_id,
      download_url: presigned.downloadUrl,
      expires_at: presigned.expiresAt.toISOString(),
    });
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

  private buildObjectKey(
    organizationId: OrganizationId,
    fileId: FileId,
    extension: string | null,
  ): string {
    const suffix = extension === null ? 'bin' : extension.replace(/^\./, '');
    return `org/${organizationId}/files/${fileId}/v/1/pending.${suffix}`;
  }

  private extractExtension(fileName: string): string | null {
    const extension = extname(fileName);
    return extension.length > 0 ? extension : null;
  }

  private toDto(record: FileRecord): FileDto {
    return {
      id: record.id,
      organization_id: record.organizationId,
      folder_id: record.folderId,
      name: record.name,
      original_name: record.originalName,
      mime_type: record.mimeType,
      extension: record.extension,
      size_bytes: record.sizeBytes.toString(),
      status: record.status,
      current_version_number: record.currentVersionNumber,
      is_starred: record.isStarred,
      sensitivity_class: record.sensitivityClass,
      legal_hold: record.legalHold,
      retention_until: record.retentionUntil?.toISOString() ?? null,
      scanned_at: record.scannedAt?.toISOString() ?? null,
      scan_result: record.scanResult,
      metadata: record.metadata,
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString(),
      created_by: record.createdBy,
      version: record.version,
    };
  }
}

/** Utility for computing SHA-256 hex digest of file bytes (used by clients and tests). */
export function computeContentHashHex(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}