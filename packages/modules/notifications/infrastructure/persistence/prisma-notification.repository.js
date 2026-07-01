export class PrismaNotificationRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findById(tenantId, id) {
        const record = await this.prisma.notification.findFirst({
            where: { id, tenantId },
        });
        return record === null ? null : this.toNotificationRecord(record);
    }
    async findByIdempotencyKey(tenantId, idempotencyKey) {
        const record = await this.prisma.notification.findFirst({
            where: { tenantId, idempotencyKey },
        });
        return record === null ? null : this.toNotificationRecord(record);
    }
    async create(data) {
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
                ...(data.payload !== undefined ? { payload: data.payload } : {}),
                ...(data.locale !== undefined ? { locale: data.locale } : {}),
                ...(data.scheduledFor !== undefined ? { scheduledFor: data.scheduledFor } : {}),
                ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
            },
        });
        return this.toNotificationRecord(record);
    }
    async listInbox(filter) {
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
    async markAsRead(tenantId, id, userId) {
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
    async dismiss(tenantId, id, userId) {
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
    async updateStatus(tenantId, id, status) {
        await this.prisma.notification.updateMany({
            where: { id, tenantId },
            data: { status },
        });
    }
    async findChannelByType(channelType) {
        const record = await this.prisma.notificationChannel.findFirst({
            where: { channelType, isActive: true },
            orderBy: { createdAt: 'asc' },
        });
        return record === null
            ? null
            : {
                id: record.id,
                code: record.code,
                channelType: record.channelType,
                isActive: record.isActive,
            };
    }
    async createDelivery(data) {
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
    async findDeliveryByIdempotencyKey(idempotencyKey) {
        const record = await this.prisma.notificationDelivery.findUnique({
            where: { idempotencyKey },
            include: { notificationChannel: true },
        });
        return record === null ? null : this.toDeliveryRecord(record);
    }
    async listPendingDeliveries(limit) {
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
    async updateDelivery(id, data) {
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
    async listDeliveriesByNotificationId(notificationId) {
        const records = await this.prisma.notificationDelivery.findMany({
            where: { notificationId },
            include: { notificationChannel: true },
        });
        return records.map((record) => this.toDeliveryRecord(record));
    }
    async buildCursorFilter(tenantId, cursor) {
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
    toNotificationRecord(record) {
        return {
            id: record.id,
            tenantId: record.tenantId,
            definitionId: record.definitionId,
            category: record.category,
            priority: record.priority,
            recipientUserId: record.recipientUserId,
            actorUserId: record.actorUserId,
            actorType: record.actorType,
            title: record.title,
            body: record.body,
            actionUrl: record.actionUrl,
            entityType: record.entityType,
            entityId: record.entityId,
            payload: this.toPayload(record.payload),
            locale: record.locale,
            status: record.status,
            idempotencyKey: record.idempotencyKey,
            scheduledFor: record.scheduledFor,
            expiresAt: record.expiresAt,
            readAt: record.readAt,
            dismissedAt: record.dismissedAt,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
    toDeliveryRecord(record) {
        return {
            id: record.id,
            tenantId: record.tenantId,
            notificationId: record.notificationId,
            notificationChannelId: record.notificationChannelId,
            channelType: record.notificationChannel.channelType,
            idempotencyKey: record.idempotencyKey,
            status: record.status,
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
    toPayload(value) {
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            return value;
        }
        return {};
    }
}
//# sourceMappingURL=prisma-notification.repository.js.map