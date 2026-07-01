import { randomUUID } from 'node:crypto';
import { ConflictError, err, NotFoundError, ok, ValidationError, } from '@atlas/shared-kernel';
import { findStartNode } from '../../domain/types/workflow-graph.js';
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
export class WorkflowInstanceService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async startInstance(organizationId, input, actorId) {
        const definition = await this.deps.definitionRepository.findById(organizationId, input.definitionId);
        if (definition === null) {
            return err(new NotFoundError('WorkflowDefinition', input.definitionId));
        }
        if (definition.status !== 'published') {
            return err(new ConflictError('Workflow definition must be published to start an instance', {
                details: { definitionId: input.definitionId, status: definition.status },
            }));
        }
        const startNode = findStartNode(definition.graphDefinition);
        if (startNode === undefined) {
            return err(new ValidationError('Workflow definition has no start_event node', {
                field: 'graphDefinition',
            }));
        }
        const instance = await this.deps.instanceRepository.create({
            organizationId,
            definitionId: definition.id,
            definitionVersion: definition.definitionVersion,
            ...(input.entityType !== undefined ? { entityType: input.entityType } : {}),
            ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
            ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
            ...(input.inputPayload !== undefined ? { inputPayload: input.inputPayload } : {}),
            ...(input.contextVariables !== undefined ? { contextVariables: input.contextVariables } : {}),
            initiatorType: actorId !== undefined ? 'user' : 'api',
            ...(actorId !== undefined ? { initiatorId: actorId, createdBy: actorId } : {}),
        });
        const tokenId = randomUUID();
        const execution = await this.deps.runtimeEngine.executeFromNode(organizationId, instance, definition, startNode.id, tokenId);
        if (!execution.ok) {
            return execution;
        }
        return ok(this.toDto(execution.value));
    }
    async getInstance(organizationId, instanceId, includeSteps = true) {
        const instance = await this.deps.instanceRepository.findById(organizationId, instanceId);
        if (instance === null) {
            return err(new NotFoundError('WorkflowInstance', instanceId));
        }
        const steps = includeSteps
            ? await this.deps.stepRepository.listByInstance(organizationId, instanceId)
            : [];
        return ok({
            ...this.toDto(instance),
            steps: steps.map((step) => this.toStepDto(step)),
        });
    }
    async listInstances(organizationId, input = {}) {
        const limit = Math.min(input.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
        const instances = await this.deps.instanceRepository.list({
            organizationId,
            limit,
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.definitionId !== undefined ? { definitionId: input.definitionId } : {}),
            ...(input.entityType !== undefined ? { entityType: input.entityType } : {}),
            ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
            ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
        });
        return {
            data: instances.map((instance) => this.toDto(instance)),
            next_cursor: instances.length === limit ? (instances.at(-1)?.id ?? null) : null,
        };
    }
    async cancelInstance(organizationId, instanceId, reason, actorId) {
        const instance = await this.deps.instanceRepository.findById(organizationId, instanceId);
        if (instance === null) {
            return err(new NotFoundError('WorkflowInstance', instanceId));
        }
        if (instance.status !== 'running' && instance.status !== 'waiting') {
            return err(new ConflictError('Only running or waiting workflow instances can be cancelled', {
                details: { status: instance.status },
            }));
        }
        await this.deps.approvalRepository.cancelPendingByInstance(organizationId, instanceId, actorId);
        const cancelled = await this.deps.instanceRepository.update(organizationId, instanceId, {
            status: 'cancelled',
            completedAt: new Date(),
            ...(reason !== undefined && reason.trim().length > 0
                ? { metadata: { ...instance.metadata, cancelReason: reason.trim() } }
                : {}),
            ...(actorId !== undefined ? { updatedBy: actorId } : {}),
        });
        if (cancelled === null) {
            return err(new NotFoundError('WorkflowInstance', instanceId));
        }
        return ok(this.toDto(cancelled));
    }
    toDto(record) {
        return {
            id: record.id,
            organization_id: record.organizationId,
            definition_id: record.definitionId,
            definition_version: record.definitionVersion,
            parent_instance_id: record.parentInstanceId,
            status: record.status,
            entity_type: record.entityType,
            entity_id: record.entityId,
            correlation_id: record.correlationId,
            initiator_type: record.initiatorType,
            initiator_id: record.initiatorId,
            current_node_id: record.currentNodeId,
            context_variables: record.contextVariables,
            input_payload: record.inputPayload,
            output_payload: record.outputPayload,
            started_at: record.startedAt.toISOString(),
            completed_at: record.completedAt?.toISOString() ?? null,
            due_at: record.dueAt?.toISOString() ?? null,
            sla_breach_at: record.slaBreachAt?.toISOString() ?? null,
            metadata: record.metadata,
            created_at: record.createdAt.toISOString(),
            updated_at: record.updatedAt.toISOString(),
            version: record.version,
        };
    }
    toStepDto(record) {
        return {
            id: record.id,
            instance_id: record.instanceId,
            node_id: record.nodeId,
            node_type: record.nodeType,
            step_name: record.stepName,
            status: record.status,
            assignee_id: record.assigneeId,
            assignee_type: record.assigneeType,
            token_id: record.tokenId,
            input_data: record.inputData,
            output_data: record.outputData,
            agent_run_id: record.agentRunId,
            error_message: record.errorMessage,
            started_at: record.startedAt?.toISOString() ?? null,
            completed_at: record.completedAt?.toISOString() ?? null,
            due_at: record.dueAt?.toISOString() ?? null,
        };
    }
}
//# sourceMappingURL=workflow-instance.service.js.map