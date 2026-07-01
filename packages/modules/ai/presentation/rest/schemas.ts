import { z } from 'zod';

const agentRoleSchema = z.enum(['analyst', 'executor', 'reviewer', 'planner', 'custom']);
const agentDefinitionStatusSchema = z.enum(['draft', 'published', 'deprecated', 'archived']);
const agentRunStatusSchema = z.enum([
  'init',
  'planning',
  'executing',
  'review_pending',
  'awaiting_human',
  'completed',
  'failed',
  'terminated',
  'cancelled',
]);
const orchestrationPatternSchema = z.enum(['sequential', 'parallel', 'hierarchical']);

export const organizationParamsSchema = z.object({
  organizationId: z.string().uuid(),
});

export const agentDefinitionParamsSchema = z.object({
  organizationId: z.string().uuid(),
  agentDefinitionId: z.string().uuid(),
});

export const agentRunParamsSchema = z.object({
  organizationId: z.string().uuid(),
  agentRunId: z.string().uuid(),
});

const paginationQueryBase = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const listAgentDefinitionsQuerySchema = paginationQueryBase
  .extend({
    status: agentDefinitionStatusSchema.optional(),
    role: agentRoleSchema.optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.role !== undefined ? { role: value.role } : {}),
  }));

export const createAgentDefinitionBodySchema = z
  .object({
    name: z.string().min(1).max(256),
    slug: z.string().min(1).max(64),
    role: agentRoleSchema,
    system_prompt: z.string().min(1).max(65536),
    description: z.string().max(4096).optional(),
    model_id: z.string().min(1).max(128).optional(),
    allowed_tools: z.array(z.string().min(1).max(128)).optional(),
    constraints: z.record(z.unknown()).optional(),
    memory_config: z.record(z.unknown()).optional(),
    risk_policy: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    name: value.name,
    slug: value.slug,
    role: value.role,
    systemPrompt: value.system_prompt,
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.model_id !== undefined ? { modelId: value.model_id } : {}),
    ...(value.allowed_tools !== undefined ? { allowedTools: value.allowed_tools } : {}),
    ...(value.constraints !== undefined ? { constraints: value.constraints } : {}),
    ...(value.memory_config !== undefined ? { memoryConfig: value.memory_config } : {}),
    ...(value.risk_policy !== undefined ? { riskPolicy: value.risk_policy } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));

export const updateAgentDefinitionBodySchema = z
  .object({
    name: z.string().min(1).max(256).optional(),
    description: z.string().max(4096).nullable().optional(),
    system_prompt: z.string().min(1).max(65536).optional(),
    allowed_tools: z.array(z.string().min(1).max(128)).optional(),
    constraints: z.record(z.unknown()).optional(),
    memory_config: z.record(z.unknown()).optional(),
    risk_policy: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    ...(value.name !== undefined ? { name: value.name } : {}),
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.system_prompt !== undefined ? { systemPrompt: value.system_prompt } : {}),
    ...(value.allowed_tools !== undefined ? { allowedTools: value.allowed_tools } : {}),
    ...(value.constraints !== undefined ? { constraints: value.constraints } : {}),
    ...(value.memory_config !== undefined ? { memoryConfig: value.memory_config } : {}),
    ...(value.risk_policy !== undefined ? { riskPolicy: value.risk_policy } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));

export const listAgentRunsQuerySchema = paginationQueryBase
  .extend({
    status: agentRunStatusSchema.optional(),
    agent_definition_id: z.string().uuid().optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.agent_definition_id !== undefined
      ? { agentDefinitionId: value.agent_definition_id }
      : {}),
  }));

export const getAgentRunQuerySchema = z
  .object({
    include_steps: z
      .union([z.literal('true'), z.literal('false'), z.boolean()])
      .optional()
      .default('true'),
  })
  .transform((value) => ({
    includeSteps: value.include_steps === true || value.include_steps === 'true',
  }));

export const createAgentRunBodySchema = z
  .object({
    agent_definition_id: z.string().uuid(),
    goal: z.string().min(1).max(8192),
    conversation_session_id: z.string().uuid().optional(),
    max_iterations: z.coerce.number().int().min(1).max(1000).optional(),
    budget_cents: z.coerce.number().int().min(0).optional(),
    orchestration_pattern: orchestrationPatternSchema.optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    agentDefinitionId: value.agent_definition_id,
    goal: value.goal,
    ...(value.conversation_session_id !== undefined
      ? { conversationSessionId: value.conversation_session_id }
      : {}),
    ...(value.max_iterations !== undefined ? { maxIterations: value.max_iterations } : {}),
    ...(value.budget_cents !== undefined ? { budgetCents: value.budget_cents } : {}),
    ...(value.orchestration_pattern !== undefined
      ? { orchestrationPattern: value.orchestration_pattern }
      : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));

export const cancelAgentRunBodySchema = z
  .object({
    reason: z.string().max(1024).optional(),
  })
  .transform((value) => ({
    ...(value.reason !== undefined ? { reason: value.reason } : {}),
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