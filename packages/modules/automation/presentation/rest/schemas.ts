import { z } from 'zod';

const automationRuleStatusSchema = z.enum(['draft', 'enabled', 'disabled', 'archived']);
const automationTriggerTypeSchema = z.enum([
  'event',
  'schedule',
  'webhook',
  'manual',
  'entity_change',
]);
const automationActionTypeSchema = z.enum([
  'send_notification',
  'send_email',
  'update_entity',
  'create_entity',
  'webhook_call',
  'invoke_agent',
  'start_workflow',
  'tag_entity',
  'delay',
  'condition_branch',
]);
const actionOnFailureSchema = z.enum(['stop', 'continue', 'retry', 'compensate']);

export const organizationParamsSchema = z.object({
  organizationId: z.string().uuid(),
});

export const automationRuleParamsSchema = z.object({
  organizationId: z.string().uuid(),
  automationRuleId: z.string().uuid(),
});

const paginationQueryBase = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const listAutomationRulesQuerySchema = paginationQueryBase
  .extend({
    status: automationRuleStatusSchema.optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
  }));

const automationTriggerBodySchema = z
  .object({
    trigger_order: z.number().int().min(0).optional(),
    trigger_type: automationTriggerTypeSchema,
    event_type: z.string().max(256).nullable().optional(),
    schedule_cron: z.string().max(128).nullable().optional(),
    schedule_timezone: z.string().max(64).optional(),
    webhook_path: z.string().max(512).nullable().optional(),
    filter_expression: z.string().max(4096).nullable().optional(),
    filter_json: z.record(z.unknown()).optional(),
    is_active: z.boolean().optional(),
  })
  .transform((value) => ({
    ...(value.trigger_order !== undefined ? { triggerOrder: value.trigger_order } : {}),
    triggerType: value.trigger_type,
    ...(value.event_type !== undefined ? { eventType: value.event_type } : {}),
    ...(value.schedule_cron !== undefined ? { scheduleCron: value.schedule_cron } : {}),
    ...(value.schedule_timezone !== undefined
      ? { scheduleTimezone: value.schedule_timezone }
      : {}),
    ...(value.webhook_path !== undefined ? { webhookPath: value.webhook_path } : {}),
    ...(value.filter_expression !== undefined
      ? { filterExpression: value.filter_expression }
      : {}),
    ...(value.filter_json !== undefined ? { filterJson: value.filter_json } : {}),
    ...(value.is_active !== undefined ? { isActive: value.is_active } : {}),
  }));

const automationActionBodySchema = z
  .object({
    action_order: z.number().int().min(0),
    action_type: automationActionTypeSchema,
    name: z.string().min(1).max(256),
    config: z.record(z.unknown()).optional(),
    condition_expression: z.string().max(4096).nullable().optional(),
    on_failure: actionOnFailureSchema.optional(),
    timeout_seconds: z.number().int().min(1).optional(),
    is_active: z.boolean().optional(),
  })
  .transform((value) => ({
    actionOrder: value.action_order,
    actionType: value.action_type,
    name: value.name,
    ...(value.config !== undefined ? { config: value.config } : {}),
    ...(value.condition_expression !== undefined
      ? { conditionExpression: value.condition_expression }
      : {}),
    ...(value.on_failure !== undefined ? { onFailure: value.on_failure } : {}),
    ...(value.timeout_seconds !== undefined ? { timeoutSeconds: value.timeout_seconds } : {}),
    ...(value.is_active !== undefined ? { isActive: value.is_active } : {}),
  }));

export const createAutomationRuleBodySchema = z
  .object({
    name: z.string().min(1).max(256),
    description: z.string().max(4096).optional(),
    triggers: z.array(automationTriggerBodySchema).optional(),
    actions: z.array(automationActionBodySchema).optional(),
    settings: z.record(z.unknown()).optional(),
    tags: z.array(z.string().max(64)).optional(),
  })
  .transform((value) => ({
    name: value.name,
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.triggers !== undefined ? { triggers: value.triggers } : {}),
    ...(value.actions !== undefined ? { actions: value.actions } : {}),
    ...(value.settings !== undefined ? { settings: value.settings } : {}),
    ...(value.tags !== undefined ? { tags: value.tags } : {}),
  }));

export const updateAutomationRuleBodySchema = z
  .object({
    name: z.string().min(1).max(256).optional(),
    description: z.string().max(4096).nullable().optional(),
    triggers: z.array(automationTriggerBodySchema).optional(),
    actions: z.array(automationActionBodySchema).optional(),
    settings: z.record(z.unknown()).optional(),
    tags: z.array(z.string().max(64)).optional(),
  })
  .transform((value) => ({
    ...(value.name !== undefined ? { name: value.name } : {}),
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.triggers !== undefined ? { triggers: value.triggers } : {}),
    ...(value.actions !== undefined ? { actions: value.actions } : {}),
    ...(value.settings !== undefined ? { settings: value.settings } : {}),
    ...(value.tags !== undefined ? { tags: value.tags } : {}),
  }));

export const dryRunAutomationRuleBodySchema = z
  .object({
    event_payload: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    eventPayload: value.event_payload ?? {},
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