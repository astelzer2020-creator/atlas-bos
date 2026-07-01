import { createLogger } from '@atlas/platform';
import { WorkflowRuntimeEngine } from './application/engine/workflow-runtime.engine.js';
import { WorkflowApprovalService } from './application/services/workflow-approval.service.js';
import { WorkflowDefinitionService } from './application/services/workflow-definition.service.js';
import { WorkflowInstanceService } from './application/services/workflow-instance.service.js';
import { PrismaWorkflowApprovalRepository } from './infrastructure/persistence/prisma-workflow-approval.repository.js';
import { PrismaWorkflowDefinitionRepository } from './infrastructure/persistence/prisma-workflow-definition.repository.js';
import { PrismaWorkflowInstanceRepository } from './infrastructure/persistence/prisma-workflow-instance.repository.js';
import { PrismaWorkflowStepRepository } from './infrastructure/persistence/prisma-workflow-step.repository.js';
export { PrismaWorkflowDefinitionRepository } from './infrastructure/persistence/prisma-workflow-definition.repository.js';
export { PrismaWorkflowInstanceRepository } from './infrastructure/persistence/prisma-workflow-instance.repository.js';
export { WorkflowRuntimeEngine } from './application/engine/workflow-runtime.engine.js';
export { WorkflowApprovalService } from './application/services/workflow-approval.service.js';
export { WorkflowDefinitionService } from './application/services/workflow-definition.service.js';
export { WorkflowInstanceService } from './application/services/workflow-instance.service.js';
export { registerWorkflowRoutes } from './presentation/rest/workflow.routes.js';
export { DEFAULT_WORKFLOW_GRAPH } from './domain/types/workflow-graph.js';
/**
 * Wires workflow bounded context services with Prisma repositories.
 */
export function createWorkflowModule(options) {
    const logger = options.logger ??
        createLogger({
            service: 'atlas',
            bindings: { module: 'workflow' },
        });
    const definitionRepository = new PrismaWorkflowDefinitionRepository(options.prisma);
    const instanceRepository = new PrismaWorkflowInstanceRepository(options.prisma);
    const stepRepository = new PrismaWorkflowStepRepository(options.prisma);
    const approvalRepository = new PrismaWorkflowApprovalRepository(options.prisma);
    const runtimeEngine = new WorkflowRuntimeEngine({
        instanceRepository,
        stepRepository,
        approvalRepository,
        logger,
    });
    const definitionService = new WorkflowDefinitionService({ definitionRepository });
    const instanceService = new WorkflowInstanceService({
        definitionRepository,
        instanceRepository,
        stepRepository,
        approvalRepository,
        runtimeEngine,
    });
    const approvalService = new WorkflowApprovalService({
        approvalRepository,
        instanceRepository,
        definitionRepository,
        stepRepository,
        runtimeEngine,
    });
    return {
        definitionService,
        instanceService,
        approvalService,
        runtimeEngine,
    };
}
//# sourceMappingURL=module.js.map