import type { PrismaClient } from '@atlas/database';

import { FileService } from './application/services/file.service.js';
import { FolderService } from './application/services/folder.service.js';
import { QuotaService } from './application/services/quota.service.js';
import { PrismaFileRepository } from './infrastructure/persistence/prisma-file.repository.js';
import { PrismaFolderRepository } from './infrastructure/persistence/prisma-folder.repository.js';
import { PrismaOrganizationMembershipAdapter } from './infrastructure/persistence/prisma-organization-membership.adapter.js';
import {
  createStorageAdapter,
  resolveStorageConfigFromEnv,
  type S3StorageAdapter,
  type StorageAdapterConfig,
} from './infrastructure/storage/s3-storage.adapter.js';

export { FileService } from './application/services/file.service.js';
export { FolderService } from './application/services/folder.service.js';
export { QuotaService } from './application/services/quota.service.js';
export { registerStorageRoutes } from './presentation/rest/storage.routes.js';

export type { StorageRoutesDeps, StorageRouteContext } from './presentation/rest/storage.routes.js';
export type { S3StorageAdapter, StorageAdapterConfig } from './infrastructure/storage/s3-storage.adapter.js';

export interface StorageModuleOptions {
  readonly prisma: PrismaClient;
  readonly storageAdapter?: S3StorageAdapter;
  readonly storageConfig?: StorageAdapterConfig;
  readonly encryptionKeyId?: string;
  readonly uploadTtlSeconds?: number;
  readonly shareLinkTtlSeconds?: number;
}

export interface StorageModule {
  readonly folderService: FolderService;
  readonly fileService: FileService;
  readonly quotaService: QuotaService;
  readonly storageAdapter: S3StorageAdapter;
}

/**
 * Wires documents & storage bounded context services with Prisma repositories.
 * Maps organizationId (API layer) to tenantId (Prisma storage schema).
 */
export async function createStorageModule(
  options: StorageModuleOptions,
): Promise<StorageModule> {
  const storageConfig = options.storageConfig ?? resolveStorageConfigFromEnv();
  const storageAdapter =
    options.storageAdapter ?? (await createStorageAdapter(storageConfig));

  const encryptionKeyId =
    options.encryptionKeyId ??
    process.env['ATLAS_STORAGE_KMS_KEY_ID'] ??
    'local-dev-key';

  const folderRepository = new PrismaFolderRepository(options.prisma);
  const fileRepository = new PrismaFileRepository(options.prisma);
  const membershipPort = new PrismaOrganizationMembershipAdapter(options.prisma);

  const quotaService = new QuotaService({ fileRepository });
  const folderService = new FolderService({ folderRepository, membershipPort });
  const fileService = new FileService({
    fileRepository,
    folderRepository,
    membershipPort,
    quotaService,
    storageAdapter,
    encryptionKeyId,
    ...(options.uploadTtlSeconds !== undefined
      ? { uploadTtlSeconds: options.uploadTtlSeconds }
      : {}),
    ...(options.shareLinkTtlSeconds !== undefined
      ? { shareLinkTtlSeconds: options.shareLinkTtlSeconds }
      : {}),
  });

  return {
    folderService,
    fileService,
    quotaService,
    storageAdapter,
  };
}