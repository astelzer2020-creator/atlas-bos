import {
  ConflictError,
  NotFoundError,
  type OrganizationId,
} from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import { AutomationExecutorService } from '../application/services/automation-executor.service.js';
import type {
  AutomationExecutionLogRecord,
  AutomationExecutionLogRepository,
} from '../domain/repositories/automation-execution-log.repository.js';
import type {
  AutomationRuleDetailRecord,
  AutomationRuleRepository,
} from '../domain/repositories/automation-rule.repository.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;
const RULE_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const EXECUTION_ID = '33333333-3333-4333-8333-333333333333';

function createTrigger(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    organizationId: ORG_ID,
    ruleId: RULE_ID,
    triggerOrder: 0,
    triggerType: 'event' as const,
    eventType: 'contact.created',
    scheduleCron: null,
    scheduleTimezone: 'UTC',
    webhookPath: null,
    filterExpression: null,
    filterJson: {},
    isActive: true,
    metadata: {},
    createdAt: new Date('2026-06-30T08:00:00Z'),
    updatedAt: new Date('2026-06-30T08:00:00Z'),
    version: 1,
    ...overrides,
  };
}

function createAction(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    organizationId: ORG_ID,
    ruleId: RULE_ID,
    actionOrder: 0,
    actionType: 'send_notification' as const,
    name: 'Notify owner',
    config: {
      recipient_user_id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Automation notification',
    },
    conditionExpression: null,
    onFailure: 'stop' as const,
    timeoutSeconds: null,
    isActive: true,
    metadata: {},
    createdAt: new Date('2026-06-30T08:00:00Z'),
    updatedAt: new Date('2026-06-30T08:00:00Z'),
    version: 1,
    ...overrides,
  };
}

function createRuleDetail(
  overrides: Partial<AutomationRuleDetailRecord> = {},
): AutomationRuleDetailRecord {
  return {
    id: RULE_ID,
    organizationId: ORG_ID,
    name: 'Notify on new contact',
    description: null,
    status: 'enabled',
    ruleVersion: 1,
    ownerId: null,
    maxExecutionsHour: null,
    maxExecutionsDay: null,
    concurrencyLimit: null,
    retryMaxAttempts: null,
    retryBackoff: 'exponential',
    dryRunAvailable: true,
    lastExecutedAt: null,
    executionCount: 0n,
    tags: [],
    settings: {},
    metadata: {},
    createdAt: new Date('2026-06-30T08:00:00Z'),
    updatedAt: new Date('2026-06-30T08:00:00Z'),
    version: 1,
    triggers: [createTrigger()],
    actions: [createAction()],
    ...overrides,
  };
}

function createExecutionLog(
  overrides: Partial<AutomationExecutionLogRecord> = {},
): AutomationExecutionLogRecord {
  return {
    id: EXECUTION_ID,
    organizationId: ORG_ID,
    ruleId: RULE_ID,
    status: 'started',
    triggerType: 'event',
    triggerPayload: {},
    actionsExecuted: [],
    errorMessage: null,
    durationMs: null,
    idempotencyKey: null,
    startedAt: new Date('2026-06-30T08:00:00Z'),
    completedAt: null,
    metadata: {},
    createdAt: new Date('2026-06-30T08:00:00Z'),
    ...overrides,
  };
}

function createExecutorService(
  ruleRepository: Partial<AutomationRuleRepository> = {},
  executionLogRepository: Partial<AutomationExecutionLogRepository> = {},
) {
  const rules: AutomationRuleRepository = {
    findById: vi.fn().mockResolvedValue(null),
    findByIdWithDetails: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    list: vi.fn(),
    incrementExecutionCount: vi.fn().mockResolvedValue(undefined),
    ...ruleRepository,
  };

  const logs: AutomationExecutionLogRepository = {
    create: vi.fn().mockResolvedValue(createExecutionLog()),
    update: vi.fn().mockResolvedValue(createExecutionLog({ status: 'completed' })),
    findById: vi.fn().mockResolvedValue(null),
    ...executionLogRepository,
  };

  return {
    service: new AutomationExecutorService({
      ruleRepository: rules,
      executionLogRepository: logs,
    }),
    ruleRepository: rules,
    executionLogRepository: logs,
  };
}

describe('AutomationExecutorService', () => {
  it('dryRun returns matched=true when event trigger matches payload', async () => {
    const { service } = createExecutorService({
      findByIdWithDetails: vi.fn().mockResolvedValue(createRuleDetail()),
    });

    const result = await service.dryRun(ORG_ID, RULE_ID, {
      event_type: 'contact.created',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.matched).toBe(true);
      expect(result.value.actions_planned).toHaveLength(1);
      expect(result.value.actions_planned[0]?.action_type).toBe('send_notification');
    }
  });

  it('dryRun returns matched=false when event type does not match', async () => {
    const { service } = createExecutorService({
      findByIdWithDetails: vi.fn().mockResolvedValue(createRuleDetail()),
    });

    const result = await service.dryRun(ORG_ID, RULE_ID, {
      event_type: 'contact.updated',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.matched).toBe(false);
      expect(result.value.actions_planned).toHaveLength(0);
    }
  });

  it('dryRun returns not found for missing rule', async () => {
    const { service } = createExecutorService();

    const result = await service.dryRun(ORG_ID, RULE_ID, { event_type: 'contact.created' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it('dryRun does not match schedule triggers without simulate flag when not due', async () => {
    const { service } = createExecutorService({
      findByIdWithDetails: vi.fn().mockResolvedValue(
        createRuleDetail({
          triggers: [createTrigger({ triggerType: 'schedule', eventType: null, scheduleCron: '0 * * * *' })],
        }),
      ),
    });

    const result = await service.dryRun(ORG_ID, RULE_ID, {});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.matched).toBe(false);
    }
  });

  it('dryRun matches manual trigger by default', async () => {
    const { service } = createExecutorService({
      findByIdWithDetails: vi.fn().mockResolvedValue(
        createRuleDetail({
          triggers: [createTrigger({ triggerType: 'manual', eventType: null })],
        }),
      ),
    });

    const result = await service.dryRun(ORG_ID, RULE_ID, { trigger_type: 'manual' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.matched).toBe(true);
    }
  });

  it('dryRun plans only active actions in order', async () => {
    const { service } = createExecutorService({
      findByIdWithDetails: vi.fn().mockResolvedValue(
        createRuleDetail({
          actions: [
            createAction({ id: 'a1', actionOrder: 1, actionType: 'delay', name: 'Wait' }),
            createAction({
              id: 'a2',
              actionOrder: 0,
              actionType: 'send_email',
              name: 'Send email',
              isActive: false,
            }),
            createAction({ id: 'a3', actionOrder: 2, actionType: 'webhook_call', name: 'Webhook' }),
          ],
        }),
      ),
    });

    const result = await service.dryRun(ORG_ID, RULE_ID, { event_type: 'contact.created' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.actions_planned.map((action) => action.name)).toEqual(['Wait', 'Webhook']);
    }
  });

  it('execute rejects non-enabled rules', async () => {
    const { service } = createExecutorService({
      findByIdWithDetails: vi.fn().mockResolvedValue(createRuleDetail({ status: 'draft' })),
    });

    const result = await service.execute(ORG_ID, RULE_ID, { event_type: 'contact.created' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });

  it('execute skips when triggers do not match', async () => {
    const { service, executionLogRepository } = createExecutorService({
      findByIdWithDetails: vi.fn().mockResolvedValue(createRuleDetail()),
    });

    const result = await service.execute(ORG_ID, RULE_ID, { event_type: 'contact.updated' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.matched).toBe(false);
      expect(result.value.status).toBe('skipped');
      expect(result.value.actions_executed).toHaveLength(0);
    }

    expect(executionLogRepository.update).toHaveBeenCalledWith(
      ORG_ID,
      EXECUTION_ID,
      expect.objectContaining({ status: 'skipped' }),
    );
  });

  it('execute runs action handlers and logs completed execution', async () => {
    const { service, executionLogRepository, ruleRepository } = createExecutorService({
      findByIdWithDetails: vi.fn().mockResolvedValue(
        createRuleDetail({
          actions: [
            createAction({
              actionOrder: 0,
              actionType: 'send_notification',
              name: 'Notify',
              config: {
                recipient_user_id: '550e8400-e29b-41d4-a716-446655440000',
                title: 'Notify',
              },
            }),
            createAction({
              id: 'a2',
              actionOrder: 1,
              actionType: 'send_email',
              name: 'Email',
              config: { to: 'user@example.com', subject: 'Hello', body: 'Test' },
            }),
            createAction({
              id: 'a3',
              actionOrder: 2,
              actionType: 'update_entity',
              name: 'Update',
              config: {
                entity_type: 'contact',
                entity_id: '11111111-1111-4111-8111-111111111111',
                fields: { status: 'active' },
              },
            }),
            createAction({
              id: 'a4',
              actionOrder: 3,
              actionType: 'webhook_call',
              name: 'Webhook',
              config: { url: 'https://example.com/hook', method: 'POST' },
            }),
            createAction({
              id: 'a5',
              actionOrder: 4,
              actionType: 'start_workflow',
              name: 'Workflow',
              config: { workflow_definition_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
            }),
            createAction({
              id: 'a6',
              actionOrder: 5,
              actionType: 'delay',
              name: 'Delay',
              config: { duration_ms: 0 },
            }),
          ],
        }),
      ),
    });

    const result = await service.execute(ORG_ID, RULE_ID, { event_type: 'contact.created' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.matched).toBe(true);
      expect(result.value.status).toBe('completed');
      expect(result.value.actions_executed).toHaveLength(6);
    }

    expect(executionLogRepository.create).toHaveBeenCalled();
    expect(executionLogRepository.update).toHaveBeenCalledWith(
      ORG_ID,
      EXECUTION_ID,
      expect.objectContaining({
        status: 'completed',
        actionsExecuted: expect.arrayContaining([
          expect.objectContaining({ action_type: 'send_notification', status: 'success' }),
          expect.objectContaining({ action_type: 'delay', status: 'success' }),
        ]),
      }),
    );
    expect(ruleRepository.incrementExecutionCount).toHaveBeenCalledWith(
      ORG_ID,
      RULE_ID,
      expect.any(Date),
    );
  });

  it('execute returns not found for missing rule', async () => {
    const { service } = createExecutorService();

    const result = await service.execute(ORG_ID, RULE_ID, { event_type: 'contact.created' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it('execute matches webhook trigger by path', async () => {
    const { service } = createExecutorService({
      findByIdWithDetails: vi.fn().mockResolvedValue(
        createRuleDetail({
          triggers: [
            createTrigger({
              triggerType: 'webhook',
              eventType: null,
              webhookPath: '/hooks/inbound',
            }),
          ],
        }),
      ),
    });

    const result = await service.execute(ORG_ID, RULE_ID, { webhook_path: '/hooks/inbound' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.matched).toBe(true);
    }
  });

  it('execute stores idempotency key on execution log', async () => {
    const { service, executionLogRepository } = createExecutorService({
      findByIdWithDetails: vi.fn().mockResolvedValue(createRuleDetail()),
    });

    await service.execute(
      ORG_ID,
      RULE_ID,
      { event_type: 'contact.created' },
      '99999999-9999-4999-8999-999999999999',
    );

    expect(executionLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: '99999999-9999-4999-8999-999999999999',
      }),
    );
  });
});