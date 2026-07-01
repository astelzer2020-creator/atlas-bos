import { ok } from '@atlas/shared-kernel';
export class InAppChannelHandler {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async deliver(notification, delivery) {
        const log = this.deps.logger.child({
            module: 'notifications',
            operation: 'inAppDeliver',
            tenantId: notification.tenantId,
            notificationId: notification.id,
            deliveryId: delivery.id,
        });
        const now = new Date();
        log.info('In-app notification delivered', {
            recipientUserId: notification.recipientUserId,
            title: notification.title,
        });
        const updated = await this.deps.notificationRepository.updateDelivery(delivery.id, {
            status: 'delivered',
            attemptCount: delivery.attemptCount + 1,
            deliveredAt: now,
            sentAt: now,
        });
        return ok(updated);
    }
}
//# sourceMappingURL=in-app-channel.js.map