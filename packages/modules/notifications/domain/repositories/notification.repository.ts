import type { OrganizationId, UserId } from '@atlas/shared-kernel';

export type NotificationCategory =
  | 'transactional'
  | 'operational'
  | 'digest'
  | 'alert'
  | 'marketing';

export type NotificationStatus =
  | 'pending'
  | 'processing'
  | 'delivered'
  | 'partial'
  | 'failed'
  | 'suppressed'
  | 'expired';

export type NotificationActorType = 'user' | 'system' | 'api_key' | 'agent' | 'workflow';

export type NotificationChannelType =
  | 'email'
  | 'push'
  | 'sms'
  | 'in_app'
  | 'slack'
  | 'teams'
  | 'webhook';

export type NotificationDeliveryStatus =
  | 'pending'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'suppressed'
  | 'bounced';

export interface NotificationRecord {
  readonly id: string;
  readonly tenantId: OrganizationId;
  readonly definitionId: string;
  readonly category: NotificationCategory;
  readonly priority: number;
  readonly recipientUserId: UserId;
  readonly actorUserId: UserId | null;
  readonly actorType: NotificationActorType;
  readonly title: string;
  readonly body: string | null;
  readonly actionUrl: string | null;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly payload: Record<string, unknown>;
  readonly locale: string;
  readonly status: NotificationStatus;
  readonly idempotencyKey: string;
  readonly scheduledFor: Date | null;
  readonly expiresAt: Date | null;
  readonly readAt: Date | null;
  readonly dismissedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NotificationChannelRecord {
  readonly id: string;
  readonly code: string;
  readonly channelType: NotificationChannelType;
  readonly isActive: boolean;
}

export interface NotificationDeliveryRecord {
  readonly id: string;
  readonly tenantId: OrganizationId;
  readonly notificationId: string;
  readonly notificationChannelId: string;
  readonly channelType: NotificationChannelType;
  readonly idempotencyKey: string;
  readonly status: NotificationDeliveryStatus;
  readonly attemptCount: number;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly sentAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly failedAt: Date | null;
  readonly nextRetryAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateNotificationData {
  readonly tenantId: OrganizationId;
  readonly definitionId: string;
  readonly category: NotificationCategory;
  readonly priority?: number;
  readonly recipientUserId: UserId;
  readonly actorUserId?: UserId;
  readonly actorType?: NotificationActorType;
  readonly title: string;
  readonly body?: string;
  readonly actionUrl?: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly payload?: Record<string, unknown>;
  readonly locale?: string;
  readonly idempotencyKey: string;
  readonly scheduledFor?: Date;
  readonly expiresAt?: Date;
}

export interface ListInboxFilter {
  readonly tenantId: OrganizationId;
  readonly recipientUserId: UserId;
  readonly limit: number;
  readonly cursor?: string;
  readonly unreadOnly?: boolean;
}

export interface CreateDeliveryData {
  readonly tenantId: OrganizationId;
  readonly notificationId: string;
  readonly notificationChannelId: string;
  readonly idempotencyKey: string;
  readonly status: NotificationDeliveryStatus;
}

export interface UpdateDeliveryData {
  readonly status?: NotificationDeliveryStatus;
  readonly attemptCount?: number;
  readonly errorCode?: string | null;
  readonly errorMessage?: string | null;
  readonly sentAt?: Date | null;
  readonly deliveredAt?: Date | null;
  readonly failedAt?: Date | null;
  readonly nextRetryAt?: Date | null;
}

export interface NotificationRepository {
  findById(tenantId: OrganizationId, id: string): Promise<NotificationRecord | null>;
  findByIdempotencyKey(
    tenantId: OrganizationId,
    idempotencyKey: string,
  ): Promise<NotificationRecord | null>;
  create(data: CreateNotificationData): Promise<NotificationRecord>;
  listInbox(filter: ListInboxFilter): Promise<NotificationRecord[]>;
  markAsRead(
    tenantId: OrganizationId,
    id: string,
    userId: UserId,
  ): Promise<NotificationRecord | null>;
  dismiss(
    tenantId: OrganizationId,
    id: string,
    userId: UserId,
  ): Promise<NotificationRecord | null>;
  updateStatus(
    tenantId: OrganizationId,
    id: string,
    status: NotificationStatus,
  ): Promise<void>;
  findChannelByType(
    channelType: NotificationChannelType,
  ): Promise<NotificationChannelRecord | null>;
  createDelivery(data: CreateDeliveryData): Promise<NotificationDeliveryRecord>;
  findDeliveryByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<NotificationDeliveryRecord | null>;
  listPendingDeliveries(limit: number): Promise<NotificationDeliveryRecord[]>;
  updateDelivery(id: string, data: UpdateDeliveryData): Promise<NotificationDeliveryRecord>;
  listDeliveriesByNotificationId(
    notificationId: string,
  ): Promise<NotificationDeliveryRecord[]>;
}