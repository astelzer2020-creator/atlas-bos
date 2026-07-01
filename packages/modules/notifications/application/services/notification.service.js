import { err, ForbiddenError, NotFoundError, ok, ValidationError, } from '@atlas/shared-kernel';
export class NotificationService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async sendNotification(organizationId, request, actorId) {
        const log = this.deps.logger.child({
            module: 'notifications',
            operation: 'sendNotification',
            tenantId: organizationId,
            actorUserId: actorId,
        });
        if (request.title.trim().length === 0) {
            return err(new ValidationError('Notification title is required', {
                details: { issues: [{ path: ['title'], message: 'Title cannot be empty' }] },
            }));
        }
        if (request.idempotency_key.trim().length === 0) {
            return err(new ValidationError('Idempotency key is required', {
                details: { issues: [{ path: ['idempotency_key'], message: 'Idempotency key cannot be empty' }] },
            }));
        }
        const existing = await this.deps.notificationRepository.findByIdempotencyKey(organizationId, request.idempotency_key);
        if (existing !== null) {
            log.info('Idempotent notification send; returning existing record', {
                notificationId: existing.id,
                idempotencyKey: request.idempotency_key,
            });
            return ok(this.toDto(existing));
        }
        const recipientUserId = request.recipient_user_id;
        const notification = await this.deps.notificationRepository.create({
            tenantId: organizationId,
            definitionId: request.definition_id,
            category: request.category,
            recipientUserId,
            title: request.title.trim(),
            idempotencyKey: request.idempotency_key,
            actorUserId: actorId,
            actorType: 'user',
            ...(request.body !== undefined ? { body: request.body } : {}),
            ...(request.action_url !== undefined ? { actionUrl: request.action_url } : {}),
            ...(request.entity_type !== undefined ? { entityType: request.entity_type } : {}),
            ...(request.entity_id !== undefined ? { entityId: request.entity_id } : {}),
            ...(request.payload !== undefined ? { payload: request.payload } : {}),
            ...(request.locale !== undefined ? { locale: request.locale } : {}),
            ...(request.priority !== undefined ? { priority: request.priority } : {}),
        });
        const enabledChannels = await this.resolveEnabledChannels(organizationId, recipientUserId, request.definition_id);
        await this.deps.deliveryService.queueDelivery(notification, enabledChannels);
        log.info('Notification created and delivery queued', {
            notificationId: notification.id,
            enabledChannels,
        });
        const refreshed = await this.deps.notificationRepository.findById(organizationId, notification.id);
        return ok(this.toDto(refreshed ?? notification));
    }
    async listInbox(organizationId, recipientUserId, options = {}) {
        const limit = options.limit ?? 50;
        const notifications = await this.deps.notificationRepository.listInbox({
            tenantId: organizationId,
            recipientUserId,
            limit,
            ...(options.cursor !== undefined ? { cursor: options.cursor } : {}),
            ...(options.unread_only !== undefined ? { unreadOnly: options.unread_only } : {}),
        });
        return {
            data: notifications.map((record) => this.toDto(record)),
            next_cursor: notifications.at(-1)?.id ?? null,
            has_more: notifications.length === limit,
        };
    }
    async markAsRead(organizationId, notificationId, actorId) {
        const updated = await this.deps.notificationRepository.markAsRead(organizationId, notificationId, actorId);
        if (updated === null) {
            const existing = await this.deps.notificationRepository.findById(organizationId, notificationId);
            if (existing === null) {
                return err(new NotFoundError('Notification', notificationId));
            }
            return err(new ForbiddenError('You do not have access to this notification'));
        }
        this.deps.logger
            .child({
            module: 'notifications',
            operation: 'markAsRead',
            tenantId: organizationId,
            notificationId,
        })
            .info('Notification marked as read', { userId: actorId });
        return ok(this.toDto(updated));
    }
    async dismiss(organizationId, notificationId, actorId) {
        const updated = await this.deps.notificationRepository.dismiss(organizationId, notificationId, actorId);
        if (updated === null) {
            const existing = await this.deps.notificationRepository.findById(organizationId, notificationId);
            if (existing === null) {
                return err(new NotFoundError('Notification', notificationId));
            }
            return err(new ForbiddenError('You do not have access to this notification'));
        }
        this.deps.logger
            .child({
            module: 'notifications',
            operation: 'dismiss',
            tenantId: organizationId,
            notificationId,
        })
            .info('Notification dismissed', { userId: actorId });
        return ok(this.toDto(updated));
    }
    async getPreferences(organizationId, userId) {
        const preferences = await this.deps.preferenceRepository.findByUser(organizationId, userId);
        return preferences.map((record) => this.preferenceToDto(record));
    }
    async updatePreferences(organizationId, userId, request) {
        const items = request.preferences.map((preference) => ({
            definitionId: preference.definition_id,
            channelType: preference.channel_type,
            enabled: preference.enabled,
            ...(preference.digest_mode !== undefined ? { digestMode: preference.digest_mode } : {}),
        }));
        const updated = await this.deps.preferenceRepository.bulkUpsert(organizationId, userId, items);
        this.deps.logger
            .child({
            module: 'notifications',
            operation: 'updatePreferences',
            tenantId: organizationId,
            userId,
        })
            .info('Notification preferences updated', { count: updated.length });
        return updated.map((record) => this.preferenceToDto(record));
    }
    async resolveEnabledChannels(organizationId, userId, definitionId) {
        const preferences = await this.deps.preferenceRepository.findByUser(organizationId, userId);
        const definitionPreferences = preferences.filter((preference) => preference.definitionId === definitionId);
        if (definitionPreferences.length === 0) {
            return ['in_app', 'email'];
        }
        const enabled = definitionPreferences
            .filter((preference) => preference.enabled)
            .map((preference) => preference.channelType)
            .filter((channelType) => channelType === 'in_app' || channelType === 'email');
        return enabled.length > 0 ? enabled : ['in_app'];
    }
    toDto(record) {
        return {
            id: record.id,
            organization_id: record.tenantId,
            definition_id: record.definitionId,
            category: record.category,
            priority: record.priority,
            recipient_user_id: record.recipientUserId,
            title: record.title,
            body: record.body,
            action_url: record.actionUrl,
            entity_type: record.entityType,
            entity_id: record.entityId,
            payload: record.payload,
            locale: record.locale,
            status: record.status,
            read_at: record.readAt?.toISOString() ?? null,
            dismissed_at: record.dismissedAt?.toISOString() ?? null,
            created_at: record.createdAt.toISOString(),
            updated_at: record.updatedAt.toISOString(),
        };
    }
    preferenceToDto(record) {
        return {
            id: record.id,
            definition_id: record.definitionId,
            channel_type: record.channelType,
            channel_code: record.channelCode,
            enabled: record.enabled,
            digest_mode: record.digestMode,
            updated_at: record.updatedAt.toISOString(),
        };
    }
}
//# sourceMappingURL=notification.service.js.map