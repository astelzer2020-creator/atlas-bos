import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { NotificationService } from '../../application/services/notification.service.js';
export interface NotificationRouteContext {
    readonly userId: string;
}
export interface NotificationRoutesDeps {
    readonly notificationService: NotificationService;
    readonly authenticate: (request: FastifyRequest) => Promise<NotificationRouteContext | null>;
}
export declare function registerNotificationRoutes(fastify: FastifyInstance, deps: NotificationRoutesDeps): Promise<void>;
//# sourceMappingURL=notification.routes.d.ts.map