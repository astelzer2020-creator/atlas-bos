import { CronExpressionParser } from 'cron-parser';

export interface CronScheduleEvaluationInput {
  readonly scheduleCron: string;
  readonly scheduleTimezone?: string;
  readonly evaluatedAt?: Date;
  readonly lastFiredAt?: Date | null;
}

export interface CronScheduleEvaluationResult {
  readonly isDue: boolean;
  readonly nextRunAt: Date | null;
  readonly error?: string;
}

function resolveTimezone(timezone: string | undefined): string {
  const trimmed = timezone?.trim();
  if (trimmed !== undefined && trimmed.length > 0) {
    return trimmed;
  }
  return 'UTC';
}

/**
 * Evaluates whether a cron schedule is due at the given instant.
 * Uses a sliding window: fires when the cron tick falls after lastFiredAt
 * and within the evaluation window (current minute).
 */
export function evaluateCronSchedule(
  input: CronScheduleEvaluationInput,
): CronScheduleEvaluationResult {
  const evaluatedAt = input.evaluatedAt ?? new Date();
  const timezone = resolveTimezone(input.scheduleTimezone);

  try {
    const probeDate = new Date(evaluatedAt.getTime() + 1_000);

    const interval = CronExpressionParser.parse(input.scheduleCron, {
      currentDate: probeDate,
      tz: timezone,
    });

    const previousTick = interval.prev().toDate();
    const nextRunAt = interval.next().toDate();

    if (input.lastFiredAt !== undefined && input.lastFiredAt !== null) {
      const isDue = previousTick.getTime() > input.lastFiredAt.getTime();
      return { isDue, nextRunAt };
    }

    const windowStart = new Date(evaluatedAt);
    windowStart.setSeconds(0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setMinutes(windowEnd.getMinutes() + 1);

    const isDue = previousTick >= windowStart && previousTick < windowEnd;

    return { isDue, nextRunAt };
  } catch (error) {
    return {
      isDue: false,
      nextRunAt: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Returns true when any schedule trigger in the list is due.
 */
export function isAnyScheduleDue(
  triggers: readonly {
    readonly id: string;
    readonly scheduleCron: string | null;
    readonly scheduleTimezone: string | null;
  }[],
  evaluatedAt: Date,
  lastFiredByTrigger: ReadonlyMap<string, Date>,
): { dueTriggerIds: string[]; errors: string[] } {
  const dueTriggerIds: string[] = [];
  const errors: string[] = [];

  for (const trigger of triggers) {
    if (trigger.scheduleCron === null) {
      continue;
    }

    const result = evaluateCronSchedule({
      scheduleCron: trigger.scheduleCron,
      ...(trigger.scheduleTimezone !== null
        ? { scheduleTimezone: trigger.scheduleTimezone }
        : {}),
      evaluatedAt,
      lastFiredAt: lastFiredByTrigger.get(trigger.id) ?? null,
    });

    if (result.error !== undefined) {
      errors.push(`Trigger ${trigger.id}: ${result.error}`);
      continue;
    }

    if (result.isDue) {
      dueTriggerIds.push(trigger.id);
    }
  }

  return { dueTriggerIds, errors };
}