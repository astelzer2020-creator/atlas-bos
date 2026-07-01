import {
  ConflictError,
  err,
  NotFoundError,
  ok,
  Slug,
  ValidationError,
  type OrganizationId,
  type Result,
  type UserId,
} from '@atlas/shared-kernel';

import type {
  WorkflowDefinitionRecord,
  WorkflowDefinitionRepository,
  WorkflowDefinitionStatus,
} from '../../domain/repositories/workflow-definition.repository.js';
import {
  DEFAULT_WORKFLOW_GRAPH,
  graphHasStartAndEndEvents,
  parseWorkflowGraph,
  type WorkflowGraph,
} from '../../domain/types/workflow-graph.js';

export interface WorkflowDefinitionDto {
  readonly id: string;
  readonly organization_id: string | null;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly definition_version: number;
  readonly status: WorkflowDefinitionStatus;
  readonly category: string;
  readonly graph_definition: WorkflowGraph;
  readonly sla_policies: Record<string, unknown>;
  readonly compensation_handlers: Record<string, unknown>;
  readonly input_schema: Record<string, unknown>;
  readonly output_schema: Record<string, unknown>;
  readonly estimated_duration_hours: number | null;
  readonly is_template: boolean;
  readonly published_at: string | null;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
  readonly updated_at: string;
  readonly version: number;
}

export interface CreateWorkflowDefinitionInput {
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
  readonly category?: string;
  readonly graphDefinition?: WorkflowGraph;
  readonly inputSchema?: Record<string, unknown>;
  readonly outputSchema?: Record<string, unknown>;
  readonly isTemplate?: boolean;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateWorkflowDefinitionInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly graphDefinition?: WorkflowGraph;
  readonly slaPolicies?: Record<string, unknown>;
  readonly inputSchema?: Record<string, unknown>;
  readonly outputSchema?: Record<string, unknown>;
  readonly expectedVersion: number;
}

export interface ListWorkflowDefinitionsInput {
  readonly status?: WorkflowDefinitionStatus;
  readonly category?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface WorkflowDefinitionServiceDeps {
  readonly definitionRepository: WorkflowDefinitionRepository;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

export class WorkflowDefinitionService {
  constructor(private readonly deps: WorkflowDefinitionServiceDeps) {}

  async createDefinition(
    organizationId: OrganizationId,
    input: CreateWorkflowDefinitionInput,
    actorId?: UserId,
  ): Promise<Result<WorkflowDefinitionDto, ValidationError | ConflictError>> {
    const slugResult = Slug.create(input.slug);
    if (!slugResult.ok) {
      return slugResult;
    }

    const name = input.name.trim();
    if (name.length === 0) {
      return err(new ValidationError('Workflow definition name is required', { field: 'name' }));
    }

    const existing = await this.deps.definitionRepository.findBySlug(
      organizationId,
      slugResult.value.value,
    );

    if (existing !== null) {
      return err(
        new ConflictError('Workflow definition slug already exists', {
          details: { slug: input.slug },
        }),
      );
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

  async updateDefinition(
    organizationId: OrganizationId,
    definitionId: string,
    input: UpdateWorkflowDefinitionInput,
    actorId?: UserId,
  ): Promise<
    Result<WorkflowDefinitionDto, ValidationError | NotFoundError | ConflictError>
  > {
    const existing = await this.deps.definitionRepository.findById(organizationId, definitionId);

    if (existing === null) {
      return err(new NotFoundError('WorkflowDefinition', definitionId));
    }

    if (existing.status !== 'draft') {
      return err(
        new ConflictError('Only draft workflow definitions can be updated', {
          details: { status: existing.status },
        }),
      );
    }

    if (input.expectedVersion !== existing.version) {
      return err(
        new ConflictError('Workflow definition version mismatch', {
          details: { expected: input.expectedVersion, actual: existing.version },
        }),
      );
    }

    if (input.name !== undefined && input.name.trim().length === 0) {
      return err(new ValidationError('Workflow definition name cannot be empty', { field: 'name' }));
    }

    const updated = await this.deps.definitionRepository.update(
      organizationId,
      definitionId,
      {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.graphDefinition !== undefined ? { graphDefinition: input.graphDefinition } : {}),
        ...(input.slaPolicies !== undefined ? { slaPolicies: input.slaPolicies } : {}),
        ...(input.inputSchema !== undefined ? { inputSchema: input.inputSchema } : {}),
        ...(input.outputSchema !== undefined ? { outputSchema: input.outputSchema } : {}),
        ...(actorId !== undefined ? { updatedBy: actorId } : {}),
      },
      input.expectedVersion,
    );

    if (updated === null) {
      return err(
        new ConflictError('Workflow definition was modified concurrently', {
          details: { id: definitionId, expectedVersion: input.expectedVersion },
        }),
      );
    }

    return ok(this.toDto(updated));
  }

  async getDefinition(
    organizationId: OrganizationId,
    definitionId: string,
  ): Promise<Result<WorkflowDefinitionDto, NotFoundError>> {
    const definition = await this.deps.definitionRepository.findById(organizationId, definitionId);

    if (definition === null) {
      return err(new NotFoundError('WorkflowDefinition', definitionId));
    }

    return ok(this.toDto(definition));
  }

  async listDefinitions(
    organizationId: OrganizationId,
    input: ListWorkflowDefinitionsInput = {},
  ): Promise<{ data: WorkflowDefinitionDto[]; next_cursor: string | null }> {
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

  async publishDefinition(
    organizationId: OrganizationId,
    definitionId: string,
    actorId?: UserId,
  ): Promise<
    Result<WorkflowDefinitionDto, ValidationError | NotFoundError | ConflictError>
  > {
    const existing = await this.deps.definitionRepository.findById(organizationId, definitionId);

    if (existing === null) {
      return err(new NotFoundError('WorkflowDefinition', definitionId));
    }

    if (existing.status !== 'draft') {
      return err(
        new ConflictError('Only draft workflow definitions can be published', {
          details: { status: existing.status },
        }),
      );
    }

    if (!graphHasStartAndEndEvents(existing.graphDefinition)) {
      return err(
        new ValidationError('Workflow graph must contain start_event and end_event nodes', {
          field: 'graphDefinition',
        }),
      );
    }

    const published = await this.deps.definitionRepository.publish(
      organizationId,
      definitionId,
      new Date(),
      actorId,
    );

    if (published === null) {
      return err(new NotFoundError('WorkflowDefinition', definitionId));
    }

    return ok(this.toDto(published));
  }

  toDto(record: WorkflowDefinitionRecord): WorkflowDefinitionDto {
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

  static parseGraphInput(value: unknown): Result<WorkflowGraph, ValidationError> {
    const graph = parseWorkflowGraph(value);
    if (graph === null) {
      return err(new ValidationError('Invalid workflow graph definition', { field: 'graphDefinition' }));
    }
    return ok(graph);
  }
}