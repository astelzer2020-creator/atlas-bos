import type { Logger } from '@atlas/platform';
import { ok, type Result } from '@atlas/shared-kernel';

import type {
  NotificationDeliveryRecord,
  NotificationRecord,
  NotificationRepository,
} from '../../domain/repositories/notification.repository.js';
import { createEmailTransport, type EmailTransport } from './email-transport.js';

export interface EmailChannelHandlerDeps {
  readonly notificationRepository: NotificationRepository;
  readonly logger: Logger;
  readonly transport?: EmailTransport;
}

/**
 * Delivers email notifications through the configured email transport.
 */
export class EmailChannelHandler {
  private readonly transport: EmailTransport;

  constructor(private readonly deps: EmailChannelHandlerDeps) {
    this.transport = deps.transport ?? createEmailTransport(deps.logger);
  }

  async deliver(
    notification: NotificationRecord,
    delivery: NotificationDeliveryRecord,
  ): Promise<Result<NotificationDeliveryRecord, never>> {
    const log = this.deps.logger.child({
      module: 'notifications',
      operation: 'emailDeliver',
      tenantId: notification.tenantId,
      notificationId: notification.id,
      deliveryId: delivery.id,
    });

    const now = new Date();
    const recipientEmail =
      typeof notification.payload.recipient_email === 'string'
        ? notification.payload.recipient_email
        : typeof notification.payload.email === 'string'
          ? notification.payload.email
          : null;

    if (recipientEmail === null) {
      log.warn('Email delivery skipped — no recipient email in notification payload', {
        recipientUserId: notification.recipientUserId,
      });

      const skipped = await this.deps.notificationRepository.updateDelivery(delivery.id, {
        status: 'failed',
        attemptCount: delivery.attemptCount + 1,
        errorMessage: 'No recipient email address available',
        failedAt: now,
      });

      return ok(skipped);
    }

    const transportResult = await this.transport.send({
      to: recipientEmail,
      subject: notification.title,
      body: notification.body ?? '',
    });

    log.info('Email delivery completed', {
      recipientUserId: notification.recipientUserId,
      transport: transportResult.transport,
      messageId: transportResult.messageId,
      accepted: transportResult.accepted,
    });

    const updated = await this.deps.notificationRepository.updateDelivery(
      delivery.id,
      transportResult.accepted
        ? {
            status: 'sent',
            attemptCount: delivery.attemptCount + 1,
            sentAt: now,
          }
        : {
            status: 'failed',
            attemptCount: delivery.attemptCount + 1,
            errorMessage: 'Email transport rejected the message',
            failedAt: now,
          },
    );

    return ok(updated);
  }
}