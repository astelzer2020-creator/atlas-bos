import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type OrganizationId,
  type UserId,
} from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import { AutomationRuleService } from '../application/services/automation-rule.service.js';
import type {
  AutomationRuleDetailRecord,
  AutomationRuleRecord,
  AutomationRuleRepository,
} from '../domain/repositories/automation-rule.repository.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;
const USER_ID = '550e8400-e29b-41d4-a716-446655440000' as UserId;
const RULE_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

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

function createAction(overrides: Record<string, unknown> = {}) {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    organizationId: ORG_ID,
    ruleId: RULE_ID,
    actionOrder: 0,
    actionType: 'send_notification' as const,
    name: 'Notify owner',
    config: { channel: 'in_app' },
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

function createRuleRecord(
  overrides: Partial<AutomationRuleRecord> = {},
): AutomationRuleRecord {
  return {
    id: RULE_ID,
    organizationId: ORG_ID,
    name: 'Notify on new contact',
    description: null,
    status: 'draft',
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
    ...overrides,
  };
}

function createRuleDetailRecord(
  overrides: Partial<AutomationRuleDetailRecord> = {},
): AutomationRuleDetailRecord {
  return {
    ...createRuleRecord(),
    triggers: [createTrigger()],
    actions: [createAction()],
    ...overrides,
  };
}

function createRuleService(repository: Partial<AutomationRuleRepository> = {}) {
  const ruleRepository: AutomationRuleRepository = {
    findById: vi.fn().mockResolvedValue(null),
    findByIdWithDetails: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(createRuleDetailRecord()),
    update: vi.fn().mockResolvedValue(createRuleDetailRecord({ version: 2 })),
    softDelete: vi.fn().mockResolvedValue(true),
    enable: vi.fn().mockResolvedValue(createRuleRecord({ status: 'enabled', version: 2 })),
    disable: vi.fn().mockResolvedValue(createRuleRecord({ status: 'disabled', version: 2 })),
    list: vi.fn().mockResolvedValue([createRuleRecord()]),
    incrementExecutionCount: vi.fn().mockResolvedValue(undefined),
    ...repository,
  };

  return {
    service: new AutomationRuleService({ ruleRepository }),
    ruleRepository,
  };
}

describe('AutomationRuleService', () => {
  it('create persists rule with triggers and actions', async () => {
    const { service, ruleRepository } = createRuleService();

    const result = await service.create(
      ORG_ID,
      {
        name: 'Notify on new contact',
        triggers: [{ triggerType: 'event', eventType: 'contact.created' }],
        actions: [{ actionOrder: 0, actionType: 'send_notification', name: 'Notify owner' }],
      },
      USER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('draft');
      expect(result.value.triggers).toHaveLength(1);
      expect(result.value.actions).toHaveLength(1);
    }

    expect(ruleRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        name: 'Notify on new contact',
        createdBy: USER_ID,
      }),
    );
  });

  it('create rejects empty name', async () => {
    const { service } = createRuleService();

    const result = await service.create(ORG_ID, { name: '   ' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('create rejects action with empty name', async () => {
    const { service } = createRuleService();

    const result = await service.create(ORG_ID, {
      name: 'Valid rule',
      actions: [{ actionOrder: 0, actionType: 'send_email', name: '   ' }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('update rejects non-draft rules', async () => {
    const { service } = createRuleService({
      findById: vi.fn().mockResolvedValue(createRuleRecord({ status: 'enabled' })),
    });

    const result = await service.update(
      ORG_ID,
      RULE_ID,
      { name: 'Updated', expectedVersion: 1 },
      USER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });

  it('update enforces optimistic version check', async () => {
    const { service } = createRuleService({
      findById: vi.fn().mockResolvedValue(createRuleRecord({ version: 2 })),
    });

    const result = await service.update(
      ORG_ID,
      RULE_ID,
      { name: 'Updated', expectedVersion: 1 },
      USER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });

  it('update returns conflict when repository update fails', async () => {
    const { service } = createRuleService({
      findById: vi.fn().mockResolvedValue(createRuleRecord()),
      update: vi.fn().mockResolvedValue(null),
    });

    const result = await service.update(
      ORG_ID,
      RULE_ID,
      { name: 'Updated', expectedVersion: 1 },
      USER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });

  it('get returns rule detail with triggers and actions', async () => {
    const { service } = createRuleService({
      findByIdWithDetails: vi.fn().mockResolvedValue(createRuleDetailRecord()),
    });

    const result = await service.get(ORG_ID, RULE_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe(RULE_ID);
      expect(result.value.triggers[0]?.trigger_type).toBe('event');
      expect(result.value.actions[0]?.action_type).toBe('send_notification');
    }
  });

  it('get returns not found for missing rule', async () => {
    const { service } = createRuleService();

    const result = await service.get(ORG_ID, RULE_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it('list returns paginated snake_case DTOs', async () => {
    const { service } = createRuleService({
      list: vi.fn().mockResolvedValue([createRuleRecord(), createRuleRecord({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })]),
    });

    const result = await service.list(ORG_ID, { limit: 2 });

    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.organization_id).toBe(ORG_ID);
    expect(result.next_cursor).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  });

  it('softDelete returns not found when rule is missing', async () => {
    const { service } = createRuleService();

    const result = await service.softDelete(ORG_ID, RULE_ID, USER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it('enable requires at least one trigger and action', async () => {
    const { service } = createRuleService({
      findByIdWithDetails: vi.fn().mockResolvedValue(
        createRuleDetailRecord({ triggers: [], actions: [] }),
      ),
    });

    const result = await service.enable(ORG_ID, RULE_ID, USER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });

  it('enable rejects archived rules', async () => {
    const { service } = createRuleService({
      findByIdWithDetails: vi.fn().mockResolvedValue(
        createRuleDetailRecord({ status: 'archived' }),
      ),
    });

    const result = await service.enable(ORG_ID, RULE_ID, USER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });

  it('disable rejects non-enabled rules', async () => {
    const { service } = createRuleService({
      findById: vi.fn().mockResolvedValue(createRuleRecord({ status: 'draft' })),
    });

    const result = await service.disable(ORG_ID, RULE_ID, USER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });

  it('enable succeeds for draft rule with triggers and actions', async () => {
    const { service, ruleRepository } = createRuleService({
      findByIdWithDetails: vi.fn().mockResolvedValue(createRuleDetailRecord()),
    });

    const result = await service.enable(ORG_ID, RULE_ID, USER_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('enabled');
    }
    expect(ruleRepository.enable).toHaveBeenCalledWith(ORG_ID, RULE_ID, USER_ID);
  });
});