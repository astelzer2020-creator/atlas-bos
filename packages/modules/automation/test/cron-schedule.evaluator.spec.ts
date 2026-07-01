import { describe, expect, it } from 'vitest';

import {
  evaluateCronSchedule,
  isAnyScheduleDue,
} from '../application/engine/cron-schedule.evaluator.js';

describe('evaluateCronSchedule', () => {
  it('returns isDue when cron tick is within the current minute window', () => {
    const evaluatedAt = new Date('2026-06-30T12:00:30.000Z');

    const result = evaluateCronSchedule({
      scheduleCron: '0 12 * * *',
      scheduleTimezone: 'UTC',
      evaluatedAt,
    });

    expect(result.isDue).toBe(true);
    expect(result.nextRunAt).not.toBeNull();
  });

  it('does not fire again when lastFiredAt covers the previous tick', () => {
    const evaluatedAt = new Date('2026-06-30T12:00:30.000Z');
    const lastFiredAt = new Date('2026-06-30T12:00:00.000Z');

    const result = evaluateCronSchedule({
      scheduleCron: '0 12 * * *',
      scheduleTimezone: 'UTC',
      evaluatedAt,
      lastFiredAt,
    });

    expect(result.isDue).toBe(false);
  });

  it('returns error for invalid cron expressions', () => {
    const result = evaluateCronSchedule({
      scheduleCron: 'not-a-cron',
      evaluatedAt: new Date('2026-06-30T12:00:00.000Z'),
    });

    expect(result.isDue).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('isAnyScheduleDue', () => {
  it('collects due trigger ids from a trigger list', () => {
    const evaluatedAt = new Date('2026-06-30T09:15:00.000Z');

    const { dueTriggerIds } = isAnyScheduleDue(
      [
        {
          id: 'trigger-1',
          scheduleCron: '15 9 * * *',
          scheduleTimezone: 'UTC',
        },
        {
          id: 'trigger-2',
          scheduleCron: '0 10 * * *',
          scheduleTimezone: 'UTC',
        },
      ],
      evaluatedAt,
      new Map(),
    );

    expect(dueTriggerIds).toEqual(['trigger-1']);
  });
});