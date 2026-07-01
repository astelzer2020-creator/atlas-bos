import type { OrganizationId, UserId } from '@atlas/shared-kernel';

export const AUTOMATION_SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000001' as UserId;

export interface SendAutomationNotificationInput {
  readonly organizationId: OrganizationId;
  readonly definitionId: string;
  readonly recipientUserId: string;
  readonly title: string;
  readonly body?: string;
  readonly idempotencyKey: string;
  readonly actorUserId: UserId;
  readonly payload?: Record<string, unknown>;
}

export interface SendAutomationEmailInput {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
}

export interface StartAutomationWorkflowInput {
  readonly organizationId: OrganizationId;
  readonly definitionId: string;
  readonly inputPayload?: Record<string, unknown>;
  readonly correlationId?: string;
}

export interface NotificationDispatchPort {
  sendNotification(input: SendAutomationNotificationInput): Promise<{ notificationId: string }>;
}

export interface EmailDispatchPort {
  sendEmail(input: SendAutomationEmailInput): Promise<{
    accepted: boolean;
    messageId: string;
    transport: string;
  }>;
}

export interface WorkflowStartPort {
  startWorkflow(input: StartAutomationWorkflowInput): Promise<{ instanceId: string }>;
}

export interface InvokeAutomationAgentInput {
  readonly organizationId: OrganizationId;
  readonly agentDefinitionId: string;
  readonly goal: string;
  readonly metadata?: Record<string, unknown>;
}

export interface AgentInvokePort {
  invokeAgent(input: InvokeAutomationAgentInput): Promise<{ runId: string }>;
}

export interface CreateAutomationEntityInput {
  readonly organizationId: OrganizationId;
  readonly entityType: string;
  readonly fields: Record<string, unknown>;
  readonly parentId?: string;
}

export interface UpdateAutomationEntityInput {
  readonly organizationId: OrganizationId;
  readonly entityType: string;
  readonly entityId: string;
  readonly fields: Record<string, unknown>;
}

export interface TagAutomationEntityInput {
  readonly organizationId: OrganizationId;
  readonly entityType: string;
  readonly entityId: string;
  readonly tags: readonly string[];
  readonly mode?: 'add' | 'remove' | 'replace';
}

export interface EntityMutationPort {
  createEntity(input: CreateAutomationEntityInput): Promise<{ entityId: string }>;
  updateEntity(input: UpdateAutomationEntityInput): Promise<{ entityId: string }>;
  tagEntity(input: TagAutomationEntityInput): Promise<{ entityId: string; tags: string[] }>;
}

export interface ActionExecutionPorts {
  readonly notificationDispatch?: NotificationDispatchPort;
  readonly emailDispatch?: EmailDispatchPort;
  readonly workflowStart?: WorkflowStartPort;
  readonly agentInvoke?: AgentInvokePort;
  readonly entityMutation?: EntityMutationPort;
}