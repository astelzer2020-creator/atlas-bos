import { isAnyScheduleDue } from '@atlas/module-automation';
import type { OrganizationId } from '@atlas/shared-kernel';
import { Redis } from 'ioredis';

import type { WorkerContainer } from '../di/container.js';
import type { WorkerProcessor } from './types.js';

const WORKER_NAME = 'scheduled-jobs';
const SCHEDULE_FIRED_KEY_PREFIX = 'atlas:schedule:last-fired:';

function scheduleFiredKey(triggerId: string): string {
  return `${SCHEDULE_FIRED_KEY_PREFIX}${triggerId}`;
}

export function createScheduledJobsWorker(container: WorkerContainer): WorkerProcessor {
  const log = container.logger.child({ worker: WORKER_NAME });
  let interval: ReturnType<typeof setInterval> | null = null;
  let checking = false;
  const redis = new Redis(container.config.redisUrl);

  const loadLastFiredMap = async (
    triggerIds: readonly string[],
  ): Promise<Map<string, Date>> => {
    const map = new Map<string, Date>();

    if (triggerIds.length === 0) {
      return map;
    }

    const keys = triggerIds.map(scheduleFiredKey);
    const values = await redis.mget(...keys);

    for (let index = 0; index < triggerIds.length; index += 1) {
      const raw = values[index];
      if (raw !== null && raw !== undefined) {
        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) {
          map.set(triggerIds[index]!, parsed);
        }
      }
    }

    return map;
  };

  const markTriggerFired = async (triggerId: string, firedAt: Date): Promise<void> => {
    await redis.set(scheduleFiredKey(triggerId), firedAt.toISOString(), 'EX', 60 * 60 * 24 * 30);
  };

  const checkSchedules = async (): Promise<void> => {
    if (checking) {
      return;
    }

    checking = true;
    const evaluatedAt = new Date();

    try {
      const scheduleTriggers = await container.prisma.automationTrigger.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          triggerType: 'schedule',
          scheduleCron: { not: null },
          rule: {
            status: 'enabled',
            deletedAt: null,
          },
        },
        select: {
          id: true,
          ruleId: true,
          organizationId: true,
          scheduleCron: true,
          scheduleTimezone: true,
        },
      });

      if (scheduleTriggers.length === 0) {
        return;
      }

      const lastFiredByTrigger = await loadLastFiredMap(
        scheduleTriggers.map((trigger) => trigger.id),
      );

      const { dueTriggerIds, errors } = isAnyScheduleDue(
        scheduleTriggers,
        evaluatedAt,
        lastFiredByTrigger,
      );

      for (const error of errors) {
        log.warn('Schedule evaluation error', { error });
      }

      if (dueTriggerIds.length === 0) {
        log.debug('No schedule triggers due', {
          checked: scheduleTriggers.length,
          evaluatedAt: evaluatedAt.toISOString(),
        });
        return;
      }

      const dueTriggers = scheduleTriggers.filter((trigger) =>
        dueTriggerIds.includes(trigger.id),
      );

      log.info('Executing due schedule triggers', {
        dueCount: dueTriggers.length,
        evaluatedAt: evaluatedAt.toISOString(),
      });

      for (const trigger of dueTriggers) {
        const organizationId = trigger.organizationId as OrganizationId;
        const eventPayload: Record<string, unknown> = {
          trigger_type: 'schedule',
          triggerType: 'schedule',
          evaluated_at: evaluatedAt.toISOString(),
          schedule_cron: trigger.scheduleCron,
          schedule_timezone: trigger.scheduleTimezone,
        };

        const idempotencyKey = `schedule:${trigger.id}:${evaluatedAt.toISOString().slice(0, 16)}`;

        const executeResult = await container.automation.executorService.execute(
          organizationId,
          trigger.ruleId,
          eventPayload,
          idempotencyKey,
        );

        if (!executeResult.ok) {
          log.warn('Scheduled automation execution failed', {
            triggerId: trigger.id,
            ruleId: trigger.ruleId,
            error: executeResult.error.message,
          });
          continue;
        }

        await markTriggerFired(trigger.id, evaluatedAt);

        log.info('Scheduled automation executed', {
          triggerId: trigger.id,
          ruleId: trigger.ruleId,
          executionId: executeResult.value.execution_id,
          status: executeResult.value.status,
        });
      }
    } catch (error) {
      log.error('Scheduled jobs check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      checking = false;
    }
  };

  return {
    name: WORKER_NAME,
    async start(): Promise<void> {
      log.info('Starting scheduled jobs worker', {
        intervalMs: container.config.scheduledJobsIntervalMs,
      });

      await checkSchedules();
      interval = setInterval(() => {
        void checkSchedules();
      }, container.config.scheduledJobsIntervalMs);
    },
    async stop(): Promise<void> {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
      await redis.quit();
      log.info('Stopped scheduled jobs worker');
    },
  };
}