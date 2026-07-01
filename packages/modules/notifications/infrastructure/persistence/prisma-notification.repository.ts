import type { Prisma, PrismaClient } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';

import type {
  CreateDeliveryData,
  CreateNotificationData,
  ListInboxFilter,
  NotificationActorType,
  NotificationCategory,
  NotificationChannelRecord,
  NotificationChannelType,
  NotificationDeliveryRecord,
  NotificationDeliveryStatus,
  NotificationRecord,
  NotificationRepository,
  NotificationStatus,
  UpdateDeliveryData,
} from '../../domain/repositories/notification.repository.js';

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: OrganizationId, id: string): Promise<NotificationRecord | null> {
    const record = await this.prisma.notification.findFirst({
      where: { id, tenantId },
    });

    return record === null ? null : this.toNotificationRecord(record);
  }

  async findByIdempotencyKey(
    tenantId: OrganizationId,
    idempotencyKey: string,
  ): Promise<NotificationRecord | null> {
    const record = await this.prisma.notification.findFirst({
      where: { tenantId, idempotencyKey },
    });

    return record === null ? null : this.toNotificationRecord(record);
  }

  async create(data: CreateNotificationData): Promise<NotificationRecord> {
    const record = await this.prisma.notification.create({
      data: {
        tenantId: data.tenantId,
        definitionId: data.definitionId,
        category: data.category,
        recipientUserId: data.recipientUserId,
        title: data.title,
        idempotencyKey: data.idempotencyKey,
        status: 'pending',
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.actorUserId !== undefined ? { actorUserId: data.actorUserId } : {}),
        ...(data.actorType !== undefined ? { actorType: data.actorType } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.actionUrl !== undefined ? { actionUrl: data.actionUrl } : {}),
        ...(data.entityType !== undefined ? { entityType: data.entityType } : {}),
        ...(data.entityId !== undefined ? { entityId: data.entityId } : {}),
        ...(data.payload !== undefined ? { payload: data.payload as Prisma.InputJsonValue } : {}),
        ...(data.locale !== undefined ? { locale: data.locale } : {}),
        ...(data.scheduledFor !== undefined ? { scheduledFor: data.scheduledFor } : {}),
        ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
      },
    });

    return this.toNotificationRecord(record);
  }

  async listInbox(filter: ListInboxFilter): Promise<NotificationRecord[]> {
    const cursorFilter = await this.buildCursorFilter(filter.tenantId, filter.cursor);

    const records = await this.prisma.notification.findMany({
      where: {
        tenantId: filter.tenantId,
        recipientUserId: filter.recipientUserId,
        dismissedAt: null,
        ...(filter.unreadOnly === true ? { readAt: null } : {}),
        ...cursorFilter,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit,
    });

    return records.map((record) => this.toNotificationRecord(record));
  }

  async markAsRead(
    tenantId: OrganizationId,
    id: string,
    userId: UserId,
  ): Promise<NotificationRecord | null> {
    const existing = await this.prisma.notification.findFirst({
      where: { id, tenantId, recipientUserId: userId },
    });

    if (existing === null) {
      return null;
    }

    if (existing.readAt !== null) {
      return this.toNotificationRecord(existing);
    }

    const record = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });

    return this.toNotificationRecord(record);
  }

  async dismiss(
    tenantId: OrganizationId,
    id: string,
    userId: UserId,
  ): Promise<NotificationRecord | null> {
    const existing = await this.prisma.notification.findFirst({
      where: { id, tenantId, recipientUserId: userId },
    });

    if (existing === null) {
      return null;
    }

    if (existing.dismissedAt !== null) {
      return this.toNotificationRecord(existing);
    }

    const record = await this.prisma.notification.update({
      where: { id },
      data: { dismissedAt: new Date() },
    });

    return this.toNotificationRecord(record);
  }

  async updateStatus(
    tenantId: OrganizationId,
    id: string,
    status: NotificationStatus,
  ): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, tenantId },
      data: { status },
    });
  }

  async findChannelByType(
    channelType: NotificationChannelType,
  ): Promise<NotificationChannelRecord | null> {
    const record = await this.prisma.notificationChannel.findFirst({
      where: { channelType, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    return record === null
      ? null
      : {
          id: record.id,
          code: record.code,
          channelType: record.channelType as NotificationChannelType,
          isActive: record.isActive,
        };
  }

  async createDelivery(data: CreateDeliveryData): Promise<NotificationDeliveryRecord> {
    const record = await this.prisma.notificationDelivery.create({
      data: {
        tenantId: data.tenantId,
        notificationId: data.notificationId,
        notificationChannelId: data.notificationChannelId,
        idempotencyKey: data.idempotencyKey,
        status: data.status,
      },
      include: {
        notificationChannel: true,
      },
    });

    return this.toDeliveryRecord(record);
  }

  async findDeliveryByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<NotificationDeliveryRecord | null> {
    const record = await this.prisma.notificationDelivery.findUnique({
      where: { idempotencyKey },
      include: { notificationChannel: true },
    });

    return record === null ? null : this.toDeliveryRecord(record);
  }

  async listPendingDeliveries(limit: number): Promise<NotificationDeliveryRecord[]> {
    const records = await this.prisma.notificationDelivery.findMany({
      where: {
        status: { in: ['pending', 'queued'] },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: { notificationChannel: true },
    });

    return records.map((record) => this.toDeliveryRecord(record));
  }

  async updateDelivery(
    id: string,
    data: UpdateDeliveryData,
  ): Promise<NotificationDeliveryRecord> {
    const record = await this.prisma.notificationDelivery.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.attemptCount !== undefined ? { attemptCount: data.attemptCount } : {}),
        ...(data.errorCode !== undefined ? { errorCode: data.errorCode } : {}),
        ...(data.errorMessage !== undefined ? { errorMessage: data.errorMessage } : {}),
        ...(data.sentAt !== undefined ? { sentAt: data.sentAt } : {}),
        ...(data.deliveredAt !== undefined ? { deliveredAt: data.deliveredAt } : {}),
        ...(data.failedAt !== undefined ? { failedAt: data.failedAt } : {}),
        ...(data.nextRetryAt !== undefined ? { nextRetryAt: data.nextRetryAt } : {}),
      },
      include: { notificationChannel: true },
    });

    return this.toDeliveryRecord(record);
  }

  async listDeliveriesByNotificationId(
    notificationId: string,
  ): Promise<NotificationDeliveryRecord[]> {
    const records = await this.prisma.notificationDelivery.findMany({
      where: { notificationId },
      include: { notificationChannel: true },
    });

    return records.map((record) => this.toDeliveryRecord(record));
  }

  private async buildCursorFilter(
    tenantId: OrganizationId,
    cursor?: string,
  ): Promise<Prisma.NotificationWhereInput> {
    if (cursor === undefined) {
      return {};
    }

    const cursorRecord = await this.prisma.notification.findFirst({
      where: { id: cursor, tenantId },
      select: { createdAt: true, id: true },
    });

    if (cursorRecord === null) {
      return {};
    }

    return {
      OR: [
        { createdAt: { lt: cursorRecord.createdAt } },
        {
          createdAt: cursorRecord.createdAt,
          id: { lt: cursorRecord.id },
        },
      ],
    };
  }

  private toNotificationRecord(record: {
    id: string;
    tenantId: string;
    definitionId: string;
    category: string;
    priority: number;
    recipientUserId: string;
    actorUserId: string | null;
    actorType: string;
    title: string;
    body: string | null;
    actionUrl: string | null;
    entityType: string | null;
    entityId: string | null;
    payload: Prisma.JsonValue;
    locale: string;
    status: string;
    idempotencyKey: string;
    scheduledFor: Date | null;
    expiresAt: Date | null;
    readAt: Date | null;
    dismissedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): NotificationRecord {
    return {
      id: record.id,
      tenantId: record.tenantId as OrganizationId,
      definitionId: record.definitionId,
      category: record.category as NotificationCategory,
      priority: record.priority,
      recipientUserId: record.recipientUserId as UserId,
      actorUserId: record.actorUserId as UserId | null,
      actorType: record.actorType as NotificationActorType,
      title: record.title,
      body: record.body,
      actionUrl: record.actionUrl,
      entityType: record.entityType,
      entityId: record.entityId,
      payload: this.toPayload(record.payload),
      locale: record.locale,
      status: record.status as NotificationStatus,
      idempotencyKey: record.idempotencyKey,
      scheduledFor: record.scheduledFor,
      expiresAt: record.expiresAt,
      readAt: record.readAt,
      dismissedAt: record.dismissedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toDeliveryRecord(record: {
    id: string;
    tenantId: string;
    notificationId: string;
    notificationChannelId: string;
    idempotencyKey: string;
    status: string;
    attemptCount: number;
    errorCode: string | null;
    errorMessage: string | null;
    sentAt: Date | null;
    deliveredAt: Date | null;
    failedAt: Date | null;
    nextRetryAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    notificationChannel: {
      channelType: string;
    };
  }): NotificationDeliveryRecord {
    return {
      id: record.id,
      tenantId: record.tenantId as OrganizationId,
      notificationId: record.notificationId,
      notificationChannelId: record.notificationChannelId,
      channelType: record.notificationChannel.channelType as NotificationChannelType,
      idempotencyKey: record.idempotencyKey,
      status: record.status as NotificationDeliveryStatus,
      attemptCount: record.attemptCount,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
      sentAt: record.sentAt,
      deliveredAt: record.deliveredAt,
      failedAt: record.failedAt,
      nextRetryAt: record.nextRetryAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toPayload(value: Prisma.JsonValue): Record<string, unknown> {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }
}