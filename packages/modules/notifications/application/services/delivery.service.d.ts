import type { Logger } from '@atlas/platform';
import { type Result } from '@atlas/shared-kernel';
import type { NotificationDeliveryRecord, NotificationRecord, NotificationRepository } from '../../domain/repositories/notification.repository.js';
import type { EmailChannelHandler } from '../../infrastructure/channels/email-channel.js';
import type { InAppChannelHandler } from '../../infrastructure/channels/in-app-channel.js';
export interface DeliveryServiceDeps {
    readonly notificationRepository: NotificationRepository;
    readonly inAppChannel: InAppChannelHandler;
    readonly emailChannel: EmailChannelHandler;
    readonly logger: Logger;
}
export interface QueueDeliveryResult {
    readonly deliveries: NotificationDeliveryRecord[];
    readonly inAppDelivered: boolean;
}
export interface ProcessDeliveriesResult {
    readonly processed: number;
    readonly succeeded: number;
    readonly failed: number;
}
export declare class DeliveryService {
    private readonly deps;
    constructor(deps: DeliveryServiceDeps);
    queueDelivery(notification: NotificationRecord, enabledChannelTypes: readonly ('in_app' | 'email')[]): Promise<Result<QueueDeliveryResult, never>>;
    processPendingDeliveries(limit?: number): Promise<Result<ProcessDeliveriesResult, never>>;
    private syncNotificationStatus;
    private deriveNotificationStatus;
}
//# sourceMappingURL=delivery.service.d.ts.map