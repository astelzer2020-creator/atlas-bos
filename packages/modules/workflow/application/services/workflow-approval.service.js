import { ConflictError, err, ForbiddenError, NotFoundError, ok, ValidationError, } from '@atlas/shared-kernel';
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
export class WorkflowApprovalService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async listApprovals(organizationId, input = {}) {
        const limit = Math.min(input.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
        const approvals = await this.deps.approvalRepository.list({
            organizationId,
            limit,
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.instanceId !== undefined ? { instanceId: input.instanceId } : {}),
            ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
        });
        return {
            data: approvals.map((approval) => this.toDto(approval)),
            next_cursor: approvals.length === limit ? (approvals.at(-1)?.id ?? null) : null,
        };
    }
    async getApproval(organizationId, approvalId) {
        const approval = await this.deps.approvalRepository.findById(organizationId, approvalId);
        if (approval === null) {
            return err(new NotFoundError('WorkflowApproval', approvalId));
        }
        return ok(this.toDto(approval));
    }
    async approveStep(organizationId, approvalId, assigneeId, input = {}, actorId) {
        const approval = await this.deps.approvalRepository.findById(organizationId, approvalId);
        if (approval === null) {
            return err(new NotFoundError('WorkflowApproval', approvalId));
        }
        if (approval.status !== 'pending') {
            return err(new ConflictError('Approval is not pending', { details: { status: approval.status } }));
        }
        if (!approval.assigneeIds.includes(assigneeId)) {
            return err(new ForbiddenError('Assignee is not authorized to approve this step'));
        }
        const step = await this.deps.stepRepository.findById(organizationId, approval.stepId);
        if (step === null) {
            return err(new NotFoundError('WorkflowStep', approval.stepId));
        }
        const now = new Date();
        const updatedApproval = await this.deps.approvalRepository.update(organizationId, approvalId, {
            status: 'approved',
            approvedBy: assigneeId,
            resolvedAt: now,
            ...(input.resolutionNote !== undefined ? { resolutionNote: input.resolutionNote } : {}),
            ...(input.formData !== undefined ? { formData: input.formData } : {}),
            ...(actorId !== undefined ? { updatedBy: actorId } : {}),
        });
        if (updatedApproval === null) {
            return err(new NotFoundError('WorkflowApproval', approvalId));
        }
        await this.deps.stepRepository.update(organizationId, step.id, {
            status: 'completed',
            completedAt: now,
            ...(actorId !== undefined ? { updatedBy: actorId } : {}),
        });
        const instance = await this.deps.instanceRepository.findById(organizationId, approval.instanceId);
        if (instance === null) {
            return err(new NotFoundError('WorkflowInstance', approval.instanceId));
        }
        const definition = await this.deps.definitionRepository.findById(organizationId, instance.definitionId);
        if (definition === null) {
            return err(new NotFoundError('WorkflowDefinition', instance.definitionId));
        }
        const resumed = await this.deps.runtimeEngine.resumeAfterHumanTask(organizationId, instance, definition, step.nodeId, step.tokenId, 'approved');
        if (!resumed.ok) {
            return resumed;
        }
        return ok(this.toDto(updatedApproval));
    }
    async rejectStep(organizationId, approvalId, assigneeId, input, actorId) {
        const resolutionNote = input.resolutionNote.trim();
        if (resolutionNote.length === 0) {
            return err(new ValidationError('resolutionNote is required when rejecting', {
                field: 'resolutionNote',
            }));
        }
        const approval = await this.deps.approvalRepository.findById(organizationId, approvalId);
        if (approval === null) {
            return err(new NotFoundError('WorkflowApproval', approvalId));
        }
        if (approval.status !== 'pending') {
            return err(new ConflictError('Approval is not pending', { details: { status: approval.status } }));
        }
        if (!approval.assigneeIds.includes(assigneeId)) {
            return err(new ForbiddenError('Assignee is not authorized to reject this step'));
        }
        const step = await this.deps.stepRepository.findById(organizationId, approval.stepId);
        if (step === null) {
            return err(new NotFoundError('WorkflowStep', approval.stepId));
        }
        const now = new Date();
        const updatedApproval = await this.deps.approvalRepository.update(organizationId, approvalId, {
            status: 'rejected',
            rejectedBy: assigneeId,
            resolvedAt: now,
            resolutionNote,
            ...(actorId !== undefined ? { updatedBy: actorId } : {}),
        });
        if (updatedApproval === null) {
            return err(new NotFoundError('WorkflowApproval', approvalId));
        }
        await this.deps.stepRepository.update(organizationId, step.id, {
            status: 'completed',
            completedAt: now,
            ...(actorId !== undefined ? { updatedBy: actorId } : {}),
        });
        const instance = await this.deps.instanceRepository.findById(organizationId, approval.instanceId);
        if (instance === null) {
            return err(new NotFoundError('WorkflowInstance', approval.instanceId));
        }
        const definition = await this.deps.definitionRepository.findById(organizationId, instance.definitionId);
        if (definition === null) {
            return err(new NotFoundError('WorkflowDefinition', instance.definitionId));
        }
        const resumed = await this.deps.runtimeEngine.resumeAfterHumanTask(organizationId, instance, definition, step.nodeId, step.tokenId, 'rejected');
        if (!resumed.ok) {
            return resumed;
        }
        return ok(this.toDto(updatedApproval));
    }
    toDto(record) {
        return {
            id: record.id,
            organization_id: record.organizationId,
            instance_id: record.instanceId,
            step_id: record.stepId,
            approval_type: record.approvalType,
            status: record.status,
            title: record.title,
            description: record.description,
            assignee_ids: record.assigneeIds,
            approved_by: record.approvedBy,
            rejected_by: record.rejectedBy,
            form_data: record.formData,
            diff_preview: record.diffPreview,
            requested_at: record.requestedAt.toISOString(),
            expires_at: record.expiresAt?.toISOString() ?? null,
            resolved_at: record.resolvedAt?.toISOString() ?? null,
            resolution_note: record.resolutionNote,
            escalation_level: record.escalationLevel,
            metadata: record.metadata,
            created_at: record.createdAt.toISOString(),
            updated_at: record.updatedAt.toISOString(),
            version: record.version,
        };
    }
}
//# sourceMappingURL=workflow-approval.service.js.map