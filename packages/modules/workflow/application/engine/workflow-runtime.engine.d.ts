import { ValidationError, type OrganizationId, type Result } from '@atlas/shared-kernel';
import type { Logger } from '@atlas/platform';
import type { WorkflowDefinitionRecord } from '../../domain/repositories/workflow-definition.repository.js';
import type { WorkflowInstanceRecord } from '../../domain/repositories/workflow-instance.repository.js';
import type { WorkflowApprovalRepository } from '../../domain/repositories/workflow-approval.repository.js';
import type { WorkflowInstanceRepository } from '../../domain/repositories/workflow-instance.repository.js';
import type { WorkflowStepRepository } from '../../domain/repositories/workflow-step.repository.js';
export interface WorkflowRuntimeEngineDeps {
    readonly instanceRepository: WorkflowInstanceRepository;
    readonly stepRepository: WorkflowStepRepository;
    readonly approvalRepository: WorkflowApprovalRepository;
    readonly logger?: Logger;
}
export declare class WorkflowRuntimeEngine {
    private readonly deps;
    constructor(deps: WorkflowRuntimeEngineDeps);
    executeFromNode(organizationId: OrganizationId, instance: WorkflowInstanceRecord, definition: WorkflowDefinitionRecord, nodeId: string, tokenId: string, outcome?: string): Promise<Result<WorkflowInstanceRecord, ValidationError>>;
    advanceFromNode(organizationId: OrganizationId, instance: WorkflowInstanceRecord, definition: WorkflowDefinitionRecord, nodeId: string, tokenId: string, outcome?: string): Promise<Result<WorkflowInstanceRecord, ValidationError>>;
    resumeAfterHumanTask(organizationId: OrganizationId, instance: WorkflowInstanceRecord, definition: WorkflowDefinitionRecord, nodeId: string, tokenId: string, outcome: string): Promise<Result<WorkflowInstanceRecord, ValidationError>>;
    private getGraph;
    private extractAssigneeIds;
    private extractApprovalType;
}
//# sourceMappingURL=workflow-runtime.engine.d.ts.map