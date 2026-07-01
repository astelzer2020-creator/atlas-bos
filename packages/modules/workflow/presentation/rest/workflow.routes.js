import { mapDomainErrorToHttp } from '@atlas/platform';
import { createOrganizationId, parseUserId } from '@atlas/shared-kernel';
import { WorkflowDefinitionService } from '../../application/services/workflow-definition.service.js';
import { approvalParamsSchema, approveWorkflowStepBodySchema, cancelWorkflowInstanceBodySchema, createWorkflowDefinitionBodySchema, getWorkflowInstanceQuerySchema, listWorkflowApprovalsQuerySchema, listWorkflowDefinitionsQuerySchema, listWorkflowInstancesQuerySchema, organizationParamsSchema, parseIfMatchHeader, rejectWorkflowStepBodySchema, startWorkflowInstanceBodySchema, updateWorkflowDefinitionBodySchema, workflowDefinitionParamsSchema, workflowInstanceParamsSchema, } from './schemas.js';
function validationError(reply, issues) {
    return reply.status(422).send({
        type: 'https://api.atlas.example.com/errors/validation-failed',
        title: 'Validation Failed',
        status: 422,
        detail: 'Request validation failed',
        errors: issues.map((issue) => ({
            field: issue.path.join('.'),
            code: 'validation_failed',
            message: issue.message,
        })),
    });
}
function sendResult(reply, result, successStatus = 200) {
    if (!result.ok) {
        const httpError = mapDomainErrorToHttp(result.error);
        return reply.status(httpError.status).send(httpError.toProblemDetails());
    }
    return reply.status(successStatus).send(result.value);
}
async function requireAuth(request, reply, authenticate) {
    const context = await authenticate(request);
    if (context === null) {
        reply.status(401).send({
            type: 'https://api.atlas.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required',
        });
        return null;
    }
    const userIdResult = parseUserId(context.userId);
    if (!userIdResult.ok) {
        reply.status(401).send({
            type: 'https://api.atlas.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Invalid user context',
        });
        return null;
    }
    return userIdResult.value;
}
export async function registerWorkflowRoutes(fastify, deps) {
    fastify.get('/v1/organizations/:organizationId/workflow-definitions', async (request, reply) => {
        const userId = await requireAuth(request, reply, deps.authenticate);
        if (userId === null) {
            return;
        }
        const params = organizationParamsSchema.safeParse(request.params);
        if (!params.success) {
            return validationError(reply, params.error.issues);
        }
        const query = listWorkflowDefinitionsQuerySchema.safeParse(request.query);
        if (!query.success) {
            return validationError(reply, query.error.issues);
        }
        const organizationIdResult = createOrganizationId(params.data.organizationId);
        if (!organizationIdResult.ok) {
            return validationError(reply, [
                { path: ['organizationId'], message: 'Must be a valid UUID' },
            ]);
        }
        const result = await deps.definitionService.listDefinitions(organizationIdResult.value, query.data);
        return reply.status(200).send({
            data: result.data,
            pagination: {
                has_more: result.next_cursor !== null,
                next_cursor: result.next_cursor,
                limit: query.data.limit,
            },
        });
    });
    fastify.post('/v1/organizations/:organizationId/workflow-definitions', async (request, reply) => {
        const userId = await requireAuth(request, reply, deps.authenticate);
        if (userId === null) {
            return;
        }
        const params = organizationParamsSchema.safeParse(request.params);
        if (!params.success) {
            return validationError(reply, params.error.issues);
        }
        const body = createWorkflowDefinitionBodySchema.safeParse(request.body);
        if (!body.success) {
            return validationError(reply, body.error.issues);
        }
        const organizationIdResult = createOrganizationId(params.data.organizationId);
        if (!organizationIdResult.ok) {
            return validationError(reply, [
                { path: ['organizationId'], message: 'Must be a valid UUID' },
            ]);
        }
        let parsedGraph;
        if (body.data.graphDefinition !== undefined) {
            const graphResult = WorkflowDefinitionService.parseGraphInput(body.data.graphDefinition);
            if (!graphResult.ok) {
                return sendResult(reply, graphResult);
            }
            parsedGraph = graphResult.value;
        }
        const createInput = {
            name: body.data.name,
            slug: body.data.slug,
            ...(body.data.description !== undefined ? { description: body.data.description } : {}),
            ...(body.data.category !== undefined ? { category: body.data.category } : {}),
            ...(parsedGraph !== undefined ? { graphDefinition: parsedGraph } : {}),
            ...(body.data.inputSchema !== undefined ? { inputSchema: body.data.inputSchema } : {}),
            ...(body.data.outputSchema !== undefined ? { outputSchema: body.data.outputSchema } : {}),
            ...(body.data.isTemplate !== undefined ? { isTemplate: body.data.isTemplate } : {}),
        };
        const result = await deps.definitionService.createDefinition(organizationIdResult.value, createInput, userId);
        return sendResult(reply, result, 201);
    });
    fastify.get('/v1/organizations/:organizationId/workflow-definitions/:workflowDefinitionId', async (request, reply) => {
        const userId = await requireAuth(request, reply, deps.authenticate);
        if (userId === null) {
            return;
        }
        const params = workflowDefinitionParamsSchema.safeParse(request.params);
        if (!params.success) {
            return validationError(reply, params.error.issues);
        }
        const organizationIdResult = createOrganizationId(params.data.organizationId);
        if (!organizationIdResult.ok) {
            return validationError(reply, [
                { path: ['organizationId'], message: 'Must be a valid UUID' },
            ]);
        }
        const result = await deps.definitionService.getDefinition(organizationIdResult.value, params.data.workflowDefinitionId);
        return sendResult(reply, result);
    });
    fastify.patch('/v1/organizations/:organizationId/workflow-definitions/:workflowDefinitionId', async (request, reply) => {
        const userId = await requireAuth(request, reply, deps.authenticate);
        if (userId === null) {
            return;
        }
        const params = workflowDefinitionParamsSchema.safeParse(request.params);
        if (!params.success) {
            return validationError(reply, params.error.issues);
        }
        const body = updateWorkflowDefinitionBodySchema.safeParse(request.body);
        if (!body.success) {
            return validationError(reply, body.error.issues);
        }
        const expectedVersion = parseIfMatchHeader(request.headers['if-match']);
        if (expectedVersion === null) {
            return validationError(reply, [
                { path: ['If-Match'], message: 'If-Match header with a positive integer version is required' },
            ]);
        }
        const organizationIdResult = createOrganizationId(params.data.organizationId);
        if (!organizationIdResult.ok) {
            return validationError(reply, [
                { path: ['organizationId'], message: 'Must be a valid UUID' },
            ]);
        }
        let parsedGraph;
        if (body.data.graphDefinition !== undefined) {
            const graphResult = WorkflowDefinitionService.parseGraphInput(body.data.graphDefinition);
            if (!graphResult.ok) {
                return sendResult(reply, graphResult);
            }
            parsedGraph = graphResult.value;
        }
        const updateInput = {
            expectedVersion,
            ...(body.data.name !== undefined ? { name: body.data.name } : {}),
            ...(body.data.description !== undefined ? { description: body.data.description } : {}),
            ...(parsedGraph !== undefined ? { graphDefinition: parsedGraph } : {}),
            ...(body.data.slaPolicies !== undefined ? { slaPolicies: body.data.slaPolicies } : {}),
            ...(body.data.inputSchema !== undefined ? { inputSchema: body.data.inputSchema } : {}),
            ...(body.data.outputSchema !== undefined ? { outputSchema: body.data.outputSchema } : {}),
        };
        const result = await deps.definitionService.updateDefinition(organizationIdResult.value, params.data.workflowDefinitionId, updateInput, userId);
        return sendResult(reply, result);
    });
    fastify.post('/v1/organizations/:organizationId/workflow-definitions/:workflowDefinitionId/publish', async (request, reply) => {
        const userId = await requireAuth(request, reply, deps.authenticate);
        if (userId === null) {
            return;
        }
        const params = workflowDefinitionParamsSchema.safeParse(request.params);
        if (!params.success) {
            return validationError(reply, params.error.issues);
        }
        const organizationIdResult = createOrganizationId(params.data.organizationId);
        if (!organizationIdResult.ok) {
            return validationError(reply, [
                { path: ['organizationId'], message: 'Must be a valid UUID' },
            ]);
        }
        const result = await deps.definitionService.publishDefinition(organizationIdResult.value, params.data.workflowDefinitionId, userId);
        return sendResult(reply, result);
    });
    fastify.get('/v1/organizations/:organizationId/workflow-instances', async (request, reply) => {
        const userId = await requireAuth(request, reply, deps.authenticate);
        if (userId === null) {
            return;
        }
        const params = organizationParamsSchema.safeParse(request.params);
        if (!params.success) {
            return validationError(reply, params.error.issues);
        }
        const query = listWorkflowInstancesQuerySchema.safeParse(request.query);
        if (!query.success) {
            return validationError(reply, query.error.issues);
        }
        const organizationIdResult = createOrganizationId(params.data.organizationId);
        if (!organizationIdResult.ok) {
            return validationError(reply, [
                { path: ['organizationId'], message: 'Must be a valid UUID' },
            ]);
        }
        const result = await deps.instanceService.listInstances(organizationIdResult.value, query.data);
        return reply.status(200).send({
            data: result.data,
            pagination: {
                has_more: result.next_cursor !== null,
                next_cursor: result.next_cursor,
                limit: query.data.limit,
            },
        });
    });
    fastify.post('/v1/organizations/:organizationId/workflow-instances', async (request, reply) => {
        const userId = await requireAuth(request, reply, deps.authenticate);
        if (userId === null) {
            return;
        }
        const params = organizationParamsSchema.safeParse(request.params);
        if (!params.success) {
            return validationError(reply, params.error.issues);
        }
        const body = startWorkflowInstanceBodySchema.safeParse(request.body);
        if (!body.success) {
            return validationError(reply, body.error.issues);
        }
        const organizationIdResult = createOrganizationId(params.data.organizationId);
        if (!organizationIdResult.ok) {
            return validationError(reply, [
                { path: ['organizationId'], message: 'Must be a valid UUID' },
            ]);
        }
        const result = await deps.instanceService.startInstance(organizationIdResult.value, body.data, userId);
        return sendResult(reply, result, 201);
    });
    fastify.get('/v1/organizations/:organizationId/workflow-instances/:workflowInstanceId', async (request, reply) => {
        const userId = await requireAuth(request, reply, deps.authenticate);
        if (userId === null) {
            return;
        }
        const params = workflowInstanceParamsSchema.safeParse(request.params);
        if (!params.success) {
            return validationError(reply, params.error.issues);
        }
        const query = getWorkflowInstanceQuerySchema.safeParse(request.query);
        if (!query.success) {
            return validationError(reply, query.error.issues);
        }
        const organizationIdResult = createOrganizationId(params.data.organizationId);
        if (!organizationIdResult.ok) {
            return validationError(reply, [
                { path: ['organizationId'], message: 'Must be a valid UUID' },
            ]);
        }
        const result = await deps.instanceService.getInstance(organizationIdResult.value, params.data.workflowInstanceId, query.data.includeSteps);
        return sendResult(reply, result);
    });
    fastify.post('/v1/organizations/:organizationId/workflow-instances/:workflowInstanceId/cancel', async (request, reply) => {
        const userId = await requireAuth(request, reply, deps.authenticate);
        if (userId === null) {
            return;
        }
        const params = workflowInstanceParamsSchema.safeParse(request.params);
        if (!params.success) {
            return validationError(reply, params.error.issues);
        }
        const body = cancelWorkflowInstanceBodySchema.safeParse(request.body ?? {});
        if (!body.success) {
            return validationError(reply, body.error.issues);
        }
        const organizationIdResult = createOrganizationId(params.data.organizationId);
        if (!organizationIdResult.ok) {
            return validationError(reply, [
                { path: ['organizationId'], message: 'Must be a valid UUID' },
            ]);
        }
        const result = await deps.instanceService.cancelInstance(organizationIdResult.value, params.data.workflowInstanceId, body.data.reason, userId);
        return sendResult(reply, result);
    });
    fastify.get('/v1/organizations/:organizationId/approvals', async (request, reply) => {
        const userId = await requireAuth(request, reply, deps.authenticate);
        if (userId === null) {
            return;
        }
        const params = organizationParamsSchema.safeParse(request.params);
        if (!params.success) {
            return validationError(reply, params.error.issues);
        }
        const query = listWorkflowApprovalsQuerySchema.safeParse(request.query);
        if (!query.success) {
            return validationError(reply, query.error.issues);
        }
        const organizationIdResult = createOrganizationId(params.data.organizationId);
        if (!organizationIdResult.ok) {
            return validationError(reply, [
                { path: ['organizationId'], message: 'Must be a valid UUID' },
            ]);
        }
        const result = await deps.approvalService.listApprovals(organizationIdResult.value, query.data);
        return reply.status(200).send({
            data: result.data,
            pagination: {
                has_more: result.next_cursor !== null,
                next_cursor: result.next_cursor,
                limit: query.data.limit,
            },
        });
    });
    fastify.get('/v1/organizations/:organizationId/approvals/:approvalId', async (request, reply) => {
        const userId = await requireAuth(request, reply, deps.authenticate);
        if (userId === null) {
            return;
        }
        const params = approvalParamsSchema.safeParse(request.params);
        if (!params.success) {
            return validationError(reply, params.error.issues);
        }
        const organizationIdResult = createOrganizationId(params.data.organizationId);
        if (!organizationIdResult.ok) {
            return validationError(reply, [
                { path: ['organizationId'], message: 'Must be a valid UUID' },
            ]);
        }
        const result = await deps.approvalService.getApproval(organizationIdResult.value, params.data.approvalId);
        return sendResult(reply, result);
    });
    fastify.post('/v1/organizations/:organizationId/approvals/:approvalId/approve', async (request, reply) => {
        const userId = await requireAuth(request, reply, deps.authenticate);
        if (userId === null) {
            return;
        }
        const params = approvalParamsSchema.safeParse(request.params);
        if (!params.success) {
            return validationError(reply, params.error.issues);
        }
        const body = approveWorkflowStepBodySchema.safeParse(request.body ?? {});
        if (!body.success) {
            return validationError(reply, body.error.issues);
        }
        const organizationIdResult = createOrganizationId(params.data.organizationId);
        if (!organizationIdResult.ok) {
            return validationError(reply, [
                { path: ['organizationId'], message: 'Must be a valid UUID' },
            ]);
        }
        const result = await deps.approvalService.approveStep(organizationIdResult.value, params.data.approvalId, userId, body.data, userId);
        return sendResult(reply, result);
    });
    fastify.post('/v1/organizations/:organizationId/approvals/:approvalId/reject', async (request, reply) => {
        const userId = await requireAuth(request, reply, deps.authenticate);
        if (userId === null) {
            return;
        }
        const params = approvalParamsSchema.safeParse(request.params);
        if (!params.success) {
            return validationError(reply, params.error.issues);
        }
        const body = rejectWorkflowStepBodySchema.safeParse(request.body);
        if (!body.success) {
            return validationError(reply, body.error.issues);
        }
        const organizationIdResult = createOrganizationId(params.data.organizationId);
        if (!organizationIdResult.ok) {
            return validationError(reply, [
                { path: ['organizationId'], message: 'Must be a valid UUID' },
            ]);
        }
        const result = await deps.approvalService.rejectStep(organizationIdResult.value, params.data.approvalId, userId, body.data, userId);
        return sendResult(reply, result);
    });
}
//# sourceMappingURL=workflow.routes.js.map