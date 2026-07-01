import type { Logger } from '@atlas/platform';
import { type Result } from '@atlas/shared-kernel';
import type { NotificationDeliveryRecord, NotificationRecord, NotificationRepository } from '../../domain/repositories/notification.repository.js';
export interface InAppChannelHandlerDeps {
    readonly notificationRepository: NotificationRepository;
    readonly logger: Logger;
}
export declare class InAppChannelHandler {
    private readonly deps;
    constructor(deps: InAppChannelHandlerDeps);
    deliver(notification: NotificationRecord, delivery: NotificationDeliveryRecord): Promise<Result<NotificationDeliveryRecord, never>>;
}
//# sourceMappingURL=in-app-channel.d.ts.map