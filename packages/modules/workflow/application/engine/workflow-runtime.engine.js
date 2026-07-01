import { randomUUID } from 'node:crypto';
import { err, ok, ValidationError } from '@atlas/shared-kernel';
import { evaluateEdgeCondition, findGraphNode, getOutgoingEdges, } from '../../domain/types/workflow-graph.js';
import { executeServiceTask } from './service-task.executor.js';
export class WorkflowRuntimeEngine {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async executeFromNode(organizationId, instance, definition, nodeId, tokenId, outcome) {
        const graph = this.getGraph(definition);
        const node = findGraphNode(graph, nodeId);
        if (node === undefined) {
            return err(new ValidationError(`Unknown workflow node: ${nodeId}`, { field: 'nodeId' }));
        }
        const now = new Date();
        switch (node.type) {
            case 'start_event': {
                await this.deps.stepRepository.create({
                    organizationId,
                    instanceId: instance.id,
                    nodeId: node.id,
                    nodeType: node.type,
                    ...(node.name !== undefined ? { stepName: node.name } : {}),
                    status: 'completed',
                    tokenId,
                    startedAt: now,
                    completedAt: now,
                });
                const updated = await this.deps.instanceRepository.update(organizationId, instance.id, {
                    status: 'running',
                    currentNodeId: node.id,
                });
                if (updated === null) {
                    return err(new ValidationError('Failed to update workflow instance'));
                }
                return this.advanceFromNode(organizationId, updated, definition, node.id, tokenId, outcome);
            }
            case 'end_event': {
                await this.deps.stepRepository.create({
                    organizationId,
                    instanceId: instance.id,
                    nodeId: node.id,
                    nodeType: node.type,
                    ...(node.name !== undefined ? { stepName: node.name } : {}),
                    status: 'completed',
                    tokenId,
                    startedAt: now,
                    completedAt: now,
                });
                const completed = await this.deps.instanceRepository.update(organizationId, instance.id, {
                    status: 'completed',
                    currentNodeId: node.id,
                    completedAt: now,
                });
                if (completed === null) {
                    return err(new ValidationError('Failed to complete workflow instance'));
                }
                return ok(completed);
            }
            case 'human_task': {
                const config = node.config ?? {};
                const assigneeIds = this.extractAssigneeIds(config);
                const title = typeof config.title === 'string' && config.title.trim().length > 0
                    ? config.title.trim()
                    : node.name ?? 'Approval required';
                const description = typeof config.description === 'string' ? config.description : undefined;
                const approvalType = this.extractApprovalType(config);
                const step = await this.deps.stepRepository.create({
                    organizationId,
                    instanceId: instance.id,
                    nodeId: node.id,
                    nodeType: node.type,
                    ...(node.name !== undefined ? { stepName: node.name } : {}),
                    status: 'waiting',
                    tokenId,
                    startedAt: now,
                });
                await this.deps.approvalRepository.create({
                    organizationId,
                    instanceId: instance.id,
                    stepId: step.id,
                    approvalType,
                    title,
                    ...(description !== undefined ? { description } : {}),
                    assigneeIds,
                });
                const waiting = await this.deps.instanceRepository.update(organizationId, instance.id, {
                    status: 'waiting',
                    currentNodeId: node.id,
                });
                if (waiting === null) {
                    return err(new ValidationError('Failed to set workflow instance to waiting'));
                }
                return ok(waiting);
            }
            case 'service_task': {
                const serviceResult = await executeServiceTask({
                    organizationId,
                    instanceId: instance.id,
                    nodeId: node.id,
                    ...(node.name !== undefined ? { nodeName: node.name } : {}),
                    config: node.config ?? {},
                });
                await this.deps.stepRepository.create({
                    organizationId,
                    instanceId: instance.id,
                    nodeId: node.id,
                    nodeType: node.type,
                    ...(node.name !== undefined ? { stepName: node.name } : {}),
                    status: serviceResult.executed ? 'completed' : 'failed',
                    tokenId,
                    outputData: { ...serviceResult },
                    startedAt: now,
                    completedAt: now,
                });
                if (!serviceResult.executed) {
                    const failed = await this.deps.instanceRepository.update(organizationId, instance.id, {
                        status: 'failed',
                        currentNodeId: node.id,
                    });
                    if (failed === null) {
                        return err(new ValidationError('Failed to mark workflow instance as failed'));
                    }
                    return ok(failed);
                }
                const updated = await this.deps.instanceRepository.update(organizationId, instance.id, {
                    status: 'running',
                    currentNodeId: node.id,
                });
                if (updated === null) {
                    return err(new ValidationError('Failed to update workflow instance'));
                }
                return this.advanceFromNode(organizationId, updated, definition, node.id, tokenId, outcome);
            }
            case 'exclusive_gateway': {
                await this.deps.stepRepository.create({
                    organizationId,
                    instanceId: instance.id,
                    nodeId: node.id,
                    nodeType: node.type,
                    ...(node.name !== undefined ? { stepName: node.name } : {}),
                    status: 'completed',
                    tokenId,
                    startedAt: now,
                    completedAt: now,
                });
                const edges = getOutgoingEdges(graph, node.id);
                const edge = edges.find((candidate) => evaluateEdgeCondition(candidate.condition, outcome));
                if (edge === undefined) {
                    return err(new ValidationError('No matching edge from exclusive gateway', { field: 'condition' }));
                }
                const updated = await this.deps.instanceRepository.update(organizationId, instance.id, {
                    status: 'running',
                    currentNodeId: node.id,
                });
                if (updated === null) {
                    return err(new ValidationError('Failed to update workflow instance'));
                }
                return this.executeFromNode(organizationId, updated, definition, edge.to, tokenId, outcome);
            }
            case 'parallel_gateway': {
                await this.deps.stepRepository.create({
                    organizationId,
                    instanceId: instance.id,
                    nodeId: node.id,
                    nodeType: node.type,
                    ...(node.name !== undefined ? { stepName: node.name } : {}),
                    status: 'completed',
                    tokenId,
                    startedAt: now,
                    completedAt: now,
                });
                const edges = getOutgoingEdges(graph, node.id);
                let current = instance;
                const gatewayUpdated = await this.deps.instanceRepository.update(organizationId, instance.id, {
                    status: 'running',
                    currentNodeId: node.id,
                });
                if (gatewayUpdated === null) {
                    return err(new ValidationError('Failed to update workflow instance'));
                }
                current = gatewayUpdated;
                for (const edge of edges) {
                    const branchTokenId = randomUUID();
                    const result = await this.executeFromNode(organizationId, current, definition, edge.to, branchTokenId, outcome);
                    if (!result.ok) {
                        return result;
                    }
                    current = result.value;
                }
                return ok(current);
            }
            default:
                return err(new ValidationError(`Unsupported workflow node type: ${node.type}`, { field: 'nodeType' }));
        }
    }
    async advanceFromNode(organizationId, instance, definition, nodeId, tokenId, outcome) {
        const graph = this.getGraph(definition);
        const edges = getOutgoingEdges(graph, nodeId);
        const matchingEdges = edges.filter((edge) => evaluateEdgeCondition(edge.condition, outcome));
        if (matchingEdges.length === 0) {
            return err(new ValidationError('No matching edge from node', { field: 'condition' }));
        }
        let current = instance;
        for (const edge of matchingEdges) {
            const result = await this.executeFromNode(organizationId, current, definition, edge.to, tokenId, outcome);
            if (!result.ok) {
                return result;
            }
            current = result.value;
        }
        return ok(current);
    }
    async resumeAfterHumanTask(organizationId, instance, definition, nodeId, tokenId, outcome) {
        const running = await this.deps.instanceRepository.update(organizationId, instance.id, {
            status: 'running',
        });
        if (running === null) {
            return err(new ValidationError('Failed to resume workflow instance'));
        }
        return this.advanceFromNode(organizationId, running, definition, nodeId, tokenId, outcome);
    }
    getGraph(definition) {
        return definition.graphDefinition;
    }
    extractAssigneeIds(config) {
        const direct = config.assigneeIds;
        if (Array.isArray(direct)) {
            return direct.filter((value) => typeof value === 'string');
        }
        const assignment = config.assignment;
        if (assignment !== null &&
            assignment !== undefined &&
            typeof assignment === 'object' &&
            !Array.isArray(assignment)) {
            const assigneeIds = assignment.assigneeIds;
            if (Array.isArray(assigneeIds)) {
                return assigneeIds.filter((value) => typeof value === 'string');
            }
        }
        return [];
    }
    extractApprovalType(config) {
        const raw = config.approvalType;
        if (raw === 'any_of' || raw === 'all_of' || raw === 'sequential' || raw === 'single') {
            return raw;
        }
        return 'single';
    }
}
//# sourceMappingURL=workflow-runtime.engine.js.map