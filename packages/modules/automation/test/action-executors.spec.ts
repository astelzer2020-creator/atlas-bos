import type { OrganizationId } from '@atlas/shared-kernel';
import { describe, expect, it } from 'vitest';

import { evaluateCondition } from '../application/engine/condition-evaluator.js';
import { executeAction } from '../application/engine/action-executors.js';
import type { AutomationActionRecord } from '../domain/repositories/automation-rule.repository.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;

function createAction(
  actionType: AutomationActionRecord['actionType'],
  config: Record<string, unknown>,
): AutomationActionRecord {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    organizationId: ORG_ID,
    ruleId: '22222222-2222-4222-8222-222222222222',
    actionOrder: 0,
    actionType,
    name: 'Test action',
    config,
    conditionExpression: null,
    onFailure: 'stop',
    timeoutSeconds: null,
    isActive: true,
    metadata: {},
    createdAt: new Date('2026-06-30T08:00:00Z'),
    updatedAt: new Date('2026-06-30T08:00:00Z'),
    version: 1,
  };
}

describe('evaluateCondition', () => {
  it('matches when all condition fields equal payload values', () => {
    expect(
      evaluateCondition(
        { event_type: 'contact.created', status: 'active' },
        { event_type: 'contact.created', status: 'active' },
      ),
    ).toBe(true);
  });

  it('supports snake_case condition keys against camelCase payload', () => {
    expect(
      evaluateCondition(
        { entity_type: 'contact' },
        { entityType: 'contact' },
      ),
    ).toBe(true);
  });

  it('returns false when a condition field does not match', () => {
    expect(
      evaluateCondition(
        { event_type: 'contact.created' },
        { event_type: 'contact.updated' },
      ),
    ).toBe(false);
  });
});

describe('executeAction entity and branch handlers', () => {
  it('evaluates condition_branch against the event payload', async () => {
    const result = await executeAction(
      createAction('condition_branch', {
        condition: { event_type: 'deal.won' },
      }),
      {
        organizationId: ORG_ID,
        eventPayload: { event_type: 'deal.won' },
      },
    );

    expect(result.status).toBe('success');
    expect(result.result?.branch_matched).toBe(true);
  });

  it('validates create_entity config and reports dry-run when port is absent', async () => {
    const result = await executeAction(
      createAction('create_entity', {
        entity_type: 'contact',
        fields: { display_name: 'Ada Lovelace' },
      }),
      {
        organizationId: ORG_ID,
        eventPayload: {},
      },
    );

    expect(result.status).toBe('success');
    expect(result.result?.created).toBe(false);
  });

  it('fails tag_entity when tags are missing', async () => {
    const result = await executeAction(
      createAction('tag_entity', {
        entity_type: 'contact',
        entity_id: '33333333-3333-4333-8333-333333333333',
      }),
      {
        organizationId: ORG_ID,
        eventPayload: {},
      },
    );

    expect(result.status).toBe('failed');
  });
});