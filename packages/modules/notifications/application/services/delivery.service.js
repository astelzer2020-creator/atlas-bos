import { ok } from '@atlas/shared-kernel';
export class DeliveryService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async queueDelivery(notification, enabledChannelTypes) {
        const log = this.deps.logger.child({
            module: 'notifications',
            operation: 'queueDelivery',
            tenantId: notification.tenantId,
            notificationId: notification.id,
        });
        const deliveries = [];
        let inAppDelivered = false;
        for (const channelType of enabledChannelTypes) {
            const channel = await this.deps.notificationRepository.findChannelByType(channelType);
            if (channel === null || !channel.isActive) {
                log.warn('Notification channel unavailable; skipping delivery', { channelType });
                continue;
            }
            const deliveryKey = `${notification.idempotencyKey}:${channelType}`;
            const existing = await this.deps.notificationRepository.findDeliveryByIdempotencyKey(deliveryKey);
            if (existing !== null) {
                log.info('Delivery already queued; reusing existing record', {
                    channelType,
                    deliveryId: existing.id,
                });
                deliveries.push(existing);
                if (channelType === 'in_app' && existing.status === 'delivered') {
                    inAppDelivered = true;
                }
                continue;
            }
            const initialStatus = channelType === 'in_app' ? 'pending' : 'queued';
            const delivery = await this.deps.notificationRepository.createDelivery({
                tenantId: notification.tenantId,
                notificationId: notification.id,
                notificationChannelId: channel.id,
                idempotencyKey: deliveryKey,
                status: initialStatus,
            });
            log.info('Delivery record created', {
                channelType,
                deliveryId: delivery.id,
                status: delivery.status,
            });
            if (channelType === 'in_app') {
                const deliverResult = await this.deps.inAppChannel.deliver(notification, delivery);
                if (deliverResult.ok) {
                    deliveries.push(deliverResult.value);
                    inAppDelivered = true;
                }
                else {
                    deliveries.push(delivery);
                }
            }
            else {
                deliveries.push(delivery);
            }
        }
        await this.syncNotificationStatus(notification.tenantId, notification.id);
        return ok({ deliveries, inAppDelivered });
    }
    async processPendingDeliveries(limit = 50) {
        const log = this.deps.logger.child({
            module: 'notifications',
            operation: 'processPendingDeliveries',
        });
        const pending = await this.deps.notificationRepository.listPendingDeliveries(limit);
        let succeeded = 0;
        let failed = 0;
        for (const delivery of pending) {
            if (delivery.channelType === 'in_app') {
                continue;
            }
            const notification = await this.deps.notificationRepository.findById(delivery.tenantId, delivery.notificationId);
            if (notification === null) {
                await this.deps.notificationRepository.updateDelivery(delivery.id, {
                    status: 'failed',
                    errorCode: 'notification_not_found',
                    errorMessage: 'Source notification no longer exists',
                    failedAt: new Date(),
                });
                failed += 1;
                continue;
            }
            let result;
            if (delivery.channelType === 'email') {
                result = await this.deps.emailChannel.deliver(notification, delivery);
            }
            else {
                log.warn('Unsupported channel type for async processing', {
                    channelType: delivery.channelType,
                    deliveryId: delivery.id,
                });
                await this.deps.notificationRepository.updateDelivery(delivery.id, {
                    status: 'failed',
                    errorCode: 'unsupported_channel',
                    errorMessage: `Channel type ${delivery.channelType} is not supported`,
                    failedAt: new Date(),
                });
                failed += 1;
                continue;
            }
            if (result.ok) {
                succeeded += 1;
                await this.syncNotificationStatus(delivery.tenantId, delivery.notificationId);
            }
            else {
                failed += 1;
            }
        }
        log.info('Pending deliveries processed', {
            processed: pending.length,
            succeeded,
            failed,
        });
        return ok({
            processed: pending.length,
            succeeded,
            failed,
        });
    }
    async syncNotificationStatus(tenantId, notificationId) {
        const deliveries = await this.deps.notificationRepository.listDeliveriesByNotificationId(notificationId);
        if (deliveries.length === 0) {
            return;
        }
        const status = this.deriveNotificationStatus(deliveries);
        await this.deps.notificationRepository.updateStatus(tenantId, notificationId, status);
    }
    deriveNotificationStatus(deliveries) {
        const statuses = deliveries.map((delivery) => delivery.status);
        if (statuses.every((status) => status === 'delivered' || status === 'sent')) {
            return 'delivered';
        }
        if (statuses.some((status) => status === 'delivered' || status === 'sent')) {
            return 'partial';
        }
        if (statuses.every((status) => status === 'failed' || status === 'bounced')) {
            return 'failed';
        }
        if (statuses.some((status) => status === 'queued' || status === 'pending')) {
            return 'processing';
        }
        return 'pending';
    }
}
//# sourceMappingURL=delivery.service.js.map