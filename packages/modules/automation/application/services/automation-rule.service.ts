import {
  ConflictError,
  err,
  NotFoundError,
  ok,
  ValidationError,
  type OrganizationId,
  type Result,
  type UserId,
} from '@atlas/shared-kernel';

import type {
  AutomationActionRecord,
  AutomationRuleDetailRecord,
  AutomationRuleRecord,
  AutomationRuleRepository,
  AutomationRuleStatus,
  AutomationTriggerRecord,
  CreateAutomationActionData,
  CreateAutomationTriggerData,
} from '../../domain/repositories/automation-rule.repository.js';

export interface AutomationTriggerDto {
  readonly id: string;
  readonly trigger_order: number;
  readonly trigger_type: string;
  readonly event_type: string | null;
  readonly schedule_cron: string | null;
  readonly schedule_timezone: string | null;
  readonly webhook_path: string | null;
  readonly filter_expression: string | null;
  readonly filter_json: Record<string, unknown>;
  readonly is_active: boolean;
}

export interface AutomationActionDto {
  readonly id: string;
  readonly action_order: number;
  readonly action_type: string;
  readonly name: string;
  readonly config: Record<string, unknown>;
  readonly condition_expression: string | null;
  readonly on_failure: string;
  readonly timeout_seconds: number | null;
  readonly is_active: boolean;
}

export interface AutomationRuleDto {
  readonly id: string;
  readonly organization_id: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: AutomationRuleStatus;
  readonly rule_version: number;
  readonly owner_id: string | null;
  readonly max_executions_hour: number | null;
  readonly max_executions_day: number | null;
  readonly concurrency_limit: number | null;
  readonly retry_max_attempts: number | null;
  readonly retry_backoff: string | null;
  readonly dry_run_available: boolean;
  readonly last_executed_at: string | null;
  readonly execution_count: string;
  readonly tags: string[];
  readonly settings: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
  readonly updated_at: string;
  readonly version: number;
}

export interface AutomationRuleDetailDto extends AutomationRuleDto {
  readonly triggers: AutomationTriggerDto[];
  readonly actions: AutomationActionDto[];
}

export interface CreateAutomationRuleInput {
  readonly name: string;
  readonly description?: string;
  readonly triggers?: CreateAutomationTriggerData[];
  readonly actions?: CreateAutomationActionData[];
  readonly settings?: Record<string, unknown>;
  readonly tags?: string[];
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateAutomationRuleInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly triggers?: CreateAutomationTriggerData[];
  readonly actions?: CreateAutomationActionData[];
  readonly settings?: Record<string, unknown>;
  readonly tags?: string[];
  readonly metadata?: Record<string, unknown>;
  readonly expectedVersion: number;
}

export interface ListAutomationRulesInput {
  readonly status?: AutomationRuleStatus;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface AutomationRuleServiceDeps {
  readonly ruleRepository: AutomationRuleRepository;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

export class AutomationRuleService {
  constructor(private readonly deps: AutomationRuleServiceDeps) {}

  async create(
    organizationId: OrganizationId,
    input: CreateAutomationRuleInput,
    actorId?: UserId,
  ): Promise<Result<AutomationRuleDetailDto, ValidationError>> {
    const name = input.name.trim();
    if (name.length === 0) {
      return err(new ValidationError('Automation rule name is required', { field: 'name' }));
    }

    const actionValidation = this.validateActions(input.actions ?? []);
    if (!actionValidation.ok) {
      return actionValidation;
    }

    const rule = await this.deps.ruleRepository.create({
      organizationId,
      name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.triggers !== undefined ? { triggers: input.triggers } : {}),
      ...(input.actions !== undefined ? { actions: input.actions } : {}),
      ...(input.settings !== undefined ? { settings: input.settings } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(actorId !== undefined ? { createdBy: actorId } : {}),
    });

    return ok(this.toDetailDto(rule));
  }

  async update(
    organizationId: OrganizationId,
    ruleId: string,
    input: UpdateAutomationRuleInput,
    actorId?: UserId,
  ): Promise<Result<AutomationRuleDetailDto, ValidationError | NotFoundError | ConflictError>> {
    const existing = await this.deps.ruleRepository.findById(organizationId, ruleId);

    if (existing === null) {
      return err(new NotFoundError('AutomationRule', ruleId));
    }

    if (existing.status !== 'draft') {
      return err(
        new ConflictError('Only draft automation rules can be updated', {
          details: { status: existing.status },
        }),
      );
    }

    if (input.expectedVersion !== existing.version) {
      return err(
        new ConflictError('Automation rule version mismatch', {
          details: { expected: input.expectedVersion, actual: existing.version },
        }),
      );
    }

    if (input.name !== undefined && input.name.trim().length === 0) {
      return err(new ValidationError('Automation rule name cannot be empty', { field: 'name' }));
    }

    if (input.actions !== undefined) {
      const actionValidation = this.validateActions(input.actions);
      if (!actionValidation.ok) {
        return actionValidation;
      }
    }

    const updated = await this.deps.ruleRepository.update(
      organizationId,
      ruleId,
      {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.triggers !== undefined ? { triggers: input.triggers } : {}),
        ...(input.actions !== undefined ? { actions: input.actions } : {}),
        ...(input.settings !== undefined ? { settings: input.settings } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        ...(actorId !== undefined ? { updatedBy: actorId } : {}),
      },
      input.expectedVersion,
    );

    if (updated === null) {
      return err(
        new ConflictError('Automation rule was modified concurrently', {
          details: { id: ruleId, expectedVersion: input.expectedVersion },
        }),
      );
    }

    return ok(this.toDetailDto(updated));
  }

  async get(
    organizationId: OrganizationId,
    ruleId: string,
  ): Promise<Result<AutomationRuleDetailDto, NotFoundError>> {
    const rule = await this.deps.ruleRepository.findByIdWithDetails(organizationId, ruleId);

    if (rule === null) {
      return err(new NotFoundError('AutomationRule', ruleId));
    }

    return ok(this.toDetailDto(rule));
  }

  async list(
    organizationId: OrganizationId,
    input: ListAutomationRulesInput = {},
  ): Promise<{ data: AutomationRuleDto[]; next_cursor: string | null }> {
    const limit = Math.min(input.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);

    const rules = await this.deps.ruleRepository.list({
      organizationId,
      limit,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
    });

    return {
      data: rules.map((rule) => this.toDto(rule)),
      next_cursor: rules.length === limit ? (rules.at(-1)?.id ?? null) : null,
    };
  }

  async softDelete(
    organizationId: OrganizationId,
    ruleId: string,
    actorId?: UserId,
  ): Promise<Result<void, NotFoundError>> {
    const existing = await this.deps.ruleRepository.findById(organizationId, ruleId);

    if (existing === null) {
      return err(new NotFoundError('AutomationRule', ruleId));
    }

    const deleted = await this.deps.ruleRepository.softDelete(
      organizationId,
      ruleId,
      actorId,
    );

    if (!deleted) {
      return err(new NotFoundError('AutomationRule', ruleId));
    }

    return ok(undefined);
  }

  async enable(
    organizationId: OrganizationId,
    ruleId: string,
    actorId?: UserId,
  ): Promise<Result<AutomationRuleDto, NotFoundError | ConflictError>> {
    const existing = await this.deps.ruleRepository.findByIdWithDetails(organizationId, ruleId);

    if (existing === null) {
      return err(new NotFoundError('AutomationRule', ruleId));
    }

    if (existing.status === 'enabled') {
      return ok(this.toDto(existing));
    }

    if (existing.status !== 'draft' && existing.status !== 'disabled') {
      return err(
        new ConflictError('Only draft or disabled automation rules can be enabled', {
          details: { status: existing.status },
        }),
      );
    }

    if (existing.triggers.length === 0) {
      return err(
        new ConflictError('Automation rule must have at least one trigger before enabling', {
          details: { ruleId },
        }),
      );
    }

    if (existing.actions.length === 0) {
      return err(
        new ConflictError('Automation rule must have at least one action before enabling', {
          details: { ruleId },
        }),
      );
    }

    const enabled = await this.deps.ruleRepository.enable(organizationId, ruleId, actorId);

    if (enabled === null) {
      return err(new NotFoundError('AutomationRule', ruleId));
    }

    return ok(this.toDto(enabled));
  }

  async disable(
    organizationId: OrganizationId,
    ruleId: string,
    actorId?: UserId,
  ): Promise<Result<AutomationRuleDto, NotFoundError | ConflictError>> {
    const existing = await this.deps.ruleRepository.findById(organizationId, ruleId);

    if (existing === null) {
      return err(new NotFoundError('AutomationRule', ruleId));
    }

    if (existing.status === 'disabled') {
      return ok(this.toDto(existing));
    }

    if (existing.status !== 'enabled') {
      return err(
        new ConflictError('Only enabled automation rules can be disabled', {
          details: { status: existing.status },
        }),
      );
    }

    const disabled = await this.deps.ruleRepository.disable(organizationId, ruleId, actorId);

    if (disabled === null) {
      return err(new NotFoundError('AutomationRule', ruleId));
    }

    return ok(this.toDto(disabled));
  }

  private validateActions(
    actions: readonly CreateAutomationActionData[],
  ): Result<void, ValidationError> {
    for (const action of actions) {
      if (action.name.trim().length === 0) {
        return err(new ValidationError('Automation action name is required', { field: 'name' }));
      }
    }
    return ok(undefined);
  }

  toDto(record: AutomationRuleRecord): AutomationRuleDto {
    return {
      id: record.id,
      organization_id: record.organizationId,
      name: record.name,
      description: record.description,
      status: record.status,
      rule_version: record.ruleVersion,
      owner_id: record.ownerId,
      max_executions_hour: record.maxExecutionsHour,
      max_executions_day: record.maxExecutionsDay,
      concurrency_limit: record.concurrencyLimit,
      retry_max_attempts: record.retryMaxAttempts,
      retry_backoff: record.retryBackoff,
      dry_run_available: record.dryRunAvailable,
      last_executed_at: record.lastExecutedAt?.toISOString() ?? null,
      execution_count: record.executionCount.toString(),
      tags: record.tags,
      settings: record.settings,
      metadata: record.metadata,
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString(),
      version: record.version,
    };
  }

  toDetailDto(record: AutomationRuleDetailRecord): AutomationRuleDetailDto {
    return {
      ...this.toDto(record),
      triggers: record.triggers.map((trigger) => this.toTriggerDto(trigger)),
      actions: record.actions.map((action) => this.toActionDto(action)),
    };
  }

  private toTriggerDto(record: AutomationTriggerRecord): AutomationTriggerDto {
    return {
      id: record.id,
      trigger_order: record.triggerOrder,
      trigger_type: record.triggerType,
      event_type: record.eventType,
      schedule_cron: record.scheduleCron,
      schedule_timezone: record.scheduleTimezone,
      webhook_path: record.webhookPath,
      filter_expression: record.filterExpression,
      filter_json: record.filterJson,
      is_active: record.isActive,
    };
  }

  private toActionDto(record: AutomationActionRecord): AutomationActionDto {
    return {
      id: record.id,
      action_order: record.actionOrder,
      action_type: record.actionType,
      name: record.name,
      config: record.config,
      condition_expression: record.conditionExpression,
      on_failure: record.onFailure,
      timeout_seconds: record.timeoutSeconds,
      is_active: record.isActive,
    };
  }
}