export const JOB_NAMES = {
  WORKFLOW_INSTANCE_ADVANCE: 'workflow.instance.advance',
  AGENT_RUN_EXECUTE: 'agent.run.execute',
  NOTIFICATION_DELIVER: 'notification.deliver',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

export const QUEUE_NAMES = {
  DEFAULT: 'default',
  AI: 'ai',
  EMAIL: 'email',
  SCHEDULED: 'scheduled',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];