import {
  err,
  ok,
  ValidationError,
  type OrganizationId,
  type Result,
} from '@atlas/shared-kernel';

import type { FileRepository, StorageQuotaRecord } from '../../domain/repositories/file.repository.js';

export interface QuotaUsageDto {
  readonly organization_id: string;
  readonly max_storage_bytes: string;
  readonly max_file_count: string;
  readonly max_single_upload_bytes: string;
  readonly used_storage_bytes: string;
  readonly used_file_count: string;
  readonly warning_threshold_pct: number;
  readonly hard_limit_enforced: boolean;
  readonly usage_pct: number;
  readonly at_warning: boolean;
}

export interface QuotaCheckResult {
  readonly allowed: boolean;
  readonly usage: QuotaUsageDto;
}

export interface QuotaServiceDeps {
  readonly fileRepository: FileRepository;
}

export class QuotaService {
  constructor(private readonly deps: QuotaServiceDeps) {}

  async checkQuota(
    organizationId: OrganizationId,
    additionalBytes: bigint,
    additionalFileCount = 1n,
  ): Promise<Result<QuotaCheckResult, ValidationError>> {
    const quota = await this.deps.fileRepository.getQuota(organizationId);

    if (quota === null) {
      return err(
        new ValidationError('Storage quota is not configured for this organization', {
          field: 'organization_id',
        }),
      );
    }

    const usage = this.toUsageDto(quota);
    const projectedStorage = quota.usedStorageBytes + additionalBytes;
    const projectedFiles = quota.usedFileCount + additionalFileCount;

    const exceedsStorage = projectedStorage > quota.maxStorageBytes;
    const exceedsFiles = projectedFiles > quota.maxFileCount;
    const exceedsSingleUpload = additionalBytes > quota.maxSingleUploadBytes;

    const blocked =
      quota.hardLimitEnforced && (exceedsStorage || exceedsFiles || exceedsSingleUpload);

    return ok({
      allowed: !blocked,
      usage,
    });
  }

  async getUsage(
    organizationId: OrganizationId,
  ): Promise<Result<QuotaUsageDto, ValidationError>> {
    const quota = await this.deps.fileRepository.getQuota(organizationId);

    if (quota === null) {
      return err(
        new ValidationError('Storage quota is not configured for this organization', {
          field: 'organization_id',
        }),
      );
    }

    return ok(this.toUsageDto(quota));
  }

  private toUsageDto(quota: StorageQuotaRecord): QuotaUsageDto {
    const usagePct =
      quota.maxStorageBytes > 0n
        ? Number((quota.usedStorageBytes * 10000n) / quota.maxStorageBytes) / 100
        : 0;

    return {
      organization_id: quota.organizationId,
      max_storage_bytes: quota.maxStorageBytes.toString(),
      max_file_count: quota.maxFileCount.toString(),
      max_single_upload_bytes: quota.maxSingleUploadBytes.toString(),
      used_storage_bytes: quota.usedStorageBytes.toString(),
      used_file_count: quota.usedFileCount.toString(),
      warning_threshold_pct: quota.warningThresholdPct,
      hard_limit_enforced: quota.hardLimitEnforced,
      usage_pct: usagePct,
      at_warning: usagePct >= quota.warningThresholdPct,
    };
  }
}