import type { CloudEvent } from '@atlas/event-bus';
import type { OrganizationId } from '@atlas/shared-kernel';

import type { WorkerContainer } from '../di/container.js';
import type { WorkerProcessor } from './types.js';

const WORKER_NAME = 'automation-matcher';

export function createAutomationMatcherWorker(container: WorkerContainer): WorkerProcessor {
  const log = container.logger.child({ worker: WORKER_NAME });

  const handleEvent = async (event: CloudEvent): Promise<void> => {
    const organizationId = event.data.organizationId as OrganizationId;

    const rules = await container.prisma.automationRule.findMany({
      where: {
        organizationId,
        status: 'enabled',
        deletedAt: null,
        triggers: {
          some: {
            isActive: true,
            deletedAt: null,
            triggerType: { in: ['event', 'entity_change'] },
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (rules.length === 0) {
      return;
    }

    const eventPayload: Record<string, unknown> = {
      event_type: event.type,
      eventType: event.type,
      aggregate_type: event.data.aggregate.type,
      aggregateType: event.data.aggregate.type,
      aggregate_id: event.data.aggregate.id,
      aggregateId: event.data.aggregate.id,
      ...event.data.payload,
    };

    for (const rule of rules) {
      const dryRun = await container.automation.executorService.dryRun(
        organizationId,
        rule.id,
        eventPayload,
      );

      if (!dryRun.ok || !dryRun.value.matched) {
        continue;
      }

      log.info('Automation rule matched domain event', {
        ruleId: rule.id,
        eventType: event.type,
        organizationId,
      });

      const idempotencyKey = `automation:${rule.id}:${event.id}`;

      const executeResult = await container.automation.executorService.execute(
        organizationId,
        rule.id,
        eventPayload,
        idempotencyKey,
      );

      if (!executeResult.ok) {
        log.warn('Automation execution failed', {
          ruleId: rule.id,
          error: executeResult.error.message,
        });
      }
    }
  };

  return {
    name: WORKER_NAME,
    async start(): Promise<void> {
      if (container.kafkaConsumer === null) {
        log.warn('Kafka consumer unavailable; automation matcher running in mock mode');
        return;
      }

      log.info('Starting automation matcher consumer', {
        groupId: container.config.kafkaGroupId,
      });

      container.kafkaConsumer.onMessage(handleEvent);
      await container.kafkaConsumer.connect();
      await container.kafkaConsumer.subscribe([/^atlas\..+/]);
    },
    async stop(): Promise<void> {
      if (container.kafkaConsumer !== null) {
        await container.kafkaConsumer.disconnect();
      }
      log.info('Stopped automation matcher worker');
    },
  };
}