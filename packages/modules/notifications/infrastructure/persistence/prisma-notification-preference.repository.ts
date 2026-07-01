import type { Prisma, PrismaClient } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';

import type {
  DigestMode,
  NotificationPreferenceRecord,
  NotificationPreferenceRepository,
  UpdatePreferenceItem,
  UpsertPreferenceData,
} from '../../domain/repositories/notification-preference.repository.js';
import type { NotificationChannelType } from '../../domain/repositories/notification.repository.js';

export class PrismaNotificationPreferenceRepository implements NotificationPreferenceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUser(
    tenantId: OrganizationId,
    userId: UserId,
  ): Promise<NotificationPreferenceRecord[]> {
    const records = await this.prisma.notificationPreference.findMany({
      where: { tenantId, userId },
      include: { notificationChannel: true },
      orderBy: [{ definitionId: 'asc' }, { notificationChannelId: 'asc' }],
    });

    return records.map((record) => this.toRecord(record));
  }

  async upsert(data: UpsertPreferenceData): Promise<NotificationPreferenceRecord> {
    const record = await this.prisma.notificationPreference.upsert({
      where: {
        tenantId_userId_definitionId_notificationChannelId: {
          tenantId: data.tenantId,
          userId: data.userId,
          definitionId: data.definitionId,
          notificationChannelId: data.notificationChannelId,
        },
      },
      create: {
        tenantId: data.tenantId,
        userId: data.userId,
        definitionId: data.definitionId,
        notificationChannelId: data.notificationChannelId,
        enabled: data.enabled,
        ...(data.digestMode !== undefined ? { digestMode: data.digestMode } : {}),
        ...(data.quietHoursOverride !== undefined
          ? { quietHoursOverride: data.quietHoursOverride as Prisma.InputJsonValue }
          : {}),
        ...(data.metadata !== undefined
          ? { metadata: data.metadata as Prisma.InputJsonValue }
          : {}),
      },
      update: {
        enabled: data.enabled,
        version: { increment: 1 },
        ...(data.digestMode !== undefined ? { digestMode: data.digestMode } : {}),
        ...(data.quietHoursOverride !== undefined
          ? { quietHoursOverride: data.quietHoursOverride as Prisma.InputJsonValue }
          : {}),
        ...(data.metadata !== undefined
          ? { metadata: data.metadata as Prisma.InputJsonValue }
          : {}),
      },
      include: { notificationChannel: true },
    });

    return this.toRecord(record);
  }

  async bulkUpsert(
    tenantId: OrganizationId,
    userId: UserId,
    items: UpdatePreferenceItem[],
  ): Promise<NotificationPreferenceRecord[]> {
    const results: NotificationPreferenceRecord[] = [];

    for (const item of items) {
      const channel = await this.prisma.notificationChannel.findFirst({
        where: { channelType: item.channelType, isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      if (channel === null) {
        continue;
      }

      const upsertData: UpsertPreferenceData = {
        tenantId,
        userId,
        definitionId: item.definitionId,
        notificationChannelId: channel.id,
        enabled: item.enabled,
        ...(item.digestMode !== undefined ? { digestMode: item.digestMode } : {}),
      };

      const record = await this.upsert(upsertData);
      results.push(record);
    }

    return results;
  }

  private toRecord(record: {
    id: string;
    tenantId: string;
    userId: string;
    definitionId: string;
    notificationChannelId: string;
    enabled: boolean;
    digestMode: string | null;
    quietHoursOverride: Prisma.JsonValue;
    metadata: Prisma.JsonValue;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    notificationChannel: {
      channelType: string;
      code: string;
    };
  }): NotificationPreferenceRecord {
    return {
      id: record.id,
      tenantId: record.tenantId as OrganizationId,
      userId: record.userId as UserId,
      definitionId: record.definitionId,
      notificationChannelId: record.notificationChannelId,
      channelType: record.notificationChannel.channelType as NotificationChannelType,
      channelCode: record.notificationChannel.code,
      enabled: record.enabled,
      digestMode: record.digestMode as DigestMode | null,
      quietHoursOverride: this.toJsonObject(record.quietHoursOverride),
      metadata: this.toJsonObject(record.metadata),
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toJsonObject(value: Prisma.JsonValue): Record<string, unknown> {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }
}