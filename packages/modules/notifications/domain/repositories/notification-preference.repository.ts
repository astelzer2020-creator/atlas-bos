import type { OrganizationId, UserId } from '@atlas/shared-kernel';

import type { NotificationChannelType } from './notification.repository.js';

export type DigestMode = 'instant' | 'hourly' | 'daily' | 'weekly';

export interface NotificationPreferenceRecord {
  readonly id: string;
  readonly tenantId: OrganizationId;
  readonly userId: UserId;
  readonly definitionId: string;
  readonly notificationChannelId: string;
  readonly channelType: NotificationChannelType;
  readonly channelCode: string;
  readonly enabled: boolean;
  readonly digestMode: DigestMode | null;
  readonly quietHoursOverride: Record<string, unknown> | null;
  readonly metadata: Record<string, unknown>;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UpsertPreferenceData {
  readonly tenantId: OrganizationId;
  readonly userId: UserId;
  readonly definitionId: string;
  readonly notificationChannelId: string;
  readonly enabled: boolean;
  readonly digestMode?: DigestMode | null;
  readonly quietHoursOverride?: Record<string, unknown> | null;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdatePreferenceItem {
  readonly definitionId: string;
  readonly channelType: NotificationChannelType;
  readonly enabled: boolean;
  readonly digestMode?: DigestMode | null;
}

export interface NotificationPreferenceRepository {
  findByUser(
    tenantId: OrganizationId,
    userId: UserId,
  ): Promise<NotificationPreferenceRecord[]>;
  upsert(data: UpsertPreferenceData): Promise<NotificationPreferenceRecord>;
  bulkUpsert(
    tenantId: OrganizationId,
    userId: UserId,
    items: UpdatePreferenceItem[],
  ): Promise<NotificationPreferenceRecord[]>;
}