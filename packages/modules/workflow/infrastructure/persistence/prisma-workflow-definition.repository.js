import { Prisma } from '@atlas/database';
import { DEFAULT_WORKFLOW_GRAPH, parseWorkflowGraph } from '../../domain/types/workflow-graph.js';
function toJsonValue(value) {
    return value;
}
export class PrismaWorkflowDefinitionRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findById(organizationId, id) {
        const record = await this.prisma.workflowDefinition.findFirst({
            where: {
                id,
                organizationId,
                deletedAt: null,
            },
        });
        return record === null ? null : this.toRecord(record);
    }
    async findBySlug(organizationId, slug) {
        const record = await this.prisma.workflowDefinition.findFirst({
            where: {
                organizationId,
                slug,
                deletedAt: null,
            },
        });
        return record === null ? null : this.toRecord(record);
    }
    async create(data) {
        const record = await this.prisma.workflowDefinition.create({
            data: {
                organizationId: data.organizationId,
                name: data.name,
                slug: data.slug,
                status: 'draft',
                graphDefinition: toJsonValue(data.graphDefinition),
                ...(data.description !== undefined ? { description: data.description } : {}),
                ...(data.category !== undefined ? { category: data.category } : {}),
                ...(data.inputSchema !== undefined ? { inputSchema: toJsonValue(data.inputSchema) } : {}),
                ...(data.outputSchema !== undefined ? { outputSchema: toJsonValue(data.outputSchema) } : {}),
                ...(data.isTemplate !== undefined ? { isTemplate: data.isTemplate } : {}),
                ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
                ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
            },
        });
        return this.toRecord(record);
    }
    async update(organizationId, id, data, expectedVersion) {
        try {
            const record = await this.prisma.workflowDefinition.update({
                where: {
                    id,
                    organizationId,
                    version: expectedVersion,
                    deletedAt: null,
                    status: 'draft',
                },
                data: {
                    ...(data.name !== undefined ? { name: data.name } : {}),
                    ...(data.description !== undefined ? { description: data.description } : {}),
                    ...(data.graphDefinition !== undefined
                        ? { graphDefinition: toJsonValue(data.graphDefinition) }
                        : {}),
                    ...(data.slaPolicies !== undefined ? { slaPolicies: toJsonValue(data.slaPolicies) } : {}),
                    ...(data.inputSchema !== undefined ? { inputSchema: toJsonValue(data.inputSchema) } : {}),
                    ...(data.outputSchema !== undefined ? { outputSchema: toJsonValue(data.outputSchema) } : {}),
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
    async publish(organizationId, id, publishedAt, updatedBy) {
        try {
            const record = await this.prisma.workflowDefinition.update({
                where: {
                    id,
                    organizationId,
                    deletedAt: null,
                    status: 'draft',
                },
                data: {
                    status: 'published',
                    publishedAt,
                    ...(updatedBy !== undefined ? { updatedBy } : {}),
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
        const records = await this.prisma.workflowDefinition.findMany({
            where: {
                organizationId: filter.organizationId,
                deletedAt: null,
                ...(filter.status !== undefined ? { status: filter.status } : {}),
                ...(filter.category !== undefined ? { category: filter.category } : {}),
                ...cursorFilter,
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: filter.limit,
        });
        return records.map((record) => this.toRecord(record));
    }
    async buildCursorFilter(organizationId, cursor) {
        if (cursor === undefined) {
            return {};
        }
        const anchor = await this.prisma.workflowDefinition.findFirst({
            where: { id: cursor, organizationId, deletedAt: null },
            select: { createdAt: true, id: true },
        });
        if (anchor === null) {
            return {};
        }
        return {
            OR: [
                { createdAt: { lt: anchor.createdAt } },
                { createdAt: anchor.createdAt, id: { lt: anchor.id } },
            ],
        };
    }
    toRecord(record) {
        const graph = parseWorkflowGraph(record.graphDefinition) ?? DEFAULT_WORKFLOW_GRAPH;
        return {
            id: record.id,
            organizationId: record.organizationId,
            name: record.name,
            slug: record.slug,
            description: record.description,
            definitionVersion: record.definitionVersion,
            status: record.status,
            category: record.category,
            graphDefinition: graph,
            slaPolicies: this.asRecord(record.slaPolicies) ?? {},
            compensationHandlers: this.asRecord(record.compensationHandlers) ?? {},
            inputSchema: this.asRecord(record.inputSchema) ?? {},
            outputSchema: this.asRecord(record.outputSchema) ?? {},
            estimatedDurationHours: record.estimatedDurationHours,
            isTemplate: record.isTemplate,
            publishedAt: record.publishedAt,
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
//# sourceMappingURL=prisma-workflow-definition.repository.js.map