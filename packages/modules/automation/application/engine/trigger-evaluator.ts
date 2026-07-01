import type { AutomationTriggerRecord } from '../../domain/repositories/automation-rule.repository.js';
import { evaluateCronSchedule } from './cron-schedule.evaluator.js';

export interface TriggerEvaluationResult {
  readonly matched: boolean;
  readonly matchedTriggerTypes: string[];
  readonly warnings: string[];
}

function payloadMatchesFilterJson(
  payload: Record<string, unknown>,
  filterJson: Record<string, unknown>,
): boolean {
  return Object.entries(filterJson).every(([key, expected]) => payload[key] === expected);
}

function evaluateTrigger(
  trigger: AutomationTriggerRecord,
  payload: Record<string, unknown>,
): { matched: boolean; warning?: string } {
  if (!trigger.isActive) {
    return { matched: false };
  }

  switch (trigger.triggerType) {
    case 'event': {
      const eventType = payload.event_type ?? payload.eventType;
      if (typeof eventType !== 'string') {
        return { matched: false };
      }
      if (trigger.eventType !== null && trigger.eventType !== eventType) {
        return { matched: false };
      }
      if (!payloadMatchesFilterJson(payload, trigger.filterJson)) {
        return { matched: false };
      }
      return { matched: true };
    }

    case 'entity_change': {
      const entityType = payload.entity_type ?? payload.entityType;
      if (typeof entityType !== 'string') {
        return { matched: false };
      }
      const filterEntityType = trigger.filterJson.entity_type ?? trigger.filterJson.entityType;
      if (filterEntityType !== undefined && filterEntityType !== entityType) {
        return { matched: false };
      }
      if (!payloadMatchesFilterJson(payload, trigger.filterJson)) {
        return { matched: false };
      }
      return { matched: true };
    }

    case 'manual': {
      const triggerType = payload.trigger_type ?? payload.triggerType;
      if (triggerType !== undefined && triggerType !== 'manual') {
        return { matched: false };
      }
      return { matched: true };
    }

    case 'webhook': {
      const webhookPath = payload.webhook_path ?? payload.webhookPath;
      if (typeof webhookPath !== 'string') {
        return { matched: false };
      }
      if (trigger.webhookPath !== null && trigger.webhookPath !== webhookPath) {
        return { matched: false };
      }
      return { matched: true };
    }

    case 'schedule': {
      if (payload.force_schedule === true || payload.simulate_schedule === true) {
        return { matched: true };
      }

      if (trigger.scheduleCron === null) {
        return { matched: false, warning: `Schedule trigger "${trigger.id}" has no cron expression` };
      }

      const evaluatedAt =
        payload.evaluated_at instanceof Date
          ? payload.evaluated_at
          : typeof payload.evaluated_at === 'string'
            ? new Date(payload.evaluated_at)
            : new Date();

      const lastFiredAt =
        payload.last_fired_at instanceof Date
          ? payload.last_fired_at
          : typeof payload.last_fired_at === 'string'
            ? new Date(payload.last_fired_at)
            : null;

      const cronResult = evaluateCronSchedule({
        scheduleCron: trigger.scheduleCron,
        ...(trigger.scheduleTimezone !== null
          ? { scheduleTimezone: trigger.scheduleTimezone }
          : {}),
        evaluatedAt,
        lastFiredAt,
      });

      if (cronResult.error !== undefined) {
        return {
          matched: false,
          warning: `Schedule trigger "${trigger.id}": ${cronResult.error}`,
        };
      }

      return { matched: cronResult.isDue };
    }

    default:
      return { matched: false };
  }
}

export function evaluateTriggers(
  triggers: readonly AutomationTriggerRecord[],
  eventPayload: Record<string, unknown>,
): TriggerEvaluationResult {
  const warnings: string[] = [];
  const matchedTriggerTypes: string[] = [];

  const activeTriggers = triggers.filter((trigger) => trigger.isActive);

  if (activeTriggers.length === 0) {
    return { matched: false, matchedTriggerTypes, warnings };
  }

  for (const trigger of activeTriggers) {
    const result = evaluateTrigger(trigger, eventPayload);
    if (result.warning !== undefined) {
      warnings.push(result.warning);
    }
    if (result.matched) {
      matchedTriggerTypes.push(trigger.triggerType);
    }
  }

  return {
    matched: matchedTriggerTypes.length > 0,
    matchedTriggerTypes,
    warnings,
  };
}