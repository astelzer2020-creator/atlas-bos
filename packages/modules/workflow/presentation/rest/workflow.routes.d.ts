import type { FastifyInstance, FastifyRequest } from 'fastify';
import { WorkflowDefinitionService } from '../../application/services/workflow-definition.service.js';
import type { WorkflowApprovalService } from '../../application/services/workflow-approval.service.js';
import type { WorkflowInstanceService } from '../../application/services/workflow-instance.service.js';
export interface WorkflowRouteContext {
    readonly userId: string;
}
export interface WorkflowRoutesDeps {
    readonly definitionService: WorkflowDefinitionService;
    readonly instanceService: WorkflowInstanceService;
    readonly approvalService: WorkflowApprovalService;
    readonly authenticate: (request: FastifyRequest) => Promise<WorkflowRouteContext | null>;
}
export declare function registerWorkflowRoutes(fastify: FastifyInstance, deps: WorkflowRoutesDeps): Promise<void>;
//# sourceMappingURL=workflow.routes.d.ts.map