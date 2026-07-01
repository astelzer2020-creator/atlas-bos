import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';

import type {
  AutomationActionRecord,
  AutomationRuleDetailRecord,
  AutomationRuleRecord,
  AutomationRuleRepository,
  AutomationRuleStatus,
  AutomationTriggerRecord,
  CreateAutomationRuleData,
  ListAutomationRulesFilter,
  UpdateAutomationRuleData,
} from '../../domain/repositories/automation-rule.repository.js';

function toJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class PrismaAutomationRuleRepository implements AutomationRuleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(
    organizationId: OrganizationId,
    id: string,
  ): Promise<AutomationRuleRecord | null> {
    const record = await this.prisma.automationRule.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    return record === null ? null : this.toRuleRecord(record);
  }

  async findByIdWithDetails(
    organizationId: OrganizationId,
    id: string,
  ): Promise<AutomationRuleDetailRecord | null> {
    const record = await this.prisma.automationRule.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      include: {
        triggers: {
          where: { deletedAt: null },
          orderBy: { triggerOrder: 'asc' },
        },
        actions: {
          where: { deletedAt: null },
          orderBy: { actionOrder: 'asc' },
        },
      },
    });

    if (record === null) {
      return null;
    }

    return {
      ...this.toRuleRecord(record),
      triggers: record.triggers.map((trigger) => this.toTriggerRecord(trigger)),
      actions: record.actions.map((action) => this.toActionRecord(action)),
    };
  }

  async create(data: CreateAutomationRuleData): Promise<AutomationRuleDetailRecord> {
    const record = await this.prisma.$transaction(async (tx) => {
      const rule = await tx.automationRule.create({
        data: {
          organizationId: data.organizationId,
          name: data.name,
          status: 'draft',
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.settings !== undefined ? { settings: toJsonValue(data.settings) } : {}),
          ...(data.tags !== undefined ? { tags: data.tags } : {}),
          ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
          ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
        },
      });

      const triggers = await Promise.all(
        (data.triggers ?? []).map((trigger, index) =>
          tx.automationTrigger.create({
            data: {
              organizationId: data.organizationId,
              ruleId: rule.id,
              triggerOrder: trigger.triggerOrder ?? index,
              triggerType: trigger.triggerType,
              ...(trigger.eventType !== undefined ? { eventType: trigger.eventType } : {}),
              ...(trigger.scheduleCron !== undefined ? { scheduleCron: trigger.scheduleCron } : {}),
              ...(trigger.scheduleTimezone !== undefined
                ? { scheduleTimezone: trigger.scheduleTimezone }
                : {}),
              ...(trigger.webhookPath !== undefined ? { webhookPath: trigger.webhookPath } : {}),
              ...(trigger.filterExpression !== undefined
                ? { filterExpression: trigger.filterExpression }
                : {}),
              ...(trigger.filterJson !== undefined
                ? { filterJson: toJsonValue(trigger.filterJson) }
                : {}),
              ...(trigger.isActive !== undefined ? { isActive: trigger.isActive } : {}),
              ...(trigger.metadata !== undefined ? { metadata: toJsonValue(trigger.metadata) } : {}),
              ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
            },
          }),
        ),
      );

      const actions = await Promise.all(
        (data.actions ?? []).map((action) =>
          tx.automationAction.create({
            data: {
              organizationId: data.organizationId,
              ruleId: rule.id,
              actionOrder: action.actionOrder,
              actionType: action.actionType,
              name: action.name,
              ...(action.config !== undefined ? { config: toJsonValue(action.config) } : {}),
              ...(action.conditionExpression !== undefined
                ? { conditionExpression: action.conditionExpression }
                : {}),
              ...(action.onFailure !== undefined ? { onFailure: action.onFailure } : {}),
              ...(action.timeoutSeconds !== undefined
                ? { timeoutSeconds: action.timeoutSeconds }
                : {}),
              ...(action.isActive !== undefined ? { isActive: action.isActive } : {}),
              ...(action.metadata !== undefined ? { metadata: toJsonValue(action.metadata) } : {}),
              ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
            },
          }),
        ),
      );

      return { rule, triggers, actions };
    });

    return {
      ...this.toRuleRecord(record.rule),
      triggers: record.triggers.map((trigger) => this.toTriggerRecord(trigger)),
      actions: record.actions.map((action) => this.toActionRecord(action)),
    };
  }

  async update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateAutomationRuleData,
    expectedVersion: number,
  ): Promise<AutomationRuleDetailRecord | null> {
    try {
      const record = await this.prisma.$transaction(async (tx) => {
        const rule = await tx.automationRule.update({
          where: {
            id,
            organizationId,
            version: expectedVersion,
            deletedAt: null,
            status: 'draft',
          },
          data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.description !== undefined ? { description: data.description } : {}),
            ...(data.settings !== undefined ? { settings: toJsonValue(data.settings) } : {}),
            ...(data.tags !== undefined ? { tags: data.tags } : {}),
            ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
            ...(data.updatedBy !== undefined ? { updatedBy: data.updatedBy } : {}),
            version: { increment: 1 },
          },
        });

        if (data.triggers !== undefined) {
          await tx.automationTrigger.updateMany({
            where: { ruleId: id, organizationId, deletedAt: null },
            data: {
              deletedAt: new Date(),
              ...(data.updatedBy !== undefined ? { updatedBy: data.updatedBy } : {}),
            },
          });

          await Promise.all(
            data.triggers.map((trigger, index) =>
              tx.automationTrigger.create({
                data: {
                  organizationId,
                  ruleId: id,
                  triggerOrder: trigger.triggerOrder ?? index,
                  triggerType: trigger.triggerType,
                  ...(trigger.eventType !== undefined ? { eventType: trigger.eventType } : {}),
                  ...(trigger.scheduleCron !== undefined
                    ? { scheduleCron: trigger.scheduleCron }
                    : {}),
                  ...(trigger.scheduleTimezone !== undefined
                    ? { scheduleTimezone: trigger.scheduleTimezone }
                    : {}),
                  ...(trigger.webhookPath !== undefined
                    ? { webhookPath: trigger.webhookPath }
                    : {}),
                  ...(trigger.filterExpression !== undefined
                    ? { filterExpression: trigger.filterExpression }
                    : {}),
                  ...(trigger.filterJson !== undefined
                    ? { filterJson: toJsonValue(trigger.filterJson) }
                    : {}),
                  ...(trigger.isActive !== undefined ? { isActive: trigger.isActive } : {}),
                  ...(trigger.metadata !== undefined
                    ? { metadata: toJsonValue(trigger.metadata) }
                    : {}),
                  ...(data.updatedBy !== undefined ? { createdBy: data.updatedBy } : {}),
                },
              }),
            ),
          );
        }

        if (data.actions !== undefined) {
          await tx.automationAction.updateMany({
            where: { ruleId: id, organizationId, deletedAt: null },
            data: {
              deletedAt: new Date(),
              ...(data.updatedBy !== undefined ? { updatedBy: data.updatedBy } : {}),
            },
          });

          await Promise.all(
            data.actions.map((action) =>
              tx.automationAction.create({
                data: {
                  organizationId,
                  ruleId: id,
                  actionOrder: action.actionOrder,
                  actionType: action.actionType,
                  name: action.name,
                  ...(action.config !== undefined ? { config: toJsonValue(action.config) } : {}),
                  ...(action.conditionExpression !== undefined
                    ? { conditionExpression: action.conditionExpression }
                    : {}),
                  ...(action.onFailure !== undefined ? { onFailure: action.onFailure } : {}),
                  ...(action.timeoutSeconds !== undefined
                    ? { timeoutSeconds: action.timeoutSeconds }
                    : {}),
                  ...(action.isActive !== undefined ? { isActive: action.isActive } : {}),
                  ...(action.metadata !== undefined
                    ? { metadata: toJsonValue(action.metadata) }
                    : {}),
                  ...(data.updatedBy !== undefined ? { createdBy: data.updatedBy } : {}),
                },
              }),
            ),
          );
        }

        const triggers = await tx.automationTrigger.findMany({
          where: { ruleId: id, organizationId, deletedAt: null },
          orderBy: { triggerOrder: 'asc' },
        });

        const actions = await tx.automationAction.findMany({
          where: { ruleId: id, organizationId, deletedAt: null },
          orderBy: { actionOrder: 'asc' },
        });

        return { rule, triggers, actions };
      });

      return {
        ...this.toRuleRecord(record.rule),
        triggers: record.triggers.map((trigger) => this.toTriggerRecord(trigger)),
        actions: record.actions.map((action) => this.toActionRecord(action)),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return null;
      }
      throw error;
    }
  }

  async softDelete(
    organizationId: OrganizationId,
    id: string,
    updatedBy?: UserId,
  ): Promise<boolean> {
    const deletedAt = new Date();

    const result = await this.prisma.$transaction([
      this.prisma.automationRule.updateMany({
        where: { id, organizationId, deletedAt: null },
        data: {
          deletedAt,
          status: 'archived',
          ...(updatedBy !== undefined ? { updatedBy } : {}),
        },
      }),
      this.prisma.automationTrigger.updateMany({
        where: { ruleId: id, organizationId, deletedAt: null },
        data: {
          deletedAt,
          ...(updatedBy !== undefined ? { updatedBy } : {}),
        },
      }),
      this.prisma.automationAction.updateMany({
        where: { ruleId: id, organizationId, deletedAt: null },
        data: {
          deletedAt,
          ...(updatedBy !== undefined ? { updatedBy } : {}),
        },
      }),
    ]);

    return result[0].count > 0;
  }

  async enable(
    organizationId: OrganizationId,
    id: string,
    updatedBy?: UserId,
  ): Promise<AutomationRuleRecord | null> {
    try {
      const record = await this.prisma.automationRule.update({
        where: {
          id,
          organizationId,
          deletedAt: null,
          status: { in: ['draft', 'disabled'] },
        },
        data: {
          status: 'enabled',
          ...(updatedBy !== undefined ? { updatedBy } : {}),
          version: { increment: 1 },
        },
      });

      return this.toRuleRecord(record);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return null;
      }
      throw error;
    }
  }

  async disable(
    organizationId: OrganizationId,
    id: string,
    updatedBy?: UserId,
  ): Promise<AutomationRuleRecord | null> {
    try {
      const record = await this.prisma.automationRule.update({
        where: {
          id,
          organizationId,
          deletedAt: null,
          status: 'enabled',
        },
        data: {
          status: 'disabled',
          ...(updatedBy !== undefined ? { updatedBy } : {}),
          version: { increment: 1 },
        },
      });

      return this.toRuleRecord(record);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return null;
      }
      throw error;
    }
  }

  async list(filter: ListAutomationRulesFilter): Promise<AutomationRuleRecord[]> {
    const cursorFilter = await this.buildCursorFilter(filter.organizationId, filter.cursor);

    const records = await this.prisma.automationRule.findMany({
      where: {
        organizationId: filter.organizationId,
        deletedAt: null,
        ...(filter.status !== undefined ? { status: filter.status } : {}),
        ...cursorFilter,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit,
    });

    return records.map((record) => this.toRuleRecord(record));
  }

  async incrementExecutionCount(
    organizationId: OrganizationId,
    id: string,
    executedAt: Date,
  ): Promise<void> {
    await this.prisma.automationRule.update({
      where: { id, organizationId, deletedAt: null },
      data: {
        executionCount: { increment: 1 },
        lastExecutedAt: executedAt,
      },
    });
  }

  private async buildCursorFilter(
    organizationId: OrganizationId,
    cursor?: string,
  ): Promise<Prisma.AutomationRuleWhereInput> {
    if (cursor === undefined) {
      return {};
    }

    const anchor = await this.prisma.automationRule.findFirst({
      where: { id: cursor, organizationId, deletedAt: null },
      select: { createdAt: true, id: true },
    });

    if (anchor === null) {
      return {};
    }

    return {
      OR: [
        { createdAt: { lt: anchor.createdAt } },
        { createdAt: anchor.createdAt, id: { lt: anchor.id } },
      ],
    };
  }

  private toRuleRecord(record: {
    id: string;
    organizationId: string;
    name: string;
    description: string | null;
    status: string;
    ruleVersion: number;
    ownerId: string | null;
    maxExecutionsHour: number | null;
    maxExecutionsDay: number | null;
    concurrencyLimit: number | null;
    retryMaxAttempts: number | null;
    retryBackoff: string | null;
    dryRunAvailable: boolean;
    lastExecutedAt: Date | null;
    executionCount: bigint;
    tags: string[];
    settings: unknown;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): AutomationRuleRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      name: record.name,
      description: record.description,
      status: record.status as AutomationRuleStatus,
      ruleVersion: record.ruleVersion,
      ownerId: record.ownerId,
      maxExecutionsHour: record.maxExecutionsHour,
      maxExecutionsDay: record.maxExecutionsDay,
      concurrencyLimit: record.concurrencyLimit,
      retryMaxAttempts: record.retryMaxAttempts,
      retryBackoff: record.retryBackoff as AutomationRuleRecord['retryBackoff'],
      dryRunAvailable: record.dryRunAvailable,
      lastExecutedAt: record.lastExecutedAt,
      executionCount: record.executionCount,
      tags: record.tags,
      settings: this.asRecord(record.settings) ?? {},
      metadata: this.asRecord(record.metadata) ?? {},
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    };
  }

  private toTriggerRecord(record: {
    id: string;
    organizationId: string;
    ruleId: string;
    triggerOrder: number;
    triggerType: string;
    eventType: string | null;
    scheduleCron: string | null;
    scheduleTimezone: string | null;
    webhookPath: string | null;
    filterExpression: string | null;
    filterJson: unknown;
    isActive: boolean;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): AutomationTriggerRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      ruleId: record.ruleId,
      triggerOrder: record.triggerOrder,
      triggerType: record.triggerType as AutomationTriggerRecord['triggerType'],
      eventType: record.eventType,
      scheduleCron: record.scheduleCron,
      scheduleTimezone: record.scheduleTimezone,
      webhookPath: record.webhookPath,
      filterExpression: record.filterExpression,
      filterJson: this.asRecord(record.filterJson) ?? {},
      isActive: record.isActive,
      metadata: this.asRecord(record.metadata) ?? {},
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    };
  }

  private toActionRecord(record: {
    id: string;
    organizationId: string;
    ruleId: string;
    actionOrder: number;
    actionType: string;
    name: string;
    config: unknown;
    conditionExpression: string | null;
    onFailure: string;
    timeoutSeconds: number | null;
    isActive: boolean;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): AutomationActionRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      ruleId: record.ruleId,
      actionOrder: record.actionOrder,
      actionType: record.actionType as AutomationActionRecord['actionType'],
      name: record.name,
      config: this.asRecord(record.config) ?? {},
      conditionExpression: record.conditionExpression,
      onFailure: record.onFailure as AutomationActionRecord['onFailure'],
      timeoutSeconds: record.timeoutSeconds,
      isActive: record.isActive,
      metadata: this.asRecord(record.metadata) ?? {},
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return null;
  }
}