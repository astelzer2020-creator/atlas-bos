import { Prisma } from '@atlas/database';
function toJsonValue(value) {
    return value;
}
export class PrismaWorkflowStepRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findById(organizationId, id) {
        const record = await this.prisma.workflowStep.findFirst({
            where: {
                id,
                organizationId,
                deletedAt: null,
            },
        });
        return record === null ? null : this.toRecord(record);
    }
    async listByInstance(organizationId, instanceId) {
        const records = await this.prisma.workflowStep.findMany({
            where: {
                organizationId,
                instanceId,
                deletedAt: null,
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        return records.map((record) => this.toRecord(record));
    }
    async create(data) {
        const record = await this.prisma.workflowStep.create({
            data: {
                organizationId: data.organizationId,
                instanceId: data.instanceId,
                nodeId: data.nodeId,
                nodeType: data.nodeType,
                status: data.status,
                tokenId: data.tokenId,
                ...(data.stepName !== undefined ? { stepName: data.stepName } : {}),
                ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
                ...(data.assigneeType !== undefined ? { assigneeType: data.assigneeType } : {}),
                ...(data.inputData !== undefined ? { inputData: toJsonValue(data.inputData) } : {}),
                ...(data.outputData !== undefined ? { outputData: toJsonValue(data.outputData) } : {}),
                ...(data.startedAt !== undefined ? { startedAt: data.startedAt } : {}),
                ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
                ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
            },
        });
        return this.toRecord(record);
    }
    async update(organizationId, id, data) {
        try {
            const record = await this.prisma.workflowStep.update({
                where: {
                    id,
                    organizationId,
                    deletedAt: null,
                },
                data: {
                    ...(data.status !== undefined ? { status: data.status } : {}),
                    ...(data.outputData !== undefined ? { outputData: toJsonValue(data.outputData) } : {}),
                    ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
                    ...(data.errorMessage !== undefined ? { errorMessage: data.errorMessage } : {}),
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
    toRecord(record) {
        return {
            id: record.id,
            organizationId: record.organizationId,
            instanceId: record.instanceId,
            nodeId: record.nodeId,
            nodeType: record.nodeType,
            stepName: record.stepName,
            status: record.status,
            assigneeId: record.assigneeId,
            assigneeType: record.assigneeType,
            tokenId: record.tokenId,
            inputData: this.asRecord(record.inputData) ?? {},
            outputData: this.asRecord(record.outputData),
            agentRunId: record.agentRunId,
            errorMessage: record.errorMessage,
            startedAt: record.startedAt,
            completedAt: record.completedAt,
            dueAt: record.dueAt,
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
//# sourceMappingURL=prisma-workflow-step.repository.js.map