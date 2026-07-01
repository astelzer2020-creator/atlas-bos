export class PrismaNotificationPreferenceRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByUser(tenantId, userId) {
        const records = await this.prisma.notificationPreference.findMany({
            where: { tenantId, userId },
            include: { notificationChannel: true },
            orderBy: [{ definitionId: 'asc' }, { notificationChannelId: 'asc' }],
        });
        return records.map((record) => this.toRecord(record));
    }
    async upsert(data) {
        const record = await this.prisma.notificationPreference.upsert({
            where: {
                tenantId_userId_definitionId_notificationChannelId: {
                    tenantId: data.tenantId,
                    userId: data.userId,
                    definitionId: data.definitionId,
                    notificationChannelId: data.notificationChannelId,
                },
            },
            create: {
                tenantId: data.tenantId,
                userId: data.userId,
                definitionId: data.definitionId,
                notificationChannelId: data.notificationChannelId,
                enabled: data.enabled,
                ...(data.digestMode !== undefined ? { digestMode: data.digestMode } : {}),
                ...(data.quietHoursOverride !== undefined
                    ? { quietHoursOverride: data.quietHoursOverride }
                    : {}),
                ...(data.metadata !== undefined
                    ? { metadata: data.metadata }
                    : {}),
            },
            update: {
                enabled: data.enabled,
                version: { increment: 1 },
                ...(data.digestMode !== undefined ? { digestMode: data.digestMode } : {}),
                ...(data.quietHoursOverride !== undefined
                    ? { quietHoursOverride: data.quietHoursOverride }
                    : {}),
                ...(data.metadata !== undefined
                    ? { metadata: data.metadata }
                    : {}),
            },
            include: { notificationChannel: true },
        });
        return this.toRecord(record);
    }
    async bulkUpsert(tenantId, userId, items) {
        const results = [];
        for (const item of items) {
            const channel = await this.prisma.notificationChannel.findFirst({
                where: { channelType: item.channelType, isActive: true },
                orderBy: { createdAt: 'asc' },
            });
            if (channel === null) {
                continue;
            }
            const upsertData = {
                tenantId,
                userId,
                definitionId: item.definitionId,
                notificationChannelId: channel.id,
                enabled: item.enabled,
                ...(item.digestMode !== undefined ? { digestMode: item.digestMode } : {}),
            };
            const record = await this.upsert(upsertData);
            results.push(record);
        }
        return results;
    }
    toRecord(record) {
        return {
            id: record.id,
            tenantId: record.tenantId,
            userId: record.userId,
            definitionId: record.definitionId,
            notificationChannelId: record.notificationChannelId,
            channelType: record.notificationChannel.channelType,
            channelCode: record.notificationChannel.code,
            enabled: record.enabled,
            digestMode: record.digestMode,
            quietHoursOverride: this.toJsonObject(record.quietHoursOverride),
            metadata: this.toJsonObject(record.metadata),
            version: record.version,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
    toJsonObject(value) {
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            return value;
        }
        return {};
    }
}
//# sourceMappingURL=prisma-notification-preference.repository.js.map