import {
  PrismaWorkflowDefinitionRepository,
  PrismaWorkflowInstanceRepository,
} from '@atlas/module-workflow';
import { JOB_NAMES, QUEUE_NAMES } from '@atlas/queue';
import type { OrganizationId } from '@atlas/shared-kernel';

import type { WorkerContainer } from '../di/container.js';
import type { WorkerProcessor } from './types.js';

const WORKER_NAME = 'workflow-runtime';

interface WorkflowAdvancePayload {
  readonly organizationId: string;
  readonly instanceId: string;
  readonly nodeId: string;
  readonly tokenId: string;
  readonly outcome?: string;
}

export function createWorkflowRuntimeWorker(container: WorkerContainer): WorkerProcessor {
  const log = container.logger.child({ worker: WORKER_NAME });
  const instanceRepository = new PrismaWorkflowInstanceRepository(container.prisma);
  const definitionRepository = new PrismaWorkflowDefinitionRepository(container.prisma);

  container.queueManager.registerProcessor(
    QUEUE_NAMES.DEFAULT,
    async (job) => {
      if (job.name !== JOB_NAMES.WORKFLOW_INSTANCE_ADVANCE) {
        return;
      }

      const payload = job.data.payload as unknown as WorkflowAdvancePayload;
      const { organizationId, instanceId, nodeId, tokenId, outcome } = payload;
      const orgId = organizationId as OrganizationId;

      log.info('Processing workflow advance job', {
        jobId: job.id,
        instanceId,
        nodeId,
      });

      const instance = await instanceRepository.findById(orgId, instanceId);

      if (instance === null) {
        throw new Error(`Workflow instance not found: ${instanceId}`);
      }

      const definition = await definitionRepository.findById(orgId, instance.definitionId);

      if (definition === null) {
        throw new Error(`Workflow definition not found: ${instance.definitionId}`);
      }

      const result = await container.workflow.runtimeEngine.advanceFromNode(
        orgId,
        instance,
        definition,
        nodeId,
        tokenId,
        outcome,
      );

      if (!result.ok) {
        throw new Error(result.error.message);
      }

      log.info('Workflow advance completed', {
        instanceId,
        status: result.value.status,
      });
    },
    { concurrency: 10 },
  );

  return {
    name: WORKER_NAME,
    async start(): Promise<void> {
      log.info('Registered workflow runtime processor', {
        queue: QUEUE_NAMES.DEFAULT,
        jobName: JOB_NAMES.WORKFLOW_INSTANCE_ADVANCE,
      });
    },
    async stop(): Promise<void> {
      log.info('Stopped workflow runtime worker');
    },
  };
}