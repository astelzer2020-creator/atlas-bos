import {
  ConflictError,
  err,
  NotFoundError,
  ok,
  type OrganizationId,
  type Result,
} from '@atlas/shared-kernel';

import type { ActionExecutionPorts } from '../ports/action-integration.ports.js';
import { executeActions, planActions } from '../engine/action-executors.js';
import { evaluateTriggers } from '../engine/trigger-evaluator.js';
import type { AutomationExecutionLogRepository } from '../../domain/repositories/automation-execution-log.repository.js';
import type { AutomationRuleRepository } from '../../domain/repositories/automation-rule.repository.js';

export interface PlannedActionDto {
  readonly action_type: string;
  readonly name: string;
  readonly config: Record<string, unknown>;
}

export interface AutomationDryRunResultDto {
  readonly matched: boolean;
  readonly actions_planned: PlannedActionDto[];
  readonly warnings: string[];
}

export interface AutomationExecuteResultDto {
  readonly execution_id: string;
  readonly matched: boolean;
  readonly status: string;
  readonly actions_executed: PlannedActionDto[];
}

export interface AutomationExecutorServiceDeps {
  readonly ruleRepository: AutomationRuleRepository;
  readonly executionLogRepository: AutomationExecutionLogRepository;
  readonly actionPorts?: ActionExecutionPorts;
}

export class AutomationExecutorService {
  constructor(private readonly deps: AutomationExecutorServiceDeps) {}

  async dryRun(
    organizationId: OrganizationId,
    ruleId: string,
    eventPayload: Record<string, unknown> = {},
  ): Promise<Result<AutomationDryRunResultDto, NotFoundError>> {
    const rule = await this.deps.ruleRepository.findByIdWithDetails(organizationId, ruleId);

    if (rule === null) {
      return err(new NotFoundError('AutomationRule', ruleId));
    }

    const evaluation = evaluateTriggers(rule.triggers, eventPayload);
    const actionsPlanned = evaluation.matched ? planActions(rule.actions) : [];

    return ok({
      matched: evaluation.matched,
      actions_planned: actionsPlanned,
      warnings: evaluation.warnings,
    });
  }

  async execute(
    organizationId: OrganizationId,
    ruleId: string,
    eventPayload: Record<string, unknown> = {},
    idempotencyKey?: string,
  ): Promise<
    Result<AutomationExecuteResultDto, NotFoundError | ConflictError>
  > {
    const rule = await this.deps.ruleRepository.findByIdWithDetails(organizationId, ruleId);

    if (rule === null) {
      return err(new NotFoundError('AutomationRule', ruleId));
    }

    if (rule.status !== 'enabled') {
      return err(
        new ConflictError('Only enabled automation rules can be executed', {
          details: { status: rule.status },
        }),
      );
    }

    const startedAt = Date.now();
    const evaluation = evaluateTriggers(rule.triggers, eventPayload);

    const matchedTriggerType = evaluation.matchedTriggerTypes[0];
    const log = await this.deps.executionLogRepository.create({
      organizationId,
      ruleId,
      status: 'started',
      ...(matchedTriggerType !== undefined ? { triggerType: matchedTriggerType } : {}),
      triggerPayload: eventPayload,
      ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
    });

    if (!evaluation.matched) {
      const durationMs = Date.now() - startedAt;
      await this.deps.executionLogRepository.update(organizationId, log.id, {
        status: 'skipped',
        durationMs,
        completedAt: new Date(),
        actionsExecuted: [],
      });

      return ok({
        execution_id: log.id,
        matched: false,
        status: 'skipped',
        actions_executed: [],
      });
    }

    const actionsExecuted = await executeActions(rule.actions, {
      organizationId,
      eventPayload,
      ...(this.deps.actionPorts !== undefined ? { ports: this.deps.actionPorts } : {}),
      ruleId,
      executionId: log.id,
    });
    const durationMs = Date.now() - startedAt;

    await this.deps.executionLogRepository.update(organizationId, log.id, {
      status: 'completed',
      actionsExecuted,
      durationMs,
      completedAt: new Date(),
    });

    await this.deps.ruleRepository.incrementExecutionCount(
      organizationId,
      ruleId,
      new Date(),
    );

    return ok({
      execution_id: log.id,
      matched: true,
      status: 'completed',
      actions_executed: actionsExecuted.map((action) => ({
        action_type: action.action_type,
        name: action.name,
        config: action.config,
      })),
    });
  }
}