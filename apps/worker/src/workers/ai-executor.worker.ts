import type { Prisma } from '@atlas/database';
import { JOB_NAMES, QUEUE_NAMES } from '@atlas/queue';
import type { OrganizationId } from '@atlas/shared-kernel';

import type { WorkerContainer } from '../di/container.js';
import type { WorkerProcessor } from './types.js';

const WORKER_NAME = 'ai-executor';

const EXECUTABLE_STATUSES = [
  'init',
  'planning',
  'executing',
  'review_pending',
  'awaiting_human',
] as const;

interface AgentRunExecutePayload {
  readonly organizationId: string;
  readonly runId: string;
}

export function createAiExecutorWorker(container: WorkerContainer): WorkerProcessor {
  const log = container.logger.child({ worker: WORKER_NAME });
  const executor = container.ai.agentExecutor;

  container.queueManager.registerProcessor(
    QUEUE_NAMES.AI,
    async (job) => {
      if (job.name !== JOB_NAMES.AGENT_RUN_EXECUTE) {
        return;
      }

      const payload = job.data.payload as unknown as AgentRunExecutePayload;
      const { organizationId, runId } = payload;
      const orgId = organizationId as OrganizationId;

      log.info('Processing agent run execute job', {
        jobId: job.id,
        runId,
        executor: executor.name,
      });

      const runResult = await container.ai.runService.getRunRecord(orgId, runId);

      if (!runResult.ok) {
        throw new Error(runResult.error.message);
      }

      const currentStatus = runResult.value.status;

      if (!EXECUTABLE_STATUSES.includes(currentStatus as (typeof EXECUTABLE_STATUSES)[number])) {
        log.info('Agent run already terminal; skipping execution', {
          runId,
          status: currentStatus,
        });
        return;
      }

      const execution = await executor.execute({
        organizationId: orgId,
        run: runResult.value,
      });

      const updated = await container.prisma.agentRun.updateMany({
        where: {
          id: runId,
          organizationId: orgId,
          status: { in: [...EXECUTABLE_STATUSES] },
        },
        data: {
          status: execution.status,
          resultSummary: execution.resultSummary,
          resultPayload: execution.resultPayload as Prisma.InputJsonValue,
          completedAt: new Date(),
          ...(execution.costCents !== undefined ? { costCents: execution.costCents } : {}),
          ...(execution.llmInputTokens !== undefined
            ? { llmInputTokens: execution.llmInputTokens }
            : {}),
          ...(execution.llmOutputTokens !== undefined
            ? { llmOutputTokens: execution.llmOutputTokens }
            : {}),
        },
      });

      if (updated.count === 0) {
        throw new Error(`Agent run could not be completed: ${runId}`);
      }

      log.info('Agent run completed', {
        runId,
        executor: executor.name,
        status: execution.status,
      });
    },
    { concurrency: 5 },
  );

  return {
    name: WORKER_NAME,
    async start(): Promise<void> {
      log.info('Registered AI executor processor', {
        queue: QUEUE_NAMES.AI,
        jobName: JOB_NAMES.AGENT_RUN_EXECUTE,
        executor: executor.name,
      });
    },
    async stop(): Promise<void> {
      log.info('Stopped AI executor worker');
    },
  };
}
