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
  AgentDefinitionRecord,
  AgentDefinitionRepository,
  AgentDefinitionStatus,
  AgentRole,
} from '../../domain/repositories/agent-definition.repository.js';

export interface AgentDefinitionDto {
  readonly id: string;
  readonly organization_id: string | null;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly role: AgentRole;
  readonly definition_version: number;
  readonly status: AgentDefinitionStatus;
  readonly model_id: string;
  readonly system_prompt: string;
  readonly allowed_tools: string[];
  readonly constraints: Record<string, unknown>;
  readonly memory_config: Record<string, unknown>;
  readonly risk_policy: Record<string, unknown>;
  readonly is_default: boolean;
  readonly published_at: string | null;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
  readonly updated_at: string;
  readonly version: number;
}

export interface CreateAgentDefinitionInput {
  readonly name: string;
  readonly slug: string;
  readonly role: AgentRole;
  readonly systemPrompt: string;
  readonly description?: string;
  readonly modelId?: string;
  readonly allowedTools?: string[];
  readonly constraints?: Record<string, unknown>;
  readonly memoryConfig?: Record<string, unknown>;
  readonly riskPolicy?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateAgentDefinitionInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly systemPrompt?: string;
  readonly allowedTools?: string[];
  readonly constraints?: Record<string, unknown>;
  readonly memoryConfig?: Record<string, unknown>;
  readonly riskPolicy?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  readonly expectedVersion: number;
}

export interface ListAgentDefinitionsInput {
  readonly status?: AgentDefinitionStatus;
  readonly role?: AgentRole;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface AgentDefinitionServiceDeps {
  readonly definitionRepository: AgentDefinitionRepository;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

const VALID_ROLES: readonly AgentRole[] = [
  'analyst',
  'executor',
  'reviewer',
  'planner',
  'custom',
];

export class AgentDefinitionService {
  constructor(private readonly deps: AgentDefinitionServiceDeps) {}

  async createDefinition(
    organizationId: OrganizationId,
    input: CreateAgentDefinitionInput,
    actorId?: UserId,
  ): Promise<Result<AgentDefinitionDto, ValidationError | ConflictError>> {
    const slugResult = Slug.create(input.slug);
    if (!slugResult.ok) {
      return slugResult;
    }

    const name = input.name.trim();
    if (name.length === 0) {
      return err(new ValidationError('Agent definition name is required', { field: 'name' }));
    }

    const systemPrompt = input.systemPrompt.trim();
    if (systemPrompt.length === 0) {
      return err(
        new ValidationError('Agent definition system prompt is required', { field: 'systemPrompt' }),
      );
    }

    if (!VALID_ROLES.includes(input.role)) {
      return err(new ValidationError('Invalid agent role', { field: 'role' }));
    }

    const existing = await this.deps.definitionRepository.findBySlug(
      organizationId,
      slugResult.value.value,
    );

    if (existing !== null) {
      return err(
        new ConflictError('Agent definition slug already exists', {
          details: { slug: input.slug },
        }),
      );
    }

    const definition = await this.deps.definitionRepository.create({
      organizationId,
      name,
      slug: slugResult.value.value,
      role: input.role,
      systemPrompt,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.modelId !== undefined ? { modelId: input.modelId } : {}),
      ...(input.allowedTools !== undefined ? { allowedTools: input.allowedTools } : {}),
      ...(input.constraints !== undefined ? { constraints: input.constraints } : {}),
      ...(input.memoryConfig !== undefined ? { memoryConfig: input.memoryConfig } : {}),
      ...(input.riskPolicy !== undefined ? { riskPolicy: input.riskPolicy } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(actorId !== undefined ? { createdBy: actorId } : {}),
    });

    return ok(this.toDto(definition));
  }

  async updateDefinition(
    organizationId: OrganizationId,
    definitionId: string,
    input: UpdateAgentDefinitionInput,
    actorId?: UserId,
  ): Promise<Result<AgentDefinitionDto, ValidationError | NotFoundError | ConflictError>> {
    const existing = await this.deps.definitionRepository.findById(organizationId, definitionId);

    if (existing === null) {
      return err(new NotFoundError('AgentDefinition', definitionId));
    }

    if (existing.status !== 'draft') {
      return err(
        new ConflictError('Only draft agent definitions can be updated', {
          details: { status: existing.status },
        }),
      );
    }

    if (input.expectedVersion !== existing.version) {
      return err(
        new ConflictError('Agent definition version mismatch', {
          details: { expected: input.expectedVersion, actual: existing.version },
        }),
      );
    }

    if (input.name !== undefined && input.name.trim().length === 0) {
      return err(new ValidationError('Agent definition name cannot be empty', { field: 'name' }));
    }

    if (input.systemPrompt !== undefined && input.systemPrompt.trim().length === 0) {
      return err(
        new ValidationError('Agent definition system prompt cannot be empty', {
          field: 'systemPrompt',
        }),
      );
    }

    const updated = await this.deps.definitionRepository.update(
      organizationId,
      definitionId,
      {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.systemPrompt !== undefined ? { systemPrompt: input.systemPrompt.trim() } : {}),
        ...(input.allowedTools !== undefined ? { allowedTools: input.allowedTools } : {}),
        ...(input.constraints !== undefined ? { constraints: input.constraints } : {}),
        ...(input.memoryConfig !== undefined ? { memoryConfig: input.memoryConfig } : {}),
        ...(input.riskPolicy !== undefined ? { riskPolicy: input.riskPolicy } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        ...(actorId !== undefined ? { updatedBy: actorId } : {}),
      },
      input.expectedVersion,
    );

    if (updated === null) {
      return err(
        new ConflictError('Agent definition was modified concurrently', {
          details: { id: definitionId, expectedVersion: input.expectedVersion },
        }),
      );
    }

    return ok(this.toDto(updated));
  }

  async getDefinition(
    organizationId: OrganizationId,
    definitionId: string,
  ): Promise<Result<AgentDefinitionDto, NotFoundError>> {
    const definition = await this.deps.definitionRepository.findById(organizationId, definitionId);

    if (definition === null) {
      return err(new NotFoundError('AgentDefinition', definitionId));
    }

    return ok(this.toDto(definition));
  }

  async listDefinitions(
    organizationId: OrganizationId,
    input: ListAgentDefinitionsInput = {},
  ): Promise<{ data: AgentDefinitionDto[]; next_cursor: string | null }> {
    const limit = Math.min(input.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);

    const definitions = await this.deps.definitionRepository.list({
      organizationId,
      limit,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
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
  ): Promise<Result<AgentDefinitionDto, NotFoundError | ConflictError>> {
    const existing = await this.deps.definitionRepository.findById(organizationId, definitionId);

    if (existing === null) {
      return err(new NotFoundError('AgentDefinition', definitionId));
    }

    if (existing.status !== 'draft') {
      return err(
        new ConflictError('Only draft agent definitions can be published', {
          details: { status: existing.status },
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
      return err(new NotFoundError('AgentDefinition', definitionId));
    }

    return ok(this.toDto(published));
  }

  toDto(record: AgentDefinitionRecord): AgentDefinitionDto {
    return {
      id: record.id,
      organization_id: record.organizationId,
      name: record.name,
      slug: record.slug,
      description: record.description,
      role: record.role,
      definition_version: record.definitionVersion,
      status: record.status,
      model_id: record.modelId,
      system_prompt: record.systemPrompt,
      allowed_tools: record.allowedTools,
      constraints: record.constraints,
      memory_config: record.memoryConfig,
      risk_policy: record.riskPolicy,
      is_default: record.isDefault,
      published_at: record.publishedAt?.toISOString() ?? null,
      metadata: record.metadata,
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString(),
      version: record.version,
    };
  }
}