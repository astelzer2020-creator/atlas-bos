import type { PrismaClient } from '@atlas/database';
import { type Logger } from '@atlas/platform';
import { DeliveryService } from './application/services/delivery.service.js';
import { NotificationService } from './application/services/notification.service.js';
export { DeliveryService } from './application/services/delivery.service.js';
export { NotificationService } from './application/services/notification.service.js';
export { EmailChannelHandler } from './infrastructure/channels/email-channel.js';
export { createEmailTransport, type EmailTransport, } from './infrastructure/channels/email-transport.js';
export { InAppChannelHandler } from './infrastructure/channels/in-app-channel.js';
export { registerNotificationRoutes } from './presentation/rest/notification.routes.js';
export type { NotificationRoutesDeps } from './presentation/rest/notification.routes.js';
export interface NotificationsModuleOptions {
    readonly prisma: PrismaClient;
    readonly logger?: Logger;
}
export interface NotificationsModule {
    readonly notificationService: NotificationService;
    readonly deliveryService: DeliveryService;
}
/**
 * Wires notifications bounded context services with Prisma repositories.
 */
export declare function createNotificationsModule(options: NotificationsModuleOptions): NotificationsModule;
//# sourceMappingURL=module.d.ts.map