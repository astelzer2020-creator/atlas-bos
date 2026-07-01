import type { Logger } from '@atlas/platform';
import { ForbiddenError, NotFoundError, ValidationError, type OrganizationId, type Result, type UserId } from '@atlas/shared-kernel';
import type { NotificationCategory, NotificationRepository } from '../../domain/repositories/notification.repository.js';
import type { DigestMode, NotificationPreferenceRepository } from '../../domain/repositories/notification-preference.repository.js';
import type { DeliveryService } from './delivery.service.js';
export interface SendNotificationRequest {
    readonly definition_id: string;
    readonly category: NotificationCategory;
    readonly recipient_user_id: string;
    readonly title: string;
    readonly body?: string;
    readonly action_url?: string;
    readonly entity_type?: string;
    readonly entity_id?: string;
    readonly payload?: Record<string, unknown>;
    readonly locale?: string;
    readonly idempotency_key: string;
    readonly priority?: number;
    readonly actor_user_id?: string;
}
export interface NotificationDto {
    readonly id: string;
    readonly organization_id: string;
    readonly definition_id: string;
    readonly category: NotificationCategory;
    readonly priority: number;
    readonly recipient_user_id: string;
    readonly title: string;
    readonly body: string | null;
    readonly action_url: string | null;
    readonly entity_type: string | null;
    readonly entity_id: string | null;
    readonly payload: Record<string, unknown>;
    readonly locale: string;
    readonly status: string;
    readonly read_at: string | null;
    readonly dismissed_at: string | null;
    readonly created_at: string;
    readonly updated_at: string;
}
export interface NotificationPreferenceDto {
    readonly id: string;
    readonly definition_id: string;
    readonly channel_type: string;
    readonly channel_code: string;
    readonly enabled: boolean;
    readonly digest_mode: DigestMode | null;
    readonly updated_at: string;
}
export interface UpdatePreferencesRequest {
    readonly preferences: readonly {
        readonly definition_id: string;
        readonly channel_type: 'in_app' | 'email';
        readonly enabled: boolean;
        readonly digest_mode?: DigestMode | null;
    }[];
}
export interface NotificationServiceDeps {
    readonly notificationRepository: NotificationRepository;
    readonly preferenceRepository: NotificationPreferenceRepository;
    readonly deliveryService: DeliveryService;
    readonly logger: Logger;
}
export declare class NotificationService {
    private readonly deps;
    constructor(deps: NotificationServiceDeps);
    sendNotification(organizationId: OrganizationId, request: SendNotificationRequest, actorId: UserId): Promise<Result<NotificationDto, ValidationError>>;
    listInbox(organizationId: OrganizationId, recipientUserId: UserId, options?: {
        limit?: number;
        cursor?: string;
        unread_only?: boolean;
    }): Promise<{
        data: NotificationDto[];
        next_cursor: string | null;
        has_more: boolean;
    }>;
    markAsRead(organizationId: OrganizationId, notificationId: string, actorId: UserId): Promise<Result<NotificationDto, NotFoundError | ForbiddenError>>;
    dismiss(organizationId: OrganizationId, notificationId: string, actorId: UserId): Promise<Result<NotificationDto, NotFoundError | ForbiddenError>>;
    getPreferences(organizationId: OrganizationId, userId: UserId): Promise<NotificationPreferenceDto[]>;
    updatePreferences(organizationId: OrganizationId, userId: UserId, request: UpdatePreferencesRequest): Promise<NotificationPreferenceDto[]>;
    private resolveEnabledChannels;
    private toDto;
    private preferenceToDto;
}
//# sourceMappingURL=notification.service.d.ts.map