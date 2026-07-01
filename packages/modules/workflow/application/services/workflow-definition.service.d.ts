import { ConflictError, NotFoundError, ValidationError, type OrganizationId, type Result, type UserId } from '@atlas/shared-kernel';
import type { WorkflowDefinitionRecord, WorkflowDefinitionRepository, WorkflowDefinitionStatus } from '../../domain/repositories/workflow-definition.repository.js';
import { type WorkflowGraph } from '../../domain/types/workflow-graph.js';
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
export declare class WorkflowDefinitionService {
    private readonly deps;
    constructor(deps: WorkflowDefinitionServiceDeps);
    createDefinition(organizationId: OrganizationId, input: CreateWorkflowDefinitionInput, actorId?: UserId): Promise<Result<WorkflowDefinitionDto, ValidationError | ConflictError>>;
    updateDefinition(organizationId: OrganizationId, definitionId: string, input: UpdateWorkflowDefinitionInput, actorId?: UserId): Promise<Result<WorkflowDefinitionDto, ValidationError | NotFoundError | ConflictError>>;
    getDefinition(organizationId: OrganizationId, definitionId: string): Promise<Result<WorkflowDefinitionDto, NotFoundError>>;
    listDefinitions(organizationId: OrganizationId, input?: ListWorkflowDefinitionsInput): Promise<{
        data: WorkflowDefinitionDto[];
        next_cursor: string | null;
    }>;
    publishDefinition(organizationId: OrganizationId, definitionId: string, actorId?: UserId): Promise<Result<WorkflowDefinitionDto, ValidationError | NotFoundError | ConflictError>>;
    toDto(record: WorkflowDefinitionRecord): WorkflowDefinitionDto;
    static parseGraphInput(value: unknown): Result<WorkflowGraph, ValidationError>;
}
//# sourceMappingURL=workflow-definition.service.d.ts.map