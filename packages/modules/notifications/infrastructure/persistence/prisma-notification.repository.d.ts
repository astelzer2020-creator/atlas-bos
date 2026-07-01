import type { PrismaClient } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';
import type { CreateDeliveryData, CreateNotificationData, ListInboxFilter, NotificationChannelRecord, NotificationChannelType, NotificationDeliveryRecord, NotificationRecord, NotificationRepository, NotificationStatus, UpdateDeliveryData } from '../../domain/repositories/notification.repository.js';
export declare class PrismaNotificationRepository implements NotificationRepository {
    private readonly prisma;
    constructor(prisma: PrismaClient);
    findById(tenantId: OrganizationId, id: string): Promise<NotificationRecord | null>;
    findByIdempotencyKey(tenantId: OrganizationId, idempotencyKey: string): Promise<NotificationRecord | null>;
    create(data: CreateNotificationData): Promise<NotificationRecord>;
    listInbox(filter: ListInboxFilter): Promise<NotificationRecord[]>;
    markAsRead(tenantId: OrganizationId, id: string, userId: UserId): Promise<NotificationRecord | null>;
    dismiss(tenantId: OrganizationId, id: string, userId: UserId): Promise<NotificationRecord | null>;
    updateStatus(tenantId: OrganizationId, id: string, status: NotificationStatus): Promise<void>;
    findChannelByType(channelType: NotificationChannelType): Promise<NotificationChannelRecord | null>;
    createDelivery(data: CreateDeliveryData): Promise<NotificationDeliveryRecord>;
    findDeliveryByIdempotencyKey(idempotencyKey: string): Promise<NotificationDeliveryRecord | null>;
    listPendingDeliveries(limit: number): Promise<NotificationDeliveryRecord[]>;
    updateDelivery(id: string, data: UpdateDeliveryData): Promise<NotificationDeliveryRecord>;
    listDeliveriesByNotificationId(notificationId: string): Promise<NotificationDeliveryRecord[]>;
    private buildCursorFilter;
    private toNotificationRecord;
    private toDeliveryRecord;
    private toPayload;
}
//# sourceMappingURL=prisma-notification.repository.d.ts.map