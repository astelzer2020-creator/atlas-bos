import { Prisma } from '@atlas/database';
function toJsonValue(value) {
    return value;
}
export class PrismaWorkflowInstanceRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findById(organizationId, id) {
        const record = await this.prisma.workflowInstance.findFirst({
            where: {
                id,
                organizationId,
                deletedAt: null,
            },
        });
        return record === null ? null : this.toRecord(record);
    }
    async create(data) {
        const record = await this.prisma.workflowInstance.create({
            data: {
                organizationId: data.organizationId,
                definitionId: data.definitionId,
                definitionVersion: data.definitionVersion,
                status: 'running',
                ...(data.entityType !== undefined ? { entityType: data.entityType } : {}),
                ...(data.entityId !== undefined ? { entityId: data.entityId } : {}),
                ...(data.correlationId !== undefined ? { correlationId: data.correlationId } : {}),
                ...(data.initiatorType !== undefined ? { initiatorType: data.initiatorType } : {}),
                ...(data.initiatorId !== undefined ? { initiatorId: data.initiatorId } : {}),
                ...(data.inputPayload !== undefined ? { inputPayload: toJsonValue(data.inputPayload) } : {}),
                ...(data.contextVariables !== undefined
                    ? { contextVariables: toJsonValue(data.contextVariables) }
                    : {}),
                ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
                ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
            },
        });
        return this.toRecord(record);
    }
    async update(organizationId, id, data) {
        try {
            const record = await this.prisma.workflowInstance.update({
                where: {
                    id,
                    organizationId,
                    deletedAt: null,
                },
                data: {
                    ...(data.status !== undefined ? { status: data.status } : {}),
                    ...(data.currentNodeId !== undefined ? { currentNodeId: data.currentNodeId } : {}),
                    ...(data.outputPayload !== undefined
                        ? { outputPayload: data.outputPayload === null ? Prisma.JsonNull : toJsonValue(data.outputPayload) }
                        : {}),
                    ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
                    ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
                    ...(data.updatedBy !== undefined ? { updatedBy: data.updatedBy } : {}),
                    version: { increment: 1 },
                },
            });
            return this.toRecord(record);
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025') {
                return null;
            }
            throw error;
        }
    }
    async list(filter) {
        const cursorFilter = await this.buildCursorFilter(filter.organizationId, filter.cursor);
        const records = await this.prisma.workflowInstance.findMany({
            where: {
                organizationId: filter.organizationId,
                deletedAt: null,
                ...(filter.status !== undefined ? { status: filter.status } : {}),
                ...(filter.definitionId !== undefined ? { definitionId: filter.definitionId } : {}),
                ...(filter.entityType !== undefined ? { entityType: filter.entityType } : {}),
                ...(filter.entityId !== undefined ? { entityId: filter.entityId } : {}),
                ...cursorFilter,
            },
            orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
            take: filter.limit,
        });
        return records.map((record) => this.toRecord(record));
    }
    async buildCursorFilter(organizationId, cursor) {
        if (cursor === undefined) {
            return {};
        }
        const anchor = await this.prisma.workflowInstance.findFirst({
            where: { id: cursor, organizationId, deletedAt: null },
            select: { startedAt: true, id: true },
        });
        if (anchor === null) {
            return {};
        }
        return {
            OR: [
                { startedAt: { lt: anchor.startedAt } },
                { startedAt: anchor.startedAt, id: { lt: anchor.id } },
            ],
        };
    }
    toRecord(record) {
        return {
            id: record.id,
            organizationId: record.organizationId,
            definitionId: record.definitionId,
            definitionVersion: record.definitionVersion,
            parentInstanceId: record.parentInstanceId,
            status: record.status,
            entityType: record.entityType,
            entityId: record.entityId,
            correlationId: record.correlationId,
            initiatorType: record.initiatorType,
            initiatorId: record.initiatorId,
            currentNodeId: record.currentNodeId,
            contextVariables: this.asRecord(record.contextVariables) ?? {},
            inputPayload: this.asRecord(record.inputPayload) ?? {},
            outputPayload: this.asRecord(record.outputPayload),
            startedAt: record.startedAt,
            completedAt: record.completedAt,
            dueAt: record.dueAt,
            slaBreachAt: record.slaBreachAt,
            metadata: this.asRecord(record.metadata) ?? {},
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            version: record.version,
        };
    }
    asRecord(value) {
        if (value === null || value === undefined) {
            return null;
        }
        if (typeof value === 'object' && !Array.isArray(value)) {
            return value;
        }
        return null;
    }
}
//# sourceMappingURL=prisma-workflow-instance.repository.js.map