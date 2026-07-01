import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  type OrganizationId,
  type UserId,
} from '@atlas/shared-kernel';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockRandomUUID } = vi.hoisted(() => ({
  mockRandomUUID: vi.fn(),
}));

vi.mock('node:crypto', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:crypto')>();
  return {
    ...original,
    randomUUID: mockRandomUUID,
  };
});

import {
  FileService,
  computeContentHashHex,
} from '../application/services/file.service.js';
import { QuotaService } from '../application/services/quota.service.js';
import type { OrganizationMembershipPort } from '../application/ports/organization-membership.port.js';
import type {
  FileId,
  FileRecord,
  FileRepository,
  StorageQuotaRecord,
} from '../domain/repositories/file.repository.js';
import type { FolderRepository } from '../domain/repositories/folder.repository.js';
import type { S3StorageAdapter } from '../infrastructure/storage/s3-storage.adapter.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;
const USER_ID = '550e8400-e29b-41d4-a716-446655440000' as UserId;
const FILE_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7' as FileId;
const UPLOAD_ID = '8d9e6679-7425-40de-944b-e07fc1f90ae8';

const DEFAULT_QUOTA: StorageQuotaRecord = {
  id: 'quota-1',
  organizationId: ORG_ID,
  maxStorageBytes: 10_737_418_240n,
  maxFileCount: 10_000n,
  maxSingleUploadBytes: 524_288_000n,
  usedStorageBytes: 0n,
  usedFileCount: 0n,
  warningThresholdPct: 80,
  hardLimitEnforced: true,
};

function createUploadingFile(overrides: Partial<FileRecord> = {}): FileRecord {
  return {
    id: FILE_ID,
    organizationId: ORG_ID,
    folderId: null,
    name: 'report.pdf',
    originalName: 'report.pdf',
    mimeType: 'application/pdf',
    extension: '.pdf',
    sizeBytes: 1024n,
    contentHash: Buffer.alloc(32),
    bucket: 'atlas-uploads-dev',
    objectKey: `org/${ORG_ID}/files/${FILE_ID}/v/1/pending.pdf`,
    encryptionKeyId: 'local-dev-key',
    status: 'uploading',
    currentVersionNumber: 1,
    isStarred: false,
    sensitivityClass: 'standard',
    legalHold: false,
    retentionUntil: null,
    scannedAt: null,
    scanResult: null,
    metadata: { upload_id: UPLOAD_ID },
    createdAt: new Date('2026-06-30T12:00:00.000Z'),
    updatedAt: new Date('2026-06-30T12:00:00.000Z'),
    createdBy: USER_ID,
    version: 1,
    ...overrides,
  };
}

function createFileService(overrides: {
  fileRepository?: Partial<FileRepository>;
  folderRepository?: Partial<FolderRepository>;
  membershipPort?: Partial<OrganizationMembershipPort>;
  storageAdapter?: Partial<S3StorageAdapter>;
} = {}) {
  const fileRepository: FileRepository = {
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation(async (data) => createUploadingFile({
      id: FILE_ID,
      folderId: data.folderId ?? null,
      name: data.name,
      originalName: data.originalName,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      bucket: data.bucket,
      objectKey: data.objectKey,
      metadata: data.metadata ?? {},
      status: data.status,
    })),
    list: vi.fn().mockResolvedValue([]),
    softDelete: vi.fn(),
    completeUpload: vi.fn(),
    createPermission: vi.fn(),
    getQuota: vi.fn().mockResolvedValue(DEFAULT_QUOTA),
    adjustQuotaUsage: vi.fn().mockResolvedValue(DEFAULT_QUOTA),
    ...overrides.fileRepository,
  };

  const folderRepository: FolderRepository = {
    findById: vi.fn().mockResolvedValue(null),
    findBySlug: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    ...overrides.folderRepository,
  };

  const membershipPort: OrganizationMembershipPort = {
    isActiveMember: vi.fn().mockResolvedValue(true),
    ...overrides.membershipPort,
  };

  const storageAdapter: S3StorageAdapter = {
    bucket: 'atlas-uploads-dev',
    createPresignedUpload: vi.fn().mockResolvedValue({
      uploadUrl: 'https://storage.example/upload',
      uploadMethod: 'PUT',
      uploadHeaders: { 'Content-Type': 'application/pdf' },
      expiresAt: new Date('2026-06-30T13:00:00.000Z'),
    }),
    createPresignedDownload: vi.fn().mockResolvedValue({
      downloadUrl: 'https://storage.example/download',
      expiresAt: new Date('2026-06-30T13:00:00.000Z'),
    }),
    objectExists: vi.fn().mockResolvedValue(true),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    ...overrides.storageAdapter,
  };

  const quotaService = new QuotaService({ fileRepository });
  const fileService = new FileService({
    fileRepository,
    folderRepository,
    membershipPort,
    quotaService,
    storageAdapter,
    encryptionKeyId: 'local-dev-key',
  });

  return { fileService, fileRepository, folderRepository, membershipPort, storageAdapter };
}

describe('FileService', () => {
  beforeEach(() => {
    mockRandomUUID.mockReset();
    mockRandomUUID.mockReturnValueOnce(FILE_ID).mockReturnValueOnce(UPLOAD_ID);
  });

  it('initiateUpload returns presigned upload session metadata', async () => {
    const { fileService, fileRepository, storageAdapter } = createFileService();

    const result = await fileService.initiateUpload(
      ORG_ID,
      {
        original_name: 'report.pdf',
        mime_type: 'application/pdf',
        size_bytes: '1024',
      },
      USER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.file_id).toBe(FILE_ID);
    expect(result.value.upload_id).toBe(UPLOAD_ID);
    expect(result.value.upload_url).toBe('https://storage.example/upload');
    expect(result.value.upload_method).toBe('PUT');
    expect(fileRepository.create).toHaveBeenCalledOnce();
    expect(storageAdapter.createPresignedUpload).toHaveBeenCalledOnce();
  });

  it('initiateUpload rejects when storage quota is exceeded', async () => {
    const { fileService } = createFileService({
      fileRepository: {
        getQuota: vi.fn().mockResolvedValue({
          ...DEFAULT_QUOTA,
          usedStorageBytes: DEFAULT_QUOTA.maxStorageBytes,
        }),
      },
    });

    const result = await fileService.initiateUpload(
      ORG_ID,
      {
        original_name: 'large.bin',
        mime_type: 'application/octet-stream',
        size_bytes: '1024',
      },
      USER_ID,
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toBeInstanceOf(ValidationError);
    expect(result.error.message).toContain('quota');
  });

  it('initiateUpload rejects non-members', async () => {
    const { fileService } = createFileService({
      membershipPort: {
        isActiveMember: vi.fn().mockResolvedValue(false),
      },
    });

    const result = await fileService.initiateUpload(
      ORG_ID,
      {
        original_name: 'report.pdf',
        mime_type: 'application/pdf',
        size_bytes: '1024',
      },
      USER_ID,
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('completeUpload finalizes file and sets scanning status', async () => {
    const contentHash = computeContentHashHex(Buffer.from('file-bytes'));
    const scanningFile = createUploadingFile({ status: 'scanning' });

    const { fileService, fileRepository } = createFileService({
      fileRepository: {
        findById: vi.fn().mockResolvedValue(createUploadingFile()),
        completeUpload: vi.fn().mockResolvedValue(scanningFile),
      },
    });

    const result = await fileService.completeUpload(
      ORG_ID,
      {
        upload_id: UPLOAD_ID,
        file_id: FILE_ID,
        content_hash: contentHash,
      },
      USER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.status).toBe('scanning');
    expect(fileRepository.completeUpload).toHaveBeenCalledOnce();
    expect(fileRepository.adjustQuotaUsage).toHaveBeenCalledWith(ORG_ID, 1024n, 1n);
  });

  it('completeUpload rejects when uploaded object is missing', async () => {
    const { fileService } = createFileService({
      fileRepository: {
        findById: vi.fn().mockResolvedValue(createUploadingFile()),
      },
      storageAdapter: {
        objectExists: vi.fn().mockResolvedValue(false),
      },
    });

    const result = await fileService.completeUpload(
      ORG_ID,
      {
        upload_id: UPLOAD_ID,
        file_id: FILE_ID,
        content_hash: computeContentHashHex(Buffer.from('missing')),
      },
      USER_ID,
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toBeInstanceOf(ValidationError);
    expect(result.error.message).toContain('not found');
  });

  it('getFile returns not found for missing files', async () => {
    const { fileService } = createFileService();

    const result = await fileService.getFile(ORG_ID, FILE_ID, USER_ID);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toBeInstanceOf(NotFoundError);
  });

  it('deleteFile soft-deletes file and adjusts quota for finalized files', async () => {
    const cleanFile = createUploadingFile({ status: 'clean' });
    const deletedFile = createUploadingFile({ status: 'deleted' });

    const { fileService, fileRepository } = createFileService({
      fileRepository: {
        findById: vi.fn().mockResolvedValue(cleanFile),
        softDelete: vi.fn().mockResolvedValue(deletedFile),
      },
    });

    const result = await fileService.deleteFile(ORG_ID, FILE_ID, USER_ID);

    expect(result.ok).toBe(true);
    expect(fileRepository.softDelete).toHaveBeenCalledWith(ORG_ID, FILE_ID, USER_ID);
    expect(fileRepository.adjustQuotaUsage).toHaveBeenCalledWith(ORG_ID, -1024n, -1n);
  });

  it('createShareLink grants permission and returns presigned download URL', async () => {
    const cleanFile = createUploadingFile({ status: 'clean' });

    const { fileService, fileRepository, storageAdapter } = createFileService({
      fileRepository: {
        findById: vi.fn().mockResolvedValue(cleanFile),
        createPermission: vi.fn().mockResolvedValue({
          id: 'share-1',
          fileId: FILE_ID,
          granteeType: 'user',
          granteeId: USER_ID,
          permission: 'read',
          grantedBy: USER_ID,
          expiresAt: null,
          createdAt: new Date('2026-06-30T12:00:00.000Z'),
        }),
      },
    });

    const result = await fileService.createShareLink(
      ORG_ID,
      FILE_ID,
      {
        grantee_type: 'user',
        grantee_id: USER_ID,
        permission: 'read',
      },
      USER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.share_id).toBe('share-1');
    expect(result.value.download_url).toBe('https://storage.example/download');
    expect(fileRepository.createPermission).toHaveBeenCalledOnce();
    expect(storageAdapter.createPresignedDownload).toHaveBeenCalledOnce();
  });
});