import type { Logger } from '@atlas/platform';
import { ok, type Result } from '@atlas/shared-kernel';

import type {
  NotificationDeliveryRecord,
  NotificationRecord,
  NotificationRepository,
} from '../../domain/repositories/notification.repository.js';

export interface InAppChannelHandlerDeps {
  readonly notificationRepository: NotificationRepository;
  readonly logger: Logger;
}

export class InAppChannelHandler {
  constructor(private readonly deps: InAppChannelHandlerDeps) {}

  async deliver(
    notification: NotificationRecord,
    delivery: NotificationDeliveryRecord,
  ): Promise<Result<NotificationDeliveryRecord, never>> {
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