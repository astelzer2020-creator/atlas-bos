import type { OrganizationId } from '@atlas/shared-kernel';

import {
  AUTOMATION_SYSTEM_ACTOR_ID,
  type ActionExecutionPorts,
} from '../ports/action-integration.ports.js';
import { evaluateCondition } from './condition-evaluator.js';
import type { ActionExecutedRecord } from '../../domain/repositories/automation-execution-log.repository.js';
import type { AutomationActionRecord } from '../../domain/repositories/automation-rule.repository.js';

const SUPPORTED_ACTIONS = new Set([
  'send_notification',
  'send_email',
  'update_entity',
  'webhook_call',
  'start_workflow',
  'delay',
  'create_entity',
  'invoke_agent',
  'tag_entity',
  'condition_branch',
]);

const WEBHOOK_TIMEOUT_MS = 10_000;
const MAX_INLINE_DELAY_MS = 250;

export interface PlannedAction {
  readonly action_type: string;
  readonly name: string;
  readonly config: Record<string, unknown>;
}

export interface ActionExecutionContext {
  readonly organizationId: OrganizationId;
  readonly eventPayload: Record<string, unknown>;
  readonly ports?: ActionExecutionPorts;
  readonly ruleId?: string;
  readonly executionId?: string;
}

export function planActions(actions: readonly AutomationActionRecord[]): PlannedAction[] {
  return actions
    .filter((action) => action.isActive)
    .sort((left, right) => left.actionOrder - right.actionOrder)
    .map((action) => ({
      action_type: action.actionType,
      name: action.name,
      config: action.config,
    }));
}

function successRecord(
  action: AutomationActionRecord,
  result: Record<string, unknown>,
): ActionExecutedRecord {
  return {
    action_type: action.actionType,
    name: action.name,
    status: 'success',
    config: action.config,
    result,
  };
}

function failedRecord(
  action: AutomationActionRecord,
  error: string,
): ActionExecutedRecord {
  return {
    action_type: action.actionType,
    name: action.name,
    status: 'failed',
    config: action.config,
    error,
  };
}

async function executeWebhookCall(
  action: AutomationActionRecord,
  context: ActionExecutionContext,
): Promise<ActionExecutedRecord> {
  const url = action.config.url;

  if (typeof url !== 'string' || url.length === 0) {
    return failedRecord(action, 'config.url is required for webhook_call actions');
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return failedRecord(action, 'Only http and https webhook URLs are supported');
    }

    const method = (typeof action.config.method === 'string'
      ? action.config.method.toUpperCase()
      : 'POST') as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
    const payload =
      action.config.payload !== undefined && typeof action.config.payload === 'object'
        ? action.config.payload
        : context.eventPayload;

    const requestBody =
      method === 'GET' || method === 'HEAD' ? null : JSON.stringify(payload);

    const response = await fetch(url, {
      method,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'atlas-automation/1.0',
      },
      ...(requestBody !== null ? { body: requestBody } : {}),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    const body = await response.text();

    if (!response.ok) {
      return failedRecord(action, `Webhook returned HTTP ${String(response.status)}`);
    }

    return successRecord(action, {
      status: response.status,
      body: body.slice(0, 2000),
      executed_at: new Date().toISOString(),
    });
  } catch (error) {
    return failedRecord(
      action,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function executeDelay(action: AutomationActionRecord): Promise<ActionExecutedRecord> {
  const durationMs =
    typeof action.config.duration_ms === 'number'
      ? action.config.duration_ms
      : typeof action.config.durationMs === 'number'
        ? action.config.durationMs
        : 0;

  if (durationMs > 0 && durationMs <= MAX_INLINE_DELAY_MS) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, durationMs);
    });
  }

  return successRecord(action, {
    duration_ms: durationMs,
    inline_wait_applied: durationMs > 0 && durationMs <= MAX_INLINE_DELAY_MS,
    executed_at: new Date().toISOString(),
  });
}

async function executeSendNotification(
  action: AutomationActionRecord,
  context: ActionExecutionContext,
): Promise<ActionExecutedRecord> {
  const recipientUserId = action.config.recipient_user_id ?? action.config.recipientUserId;
  const title = action.config.title;
  const definitionId = action.config.definition_id ?? action.config.definitionId;
  const resolvedDefinitionId =
    typeof definitionId === 'string' ? definitionId : 'automation.notification';

  if (typeof recipientUserId !== 'string' || recipientUserId.length === 0) {
    return failedRecord(action, 'config.recipient_user_id is required for send_notification');
  }

  if (typeof title !== 'string' || title.trim().length === 0) {
    return failedRecord(action, 'config.title is required for send_notification');
  }

  const port = context.ports?.notificationDispatch;
  if (port === undefined) {
    return successRecord(action, {
      organization_id: context.organizationId,
      definition_id: resolvedDefinitionId,
      recipient_user_id: recipientUserId,
      title,
      body: typeof action.config.body === 'string' ? action.config.body : null,
      dispatched: false,
      executed_at: new Date().toISOString(),
    });
  }

  try {
    const idempotencyKey =
      context.executionId !== undefined
        ? `automation:${context.executionId}:${action.id}`
        : `automation:${action.id}:${Date.now()}`;

    const dispatched = await port.sendNotification({
      organizationId: context.organizationId,
      definitionId: resolvedDefinitionId,
      recipientUserId,
      title: title.trim(),
      ...(typeof action.config.body === 'string' ? { body: action.config.body } : {}),
      idempotencyKey,
      actorUserId: AUTOMATION_SYSTEM_ACTOR_ID,
      payload: {
        automation_rule_id: context.ruleId ?? null,
        automation_execution_id: context.executionId ?? null,
        action_id: action.id,
      },
    });

    return successRecord(action, {
      organization_id: context.organizationId,
      definition_id: resolvedDefinitionId,
      recipient_user_id: recipientUserId,
      notification_id: dispatched.notificationId,
      dispatched: true,
      executed_at: new Date().toISOString(),
    });
  } catch (error) {
    return failedRecord(
      action,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function executeSendEmail(
  action: AutomationActionRecord,
  context: ActionExecutionContext,
): Promise<ActionExecutedRecord> {
  const to = action.config.to ?? action.config.recipient_email;
  const subject = action.config.subject;
  const body = action.config.body;

  if (typeof to !== 'string' || to.length === 0) {
    return failedRecord(action, 'config.to is required for send_email');
  }

  if (typeof subject !== 'string' || subject.trim().length === 0) {
    return failedRecord(action, 'config.subject is required for send_email');
  }

  const resolvedBody = typeof body === 'string' ? body : '';
  const port = context.ports?.emailDispatch;

  if (port === undefined) {
    return successRecord(action, {
      to,
      subject,
      body: resolvedBody,
      dispatched: false,
      executed_at: new Date().toISOString(),
    });
  }

  try {
    const dispatched = await port.sendEmail({
      to,
      subject: subject.trim(),
      body: resolvedBody,
    });

    return successRecord(action, {
      to,
      subject,
      body: resolvedBody,
      message_id: dispatched.messageId,
      transport: dispatched.transport,
      dispatched: dispatched.accepted,
      executed_at: new Date().toISOString(),
    });
  } catch (error) {
    return failedRecord(
      action,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function readEntityFields(
  action: AutomationActionRecord,
): Record<string, unknown> | null {
  const fields = action.config.fields ?? action.config.data;

  if (fields === undefined || typeof fields !== 'object' || Array.isArray(fields)) {
    return null;
  }

  return fields as Record<string, unknown>;
}

async function executeUpdateEntity(
  action: AutomationActionRecord,
  context: ActionExecutionContext,
): Promise<ActionExecutedRecord> {
  const entityType = action.config.entity_type ?? action.config.entityType;
  const entityId = action.config.entity_id ?? action.config.entityId;
  const fields = readEntityFields(action);

  if (typeof entityType !== 'string' || entityType.length === 0) {
    return failedRecord(action, 'config.entity_type is required for update_entity');
  }

  if (typeof entityId !== 'string' || entityId.length === 0) {
    return failedRecord(action, 'config.entity_id is required for update_entity');
  }

  if (fields === null) {
    return failedRecord(action, 'config.fields object is required for update_entity');
  }

  const port = context.ports?.entityMutation;
  if (port === undefined) {
    return successRecord(action, {
      entity_type: entityType,
      entity_id: entityId,
      fields,
      updated: false,
      executed_at: new Date().toISOString(),
    });
  }

  try {
    const updated = await port.updateEntity({
      organizationId: context.organizationId,
      entityType,
      entityId,
      fields,
    });

    return successRecord(action, {
      entity_type: entityType,
      entity_id: updated.entityId,
      updated: true,
      executed_at: new Date().toISOString(),
    });
  } catch (error) {
    return failedRecord(
      action,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function executeCreateEntity(
  action: AutomationActionRecord,
  context: ActionExecutionContext,
): Promise<ActionExecutedRecord> {
  const entityType = action.config.entity_type ?? action.config.entityType;
  const fields = readEntityFields(action);
  const parentId = action.config.parent_id ?? action.config.parentId ?? action.config.project_id;

  if (typeof entityType !== 'string' || entityType.length === 0) {
    return failedRecord(action, 'config.entity_type is required for create_entity');
  }

  if (fields === null) {
    return failedRecord(action, 'config.fields object is required for create_entity');
  }

  const port = context.ports?.entityMutation;
  if (port === undefined) {
    return successRecord(action, {
      entity_type: entityType,
      fields,
      created: false,
      executed_at: new Date().toISOString(),
    });
  }

  try {
    const created = await port.createEntity({
      organizationId: context.organizationId,
      entityType,
      fields,
      ...(typeof parentId === 'string' ? { parentId } : {}),
    });

    return successRecord(action, {
      entity_type: entityType,
      entity_id: created.entityId,
      created: true,
      executed_at: new Date().toISOString(),
    });
  } catch (error) {
    return failedRecord(
      action,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function executeTagEntity(
  action: AutomationActionRecord,
  context: ActionExecutionContext,
): Promise<ActionExecutedRecord> {
  const entityType = action.config.entity_type ?? action.config.entityType;
  const entityId = action.config.entity_id ?? action.config.entityId;
  const rawTags = action.config.tags;
  const mode = action.config.mode;

  if (typeof entityType !== 'string' || entityType.length === 0) {
    return failedRecord(action, 'config.entity_type is required for tag_entity');
  }

  if (typeof entityId !== 'string' || entityId.length === 0) {
    return failedRecord(action, 'config.entity_id is required for tag_entity');
  }

  if (!Array.isArray(rawTags) || rawTags.length === 0) {
    return failedRecord(action, 'config.tags array is required for tag_entity');
  }

  const tags = rawTags.filter((tag): tag is string => typeof tag === 'string' && tag.length > 0);
  if (tags.length === 0) {
    return failedRecord(action, 'config.tags must contain at least one non-empty string');
  }

  const tagMode =
    mode === 'add' || mode === 'remove' || mode === 'replace' ? mode : 'add';

  const port = context.ports?.entityMutation;
  if (port === undefined) {
    return successRecord(action, {
      entity_type: entityType,
      entity_id: entityId,
      tags,
      tagged: false,
      executed_at: new Date().toISOString(),
    });
  }

  try {
    const tagged = await port.tagEntity({
      organizationId: context.organizationId,
      entityType,
      entityId,
      tags,
      mode: tagMode,
    });

    return successRecord(action, {
      entity_type: entityType,
      entity_id: tagged.entityId,
      tags: tagged.tags,
      tagged: true,
      executed_at: new Date().toISOString(),
    });
  } catch (error) {
    return failedRecord(
      action,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function executeConditionBranch(
  action: AutomationActionRecord,
  context: ActionExecutionContext,
): ActionExecutedRecord {
  const condition = action.config.condition ?? action.config.when;

  if (condition === undefined || typeof condition !== 'object' || Array.isArray(condition)) {
    return failedRecord(action, 'config.condition object is required for condition_branch');
  }

  const matched = evaluateCondition(
    condition as Record<string, unknown>,
    context.eventPayload,
  );

  return successRecord(action, {
    branch_matched: matched,
    condition,
    executed_at: new Date().toISOString(),
  });
}

async function executeStartWorkflow(
  action: AutomationActionRecord,
  context: ActionExecutionContext,
): Promise<ActionExecutedRecord> {
  const workflowDefinitionId =
    action.config.workflow_definition_id ?? action.config.workflowDefinitionId;

  if (typeof workflowDefinitionId !== 'string' || workflowDefinitionId.length === 0) {
    return failedRecord(action, 'config.workflow_definition_id is required for start_workflow');
  }

  const inputPayload =
    action.config.input !== undefined && typeof action.config.input === 'object'
      ? (action.config.input as Record<string, unknown>)
      : context.eventPayload;

  const port = context.ports?.workflowStart;
  if (port === undefined) {
    return successRecord(action, {
      organization_id: context.organizationId,
      workflow_definition_id: workflowDefinitionId,
      input: inputPayload,
      started: false,
      executed_at: new Date().toISOString(),
    });
  }

  try {
    const started = await port.startWorkflow({
      organizationId: context.organizationId,
      definitionId: workflowDefinitionId,
      inputPayload,
      ...(context.executionId !== undefined
        ? { correlationId: `automation:${context.executionId}` }
        : {}),
    });

    return successRecord(action, {
      organization_id: context.organizationId,
      workflow_definition_id: workflowDefinitionId,
      workflow_instance_id: started.instanceId,
      started: true,
      executed_at: new Date().toISOString(),
    });
  } catch (error) {
    return failedRecord(
      action,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function executeInvokeAgent(
  action: AutomationActionRecord,
  context: ActionExecutionContext,
): Promise<ActionExecutedRecord> {
  const agentDefinitionId =
    action.config.agent_definition_id ?? action.config.agentDefinitionId;
  const goal = action.config.goal;

  if (typeof agentDefinitionId !== 'string' || agentDefinitionId.length === 0) {
    return failedRecord(action, 'config.agent_definition_id is required for invoke_agent');
  }

  if (typeof goal !== 'string' || goal.trim().length === 0) {
    return failedRecord(action, 'config.goal is required for invoke_agent');
  }

  const port = context.ports?.agentInvoke;
  if (port === undefined) {
    return successRecord(action, {
      agent_definition_id: agentDefinitionId,
      goal: goal.trim(),
      invoked: false,
      executed_at: new Date().toISOString(),
    });
  }

  try {
    const metadata =
      action.config.metadata !== undefined && typeof action.config.metadata === 'object'
        ? (action.config.metadata as Record<string, unknown>)
        : undefined;

    const invoked = await port.invokeAgent({
      organizationId: context.organizationId,
      agentDefinitionId,
      goal: goal.trim(),
      ...(metadata !== undefined ? { metadata } : {}),
    });

    return successRecord(action, {
      agent_definition_id: agentDefinitionId,
      agent_run_id: invoked.runId,
      invoked: true,
      executed_at: new Date().toISOString(),
    });
  } catch (error) {
    return failedRecord(
      action,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function executeAction(
  action: AutomationActionRecord,
  context: ActionExecutionContext,
): Promise<ActionExecutedRecord> {
  if (!SUPPORTED_ACTIONS.has(action.actionType)) {
    return {
      action_type: action.actionType,
      name: action.name,
      status: 'skipped',
      config: action.config,
      error: `Action type "${action.actionType}" is not supported`,
    };
  }

  switch (action.actionType) {
    case 'webhook_call':
      return executeWebhookCall(action, context);
    case 'delay':
      return executeDelay(action);
    case 'send_notification':
      return executeSendNotification(action, context);
    case 'send_email':
      return executeSendEmail(action, context);
    case 'update_entity':
      return executeUpdateEntity(action, context);
    case 'start_workflow':
      return executeStartWorkflow(action, context);
    case 'invoke_agent':
      return executeInvokeAgent(action, context);
    case 'create_entity':
      return executeCreateEntity(action, context);
    case 'tag_entity':
      return executeTagEntity(action, context);
    case 'condition_branch':
      return executeConditionBranch(action, context);
    default:
      return failedRecord(action, `Unhandled action type: ${action.actionType}`);
  }
}

export async function executeActions(
  actions: readonly AutomationActionRecord[],
  context: ActionExecutionContext,
): Promise<ActionExecutedRecord[]> {
  const activeActions = actions
    .filter((action) => action.isActive)
    .sort((left, right) => left.actionOrder - right.actionOrder);

  const results: ActionExecutedRecord[] = [];

  for (const action of activeActions) {
    results.push(await executeAction(action, context));
  }

  return results;
}

/** @deprecated Use executeActions instead */
export const executeActionStub = executeAction;
/** @deprecated Use executeActions instead */
export const executeActionsStub = executeActions;