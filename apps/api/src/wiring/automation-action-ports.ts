import type { Logger } from '@atlas/platform';
import {
  AUTOMATION_SYSTEM_ACTOR_ID,
  type ActionExecutionPorts,
} from '@atlas/module-automation';
import type { NotificationService } from '@atlas/module-notifications';
import { createEmailTransport } from '@atlas/module-notifications';
import type { AgentRunService } from '@atlas/module-ai';
import type { WorkflowInstanceService } from '@atlas/module-workflow';
import type { OrganizationId } from '@atlas/shared-kernel';

import {
  createEntityMutationPort,
  type CreateEntityMutationPortOptions,
} from './entity-mutation-port.js';

export interface CreateAutomationActionPortsOptions
  extends CreateEntityMutationPortOptions {
  readonly notificationService: NotificationService;
  readonly workflowInstanceService: WorkflowInstanceService;
  readonly agentRunService: AgentRunService;
  readonly logger: Logger;
}

export function createAutomationActionPorts(
  options: CreateAutomationActionPortsOptions,
): ActionExecutionPorts {
  const emailTransport = createEmailTransport(options.logger.child({ channel: 'email' }));

  return {
    notificationDispatch: {
      async sendNotification(input) {
        const result = await options.notificationService.sendNotification(
          input.organizationId,
          {
            definition_id: input.definitionId,
            category: 'operational',
            recipient_user_id: input.recipientUserId,
            title: input.title,
            idempotency_key: input.idempotencyKey,
            ...(input.body !== undefined ? { body: input.body } : {}),
            ...(input.payload !== undefined ? { payload: input.payload } : {}),
          },
          input.actorUserId,
        );

        if (!result.ok) {
          throw new Error(result.error.message);
        }

        return { notificationId: result.value.id };
      },
    },
    emailDispatch: {
      async sendEmail(input) {
        const result = await emailTransport.send({
          to: input.to,
          subject: input.subject,
          body: input.body,
        });

        return {
          accepted: result.accepted,
          messageId: result.messageId,
          transport: result.transport,
        };
      },
    },
    agentInvoke: {
      async invokeAgent(input) {
        const result = await options.agentRunService.startRun(
          input.organizationId as OrganizationId,
          {
            agentDefinitionId: input.agentDefinitionId,
            goal: input.goal,
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
          },
          AUTOMATION_SYSTEM_ACTOR_ID,
        );

        if (!result.ok) {
          throw new Error(result.error.message);
        }

        return { runId: result.value.id };
      },
    },
    workflowStart: {
      async startWorkflow(input) {
        const result = await options.workflowInstanceService.startInstance(
          input.organizationId as OrganizationId,
          {
            definitionId: input.definitionId,
            ...(input.inputPayload !== undefined ? { inputPayload: input.inputPayload } : {}),
            ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
          },
          AUTOMATION_SYSTEM_ACTOR_ID,
        );

        if (!result.ok) {
          throw new Error(result.error.message);
        }

        return { instanceId: result.value.id };
      },
    },
    entityMutation: createEntityMutationPort(options),
  };
}