import type { PrismaClient } from '@atlas/database';
import { createLogger, type Logger } from '@atlas/platform';

import { DeliveryService } from './application/services/delivery.service.js';
import { NotificationService } from './application/services/notification.service.js';
import { EmailChannelHandler } from './infrastructure/channels/email-channel.js';
import { InAppChannelHandler } from './infrastructure/channels/in-app-channel.js';
import { PrismaNotificationPreferenceRepository } from './infrastructure/persistence/prisma-notification-preference.repository.js';
import { PrismaNotificationRepository } from './infrastructure/persistence/prisma-notification.repository.js';

export { DeliveryService } from './application/services/delivery.service.js';
export { NotificationService } from './application/services/notification.service.js';
export { EmailChannelHandler } from './infrastructure/channels/email-channel.js';
export {
  createEmailTransport,
  type EmailTransport,
} from './infrastructure/channels/email-transport.js';
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
export function createNotificationsModule(
  options: NotificationsModuleOptions,
): NotificationsModule {
  const logger =
    options.logger ??
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