import type { Logger } from '@atlas/platform';
import { type Result } from '@atlas/shared-kernel';
import type { NotificationDeliveryRecord, NotificationRecord, NotificationRepository } from '../../domain/repositories/notification.repository.js';
import { type EmailTransport } from './email-transport.js';
export interface EmailChannelHandlerDeps {
    readonly notificationRepository: NotificationRepository;
    readonly logger: Logger;
    readonly transport?: EmailTransport;
}
/**
 * Delivers email notifications through the configured email transport.
 */
export declare class EmailChannelHandler {
    private readonly deps;
    private readonly transport;
    constructor(deps: EmailChannelHandlerDeps);
    deliver(notification: NotificationRecord, delivery: NotificationDeliveryRecord): Promise<Result<NotificationDeliveryRecord, never>>;
}
//# sourceMappingURL=email-channel.d.ts.map