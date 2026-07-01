import { ConflictError, err, NotFoundError, ok, Slug, ValidationError, } from '@atlas/shared-kernel';
import { DEFAULT_WORKFLOW_GRAPH, graphHasStartAndEndEvents, parseWorkflowGraph, } from '../../domain/types/workflow-graph.js';
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
export class WorkflowDefinitionService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async createDefinition(organizationId, input, actorId) {
        const slugResult = Slug.create(input.slug);
        if (!slugResult.ok) {
            return slugResult;
        }
        const name = input.name.trim();
        if (name.length === 0) {
            return err(new ValidationError('Workflow definition name is required', { field: 'name' }));
        }
        const existing = await this.deps.definitionRepository.findBySlug(organizationId, slugResult.value.value);
        if (existing !== null) {
            return err(new ConflictError('Workflow definition slug already exists', {
                details: { slug: input.slug },
            }));
        }
        const graphDefinition = input.graphDefinition ?? DEFAULT_WORKFLOW_GRAPH;
        const definition = await this.deps.definitionRepository.create({
            organizationId,
            name,
            slug: slugResult.value.value,
            graphDefinition,
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.category !== undefined ? { category: input.category } : {}),
            ...(input.inputSchema !== undefined ? { inputSchema: input.inputSchema } : {}),
            ...(input.outputSchema !== undefined ? { outputSchema: input.outputSchema } : {}),
            ...(input.isTemplate !== undefined ? { isTemplate: input.isTemplate } : {}),
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
            ...(actorId !== undefined ? { createdBy: actorId } : {}),
        });
        return ok(this.toDto(definition));
    }
    async updateDefinition(organizationId, definitionId, input, actorId) {
        const existing = await this.deps.definitionRepository.findById(organizationId, definitionId);
        if (existing === null) {
            return err(new NotFoundError('WorkflowDefinition', definitionId));
        }
        if (existing.status !== 'draft') {
            return err(new ConflictError('Only draft workflow definitions can be updated', {
                details: { status: existing.status },
            }));
        }
        if (input.expectedVersion !== existing.version) {
            return err(new ConflictError('Workflow definition version mismatch', {
                details: { expected: input.expectedVersion, actual: existing.version },
            }));
        }
        if (input.name !== undefined && input.name.trim().length === 0) {
            return err(new ValidationError('Workflow definition name cannot be empty', { field: 'name' }));
        }
        const updated = await this.deps.definitionRepository.update(organizationId, definitionId, {
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.graphDefinition !== undefined ? { graphDefinition: input.graphDefinition } : {}),
            ...(input.slaPolicies !== undefined ? { slaPolicies: input.slaPolicies } : {}),
            ...(input.inputSchema !== undefined ? { inputSchema: input.inputSchema } : {}),
            ...(input.outputSchema !== undefined ? { outputSchema: input.outputSchema } : {}),
            ...(actorId !== undefined ? { updatedBy: actorId } : {}),
        }, input.expectedVersion);
        if (updated === null) {
            return err(new ConflictError('Workflow definition was modified concurrently', {
                details: { id: definitionId, expectedVersion: input.expectedVersion },
            }));
        }
        return ok(this.toDto(updated));
    }
    async getDefinition(organizationId, definitionId) {
        const definition = await this.deps.definitionRepository.findById(organizationId, definitionId);
        if (definition === null) {
            return err(new NotFoundError('WorkflowDefinition', definitionId));
        }
        return ok(this.toDto(definition));
    }
    async listDefinitions(organizationId, input = {}) {
        const limit = Math.min(input.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
        const definitions = await this.deps.definitionRepository.list({
            organizationId,
            limit,
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.category !== undefined ? { category: input.category } : {}),
            ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
        });
        return {
            data: definitions.map((definition) => this.toDto(definition)),
            next_cursor: definitions.length === limit ? (definitions.at(-1)?.id ?? null) : null,
        };
    }
    async publishDefinition(organizationId, definitionId, actorId) {
        const existing = await this.deps.definitionRepository.findById(organizationId, definitionId);
        if (existing === null) {
            return err(new NotFoundError('WorkflowDefinition', definitionId));
        }
        if (existing.status !== 'draft') {
            return err(new ConflictError('Only draft workflow definitions can be published', {
                details: { status: existing.status },
            }));
        }
        if (!graphHasStartAndEndEvents(existing.graphDefinition)) {
            return err(new ValidationError('Workflow graph must contain start_event and end_event nodes', {
                field: 'graphDefinition',
            }));
        }
        const published = await this.deps.definitionRepository.publish(organizationId, definitionId, new Date(), actorId);
        if (published === null) {
            return err(new NotFoundError('WorkflowDefinition', definitionId));
        }
        return ok(this.toDto(published));
    }
    toDto(record) {
        return {
            id: record.id,
            organization_id: record.organizationId,
            name: record.name,
            slug: record.slug,
            description: record.description,
            definition_version: record.definitionVersion,
            status: record.status,
            category: record.category,
            graph_definition: record.graphDefinition,
            sla_policies: record.slaPolicies,
            compensation_handlers: record.compensationHandlers,
            input_schema: record.inputSchema,
            output_schema: record.outputSchema,
            estimated_duration_hours: record.estimatedDurationHours,
            is_template: record.isTemplate,
            published_at: record.publishedAt?.toISOString() ?? null,
            metadata: record.metadata,
            created_at: record.createdAt.toISOString(),
            updated_at: record.updatedAt.toISOString(),
            version: record.version,
        };
    }
    static parseGraphInput(value) {
        const graph = parseWorkflowGraph(value);
        if (graph === null) {
            return err(new ValidationError('Invalid workflow graph definition', { field: 'graphDefinition' }));
        }
        return ok(graph);
    }
}
//# sourceMappingURL=workflow-definition.service.js.map