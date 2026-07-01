import type { Prisma, PrismaClient } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';

import type {
  CompleteUploadData,
  CreateFileData,
  CreateFilePermissionData,
  FileId,
  FilePermissionRecord,
  FileRecord,
  FileRepository,
  FileStatus,
  ListFilesFilter,
  SensitivityClass,
  StorageQuotaRecord,
} from '../../domain/repositories/file.repository.js';
import type { FolderId } from '../../domain/repositories/folder.repository.js';

export class PrismaFileRepository implements FileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(organizationId: OrganizationId, fileId: FileId): Promise<FileRecord | null> {
    const record = await this.prisma.file.findFirst({
      where: {
        id: fileId,
        tenantId: organizationId,
        deletedAt: null,
      },
    });

    return record === null ? null : this.toRecord(record);
  }

  async create(data: CreateFileData): Promise<FileRecord> {
    const record = await this.prisma.file.create({
      data: {
        tenantId: data.organizationId,
        name: data.name,
        originalName: data.originalName,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        contentHash: toBytes(data.contentHash),
        bucket: data.bucket,
        objectKey: data.objectKey,
        encryptionKeyId: data.encryptionKeyId,
        status: data.status,
        createdBy: data.createdById,
        folderId: data.folderId ?? null,
        extension: data.extension ?? null,
        sensitivityClass: data.sensitivityClass ?? 'standard',
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    return this.toRecord(record);
  }

  async list(filter: ListFilesFilter): Promise<FileRecord[]> {
    const records = await this.prisma.file.findMany({
      where: {
        tenantId: filter.organizationId,
        deletedAt: null,
        status: { not: 'deleted' },
        ...(filter.folderId !== undefined ? { folderId: filter.folderId } : {}),
        ...(filter.status !== undefined ? { status: filter.status } : {}),
        ...(filter.isStarred !== undefined ? { isStarred: filter.isStarred } : {}),
        ...(filter.cursor !== undefined ? { id: { gt: filter.cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: filter.limit,
    });

    return records.map((record) => this.toRecord(record));
  }

  async softDelete(
    organizationId: OrganizationId,
    fileId: FileId,
    updatedById: UserId,
  ): Promise<FileRecord | null> {
    const existing = await this.prisma.file.findFirst({
      where: {
        id: fileId,
        tenantId: organizationId,
        deletedAt: null,
      },
    });

    if (existing === null) {
      return null;
    }

    const record = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        status: 'deleted',
        deletedAt: new Date(),
        updatedBy: updatedById,
      },
    });

    return this.toRecord(record);
  }

  async completeUpload(data: CompleteUploadData): Promise<FileRecord | null> {
    const existing = await this.prisma.file.findFirst({
      where: {
        id: data.fileId,
        tenantId: data.organizationId,
        deletedAt: null,
      },
    });

    if (existing === null) {
      return null;
    }

    const [file] = await this.prisma.$transaction([
      this.prisma.file.update({
        where: { id: data.fileId },
        data: {
          contentHash: toBytes(data.contentHash),
          sizeBytes: data.sizeBytes,
          status: 'scanning',
          scannedAt: null,
          scanResult: null,
          updatedBy: data.updatedById,
        },
      }),
      this.prisma.fileVersion.create({
        data: {
          tenantId: data.organizationId,
          fileId: data.fileId,
          versionNumber: 1,
          isLatest: true,
          sizeBytes: data.sizeBytes,
          contentHash: toBytes(data.contentHash),
          bucket: existing.bucket,
          objectKey: existing.objectKey,
          mimeType: existing.mimeType,
          createdBy: data.updatedById,
          ...(data.changeSummary !== undefined ? { changeSummary: data.changeSummary } : {}),
        },
      }),
    ]);

    return this.toRecord(file);
  }

  async createPermission(data: CreateFilePermissionData): Promise<FilePermissionRecord> {
    const record = await this.prisma.filePermission.create({
      data: {
        tenantId: data.organizationId,
        fileId: data.fileId,
        granteeType: data.granteeType,
        granteeId: data.granteeId,
        permission: data.permission,
        grantedBy: data.grantedById,
        ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
      },
    });

    return {
      id: record.id,
      fileId: record.fileId as FileId,
      granteeType: record.granteeType,
      granteeId: record.granteeId,
      permission: record.permission,
      grantedBy: record.grantedBy as UserId,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
    };
  }

  async getQuota(organizationId: OrganizationId): Promise<StorageQuotaRecord | null> {
    const record = await this.prisma.storageQuota.findUnique({
      where: { tenantId: organizationId },
    });

    if (record === null) {
      return null;
    }

    return {
      id: record.id,
      organizationId: record.tenantId as OrganizationId,
      maxStorageBytes: record.maxStorageBytes,
      maxFileCount: record.maxFileCount,
      maxSingleUploadBytes: record.maxSingleUploadBytes,
      usedStorageBytes: record.usedStorageBytes,
      usedFileCount: record.usedFileCount,
      warningThresholdPct: record.warningThresholdPct,
      hardLimitEnforced: record.hardLimitEnforced,
    };
  }

  async adjustQuotaUsage(
    organizationId: OrganizationId,
    deltaStorageBytes: bigint,
    deltaFileCount: bigint,
  ): Promise<StorageQuotaRecord | null> {
    const existing = await this.prisma.storageQuota.findUnique({
      where: { tenantId: organizationId },
    });

    if (existing === null) {
      return null;
    }

    const nextUsedStorage =
      deltaStorageBytes >= 0n
        ? existing.usedStorageBytes + deltaStorageBytes
        : maxBigInt(0n, existing.usedStorageBytes + deltaStorageBytes);

    const nextUsedFiles =
      deltaFileCount >= 0n
        ? existing.usedFileCount + deltaFileCount
        : maxBigInt(0n, existing.usedFileCount + deltaFileCount);

    const record = await this.prisma.storageQuota.update({
      where: { tenantId: organizationId },
      data: {
        usedStorageBytes: nextUsedStorage,
        usedFileCount: nextUsedFiles,
        lastReconciledAt: new Date(),
      },
    });

    return {
      id: record.id,
      organizationId: record.tenantId as OrganizationId,
      maxStorageBytes: record.maxStorageBytes,
      maxFileCount: record.maxFileCount,
      maxSingleUploadBytes: record.maxSingleUploadBytes,
      usedStorageBytes: record.usedStorageBytes,
      usedFileCount: record.usedFileCount,
      warningThresholdPct: record.warningThresholdPct,
      hardLimitEnforced: record.hardLimitEnforced,
    };
  }

  private toRecord(record: {
    id: string;
    tenantId: string;
    folderId: string | null;
    name: string;
    originalName: string;
    mimeType: string;
    extension: string | null;
    sizeBytes: bigint;
    contentHash: Uint8Array;
    bucket: string;
    objectKey: string;
    encryptionKeyId: string;
    status: string;
    currentVersionNumber: number;
    isStarred: boolean;
    sensitivityClass: string;
    legalHold: boolean;
    retentionUntil: Date | null;
    scannedAt: Date | null;
    scanResult: string | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    version: number;
  }): FileRecord {
    return {
      id: record.id as FileId,
      organizationId: record.tenantId as OrganizationId,
      folderId: record.folderId as FolderId | null,
      name: record.name,
      originalName: record.originalName,
      mimeType: record.mimeType,
      extension: record.extension,
      sizeBytes: record.sizeBytes,
      contentHash: Buffer.from(record.contentHash),
      bucket: record.bucket,
      objectKey: record.objectKey,
      encryptionKeyId: record.encryptionKeyId,
      status: record.status as FileStatus,
      currentVersionNumber: record.currentVersionNumber,
      isStarred: record.isStarred,
      sensitivityClass: record.sensitivityClass as SensitivityClass,
      legalHold: record.legalHold,
      retentionUntil: record.retentionUntil,
      scannedAt: record.scannedAt,
      scanResult: record.scanResult,
      metadata: this.asMetadata(record.metadata),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy as UserId,
      version: record.version,
    };
  }

  private asMetadata(value: unknown): Readonly<Record<string, unknown>> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Readonly<Record<string, unknown>>;
    }

    return {};
  }
}

function maxBigInt(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

function toBytes(value: Buffer): Uint8Array<ArrayBuffer> {
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength) as Uint8Array<ArrayBuffer>;
}