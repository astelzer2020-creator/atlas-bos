import type { PrismaClient } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';
import type { NotificationPreferenceRecord, NotificationPreferenceRepository, UpdatePreferenceItem, UpsertPreferenceData } from '../../domain/repositories/notification-preference.repository.js';
export declare class PrismaNotificationPreferenceRepository implements NotificationPreferenceRepository {
    private readonly prisma;
    constructor(prisma: PrismaClient);
    findByUser(tenantId: OrganizationId, userId: UserId): Promise<NotificationPreferenceRecord[]>;
    upsert(data: UpsertPreferenceData): Promise<NotificationPreferenceRecord>;
    bulkUpsert(tenantId: OrganizationId, userId: UserId, items: UpdatePreferenceItem[]): Promise<NotificationPreferenceRecord[]>;
    private toRecord;
    private toJsonObject;
}
//# sourceMappingURL=prisma-notification-preference.repository.d.ts.map