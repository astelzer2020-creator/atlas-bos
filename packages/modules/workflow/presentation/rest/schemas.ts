import { z } from 'zod';

const workflowDefinitionStatusSchema = z.enum(['draft', 'published', 'deprecated', 'archived']);
const workflowInstanceStatusSchema = z.enum([
  'running',
  'waiting',
  'completed',
  'failed',
  'cancelled',
  'compensating',
  'suspended',
]);
const workflowApprovalStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'expired',
  'delegated',
  'cancelled',
]);

export const organizationParamsSchema = z.object({
  organizationId: z.string().uuid(),
});

export const workflowDefinitionParamsSchema = z.object({
  organizationId: z.string().uuid(),
  workflowDefinitionId: z.string().uuid(),
});

export const workflowInstanceParamsSchema = z.object({
  organizationId: z.string().uuid(),
  workflowInstanceId: z.string().uuid(),
});

export const approvalParamsSchema = z.object({
  organizationId: z.string().uuid(),
  approvalId: z.string().uuid(),
});

const paginationQueryBase = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const paginationQuerySchema = paginationQueryBase.transform((value) => ({
  limit: value.limit,
  ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
}));

export const listWorkflowDefinitionsQuerySchema = paginationQueryBase
  .extend({
    status: workflowDefinitionStatusSchema.optional(),
    category: z.string().min(1).max(128).optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.category !== undefined ? { category: value.category } : {}),
  }));

export const createWorkflowDefinitionBodySchema = z
  .object({
    name: z.string().min(1).max(256),
    slug: z.string().min(1).max(64),
    description: z.string().max(4096).optional(),
    category: z.string().min(1).max(128).optional(),
    graph_definition: z.record(z.unknown()).optional(),
    input_schema: z.record(z.unknown()).optional(),
    output_schema: z.record(z.unknown()).optional(),
    is_template: z.boolean().optional(),
  })
  .transform((value) => ({
    name: value.name,
    slug: value.slug,
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.category !== undefined ? { category: value.category } : {}),
    ...(value.graph_definition !== undefined ? { graphDefinition: value.graph_definition } : {}),
    ...(value.input_schema !== undefined ? { inputSchema: value.input_schema } : {}),
    ...(value.output_schema !== undefined ? { outputSchema: value.output_schema } : {}),
    ...(value.is_template !== undefined ? { isTemplate: value.is_template } : {}),
  }));

export const updateWorkflowDefinitionBodySchema = z
  .object({
    name: z.string().min(1).max(256).optional(),
    description: z.string().max(4096).nullable().optional(),
    graph_definition: z.record(z.unknown()).optional(),
    sla_policies: z.record(z.unknown()).optional(),
    input_schema: z.record(z.unknown()).optional(),
    output_schema: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    ...(value.name !== undefined ? { name: value.name } : {}),
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.graph_definition !== undefined ? { graphDefinition: value.graph_definition } : {}),
    ...(value.sla_policies !== undefined ? { slaPolicies: value.sla_policies } : {}),
    ...(value.input_schema !== undefined ? { inputSchema: value.input_schema } : {}),
    ...(value.output_schema !== undefined ? { outputSchema: value.output_schema } : {}),
  }));

export const listWorkflowInstancesQuerySchema = paginationQueryBase
  .extend({
    status: workflowInstanceStatusSchema.optional(),
    definition_id: z.string().uuid().optional(),
    entity_type: z.string().min(1).max(128).optional(),
    entity_id: z.string().uuid().optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.definition_id !== undefined ? { definitionId: value.definition_id } : {}),
    ...(value.entity_type !== undefined ? { entityType: value.entity_type } : {}),
    ...(value.entity_id !== undefined ? { entityId: value.entity_id } : {}),
  }));

export const getWorkflowInstanceQuerySchema = z
  .object({
    include_steps: z
      .union([z.literal('true'), z.literal('false'), z.boolean()])
      .optional()
      .default('true'),
  })
  .transform((value) => ({
    includeSteps:
      value.include_steps === true || value.include_steps === 'true',
  }));

export const startWorkflowInstanceBodySchema = z
  .object({
    definition_id: z.string().uuid(),
    entity_type: z.string().min(1).max(128).optional(),
    entity_id: z.string().uuid().optional(),
    correlation_id: z.string().max(256).optional(),
    input_payload: z.record(z.unknown()).optional(),
    context_variables: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    definitionId: value.definition_id,
    ...(value.entity_type !== undefined ? { entityType: value.entity_type } : {}),
    ...(value.entity_id !== undefined ? { entityId: value.entity_id } : {}),
    ...(value.correlation_id !== undefined ? { correlationId: value.correlation_id } : {}),
    ...(value.input_payload !== undefined ? { inputPayload: value.input_payload } : {}),
    ...(value.context_variables !== undefined ? { contextVariables: value.context_variables } : {}),
  }));

export const cancelWorkflowInstanceBodySchema = z
  .object({
    reason: z.string().max(1024).optional(),
  })
  .transform((value) => ({
    ...(value.reason !== undefined ? { reason: value.reason } : {}),
  }));

export const listWorkflowApprovalsQuerySchema = paginationQueryBase
  .extend({
    status: workflowApprovalStatusSchema.optional(),
    instance_id: z.string().uuid().optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.instance_id !== undefined ? { instanceId: value.instance_id } : {}),
  }));

export const approveWorkflowStepBodySchema = z
  .object({
    resolution_note: z.string().max(4096).optional(),
    form_data: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    ...(value.resolution_note !== undefined ? { resolutionNote: value.resolution_note } : {}),
    ...(value.form_data !== undefined ? { formData: value.form_data } : {}),
  }));

export const rejectWorkflowStepBodySchema = z
  .object({
    resolution_note: z.string().min(1).max(4096),
  })
  .transform((value) => ({
    resolutionNote: value.resolution_note,
  }));

export function parseIfMatchHeader(value: string | string[] | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}