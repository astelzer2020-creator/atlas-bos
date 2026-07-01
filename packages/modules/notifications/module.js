import { createLogger } from '@atlas/platform';
import { DeliveryService } from './application/services/delivery.service.js';
import { NotificationService } from './application/services/notification.service.js';
import { EmailChannelHandler } from './infrastructure/channels/email-channel.js';
import { InAppChannelHandler } from './infrastructure/channels/in-app-channel.js';
import { PrismaNotificationPreferenceRepository } from './infrastructure/persistence/prisma-notification-preference.repository.js';
import { PrismaNotificationRepository } from './infrastructure/persistence/prisma-notification.repository.js';
export { DeliveryService } from './application/services/delivery.service.js';
export { NotificationService } from './application/services/notification.service.js';
export { EmailChannelHandler } from './infrastructure/channels/email-channel.js';
export { createEmailTransport, } from './infrastructure/channels/email-transport.js';
export { InAppChannelHandler } from './infrastructure/channels/in-app-channel.js';
export { registerNotificationRoutes } from './presentation/rest/notification.routes.js';
/**
 * Wires notifications bounded context services with Prisma repositories.
 */
export function createNotificationsModule(options) {
    const logger = options.logger ??
        createLogger({
            service: 'atlas',
            bindings: { module: 'notifications' },
        });
    const notificationRepository = new PrismaNotificationRepository(options.prisma);
    const preferenceRepository = new PrismaNotificationPreferenceRepository(options.prisma);
    const inAppChannel = new InAppChannelHandler({
        notificationRepository,
        logger,
    });
    const emailChannel = new EmailChannelHandler({
        notificationRepository,
        logger,
    });
    const deliveryService = new DeliveryService({
        notificationRepository,
        inAppChannel,
        emailChannel,
        logger,
    });
    const notificationService = new NotificationService({
        notificationRepository,
        preferenceRepository,
        deliveryService,
        logger,
    });
    return {
        notificationService,
        deliveryService,
    };
}
//# sourceMappingURL=module.js.map