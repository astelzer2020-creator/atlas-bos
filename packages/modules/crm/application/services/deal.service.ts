import {
  ConflictError,
  createUserId,
  err,
  NotFoundError,
  ok,
  ValidationError,
  type OrganizationId,
  type Result,
  type UserId,
} from '@atlas/shared-kernel';

import type { CrmAccountRepository } from '../../domain/repositories/account.repository.js';
import type { CrmContactRepository } from '../../domain/repositories/contact.repository.js';
import type {
  CreateDealData,
  DealRecord,
  DealRepository,
  DealStatus,
  UpdateDealData,
} from '../../domain/repositories/deal.repository.js';
import type { PipelineStageRepository } from '../../domain/repositories/pipeline-stage.repository.js';
import { resolveListLimit, type CursorPageResult } from '../../domain/types/pagination.js';
import type { OrganizationMembershipPort } from '../ports/organization-membership.port.js';

export interface DealDto {
  readonly id: string;
  readonly organizationId: string;
  readonly externalId: string | null;
  readonly name: string;
  readonly accountId: string | null;
  readonly contactId: string | null;
  readonly pipelineStageId: string;
  readonly ownerId: string;
  readonly amount: string;
  readonly currencyCode: string;
  readonly probability: number;
  readonly expectedCloseDate: string | null;
  readonly actualCloseDate: string | null;
  readonly status: DealStatus;
  readonly lossReason: string | null;
  readonly leadSource: string | null;
  readonly description: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly version: number;
}

export interface CreateDealInput {
  readonly name: string;
  readonly pipelineStageId: string;
  readonly ownerId: string;
  readonly externalId?: string;
  readonly accountId?: string;
  readonly contactId?: string;
  readonly amount?: string;
  readonly currencyCode?: string;
  readonly probability?: number;
  readonly expectedCloseDate?: string;
  readonly leadSource?: string;
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateDealInput {
  readonly name?: string;
  readonly externalId?: string | null;
  readonly accountId?: string | null;
  readonly contactId?: string | null;
  readonly pipelineStageId?: string;
  readonly ownerId?: string;
  readonly amount?: string;
  readonly currencyCode?: string;
  readonly probability?: number;
  readonly expectedCloseDate?: string | null;
  readonly actualCloseDate?: string | null;
  readonly status?: DealStatus;
  readonly lossReason?: string | null;
  readonly leadSource?: string | null;
  readonly description?: string | null;
  readonly metadata?: Record<string, unknown>;
  readonly version: number;
}

export interface ListDealsInput {
  readonly limit?: number;
  readonly cursor?: string;
  readonly status?: DealStatus;
  readonly pipelineStageId?: string;
  readonly ownerId?: string;
  readonly accountId?: string;
}

export interface DealServiceDeps {
  readonly dealRepository: DealRepository;
  readonly pipelineStageRepository: PipelineStageRepository;
  readonly accountRepository: CrmAccountRepository;
  readonly contactRepository: CrmContactRepository;
  readonly membershipPort: OrganizationMembershipPort;
}

export class DealService {
  constructor(private readonly deps: DealServiceDeps) {}

  async createDeal(
    organizationId: OrganizationId,
    input: CreateDealInput,
    actorId?: UserId,
  ): Promise<Result<DealDto, ValidationError>> {
    const name = input.name.trim();
    if (name.length === 0) {
      return err(new ValidationError('Deal name is required', { field: 'name' }));
    }

    const stageValidation = await this.validatePipelineStage(
      organizationId,
      input.pipelineStageId,
    );
    if (!stageValidation.ok) {
      return stageValidation;
    }

    const ownerValidation = await this.validateOwner(organizationId, input.ownerId);
    if (!ownerValidation.ok) {
      return ownerValidation;
    }

    if (input.accountId !== undefined) {
      const account = await this.deps.accountRepository.findById(organizationId, input.accountId);
      if (account === null) {
        return err(
          new ValidationError('Account not found in organization', { field: 'accountId' }),
        );
      }
    }

    if (input.contactId !== undefined) {
      const contact = await this.deps.contactRepository.findById(organizationId, input.contactId);
      if (contact === null) {
        return err(
          new ValidationError('Contact not found in organization', { field: 'contactId' }),
        );
      }
    }

    if (input.probability !== undefined && (input.probability < 0 || input.probability > 100)) {
      return err(
        new ValidationError('Deal probability must be between 0 and 100', { field: 'probability' }),
      );
    }

    const createData: CreateDealData = {
      organizationId,
      name,
      pipelineStageId: input.pipelineStageId,
      ownerId: input.ownerId,
      ...(input.externalId !== undefined ? { externalId: input.externalId } : {}),
      ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
      ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
      ...(input.probability !== undefined ? { probability: input.probability } : {}),
      ...(input.expectedCloseDate !== undefined
        ? { expectedCloseDate: new Date(input.expectedCloseDate) }
        : {}),
      ...(input.leadSource !== undefined ? { leadSource: input.leadSource } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(actorId !== undefined ? { createdBy: actorId } : {}),
    };

    const deal = await this.deps.dealRepository.create(createData);
    return ok(this.toDto(deal));
  }

  async getDeal(
    organizationId: OrganizationId,
    dealId: string,
  ): Promise<Result<DealDto, NotFoundError>> {
    const deal = await this.deps.dealRepository.findById(organizationId, dealId);
    if (deal === null) {
      return err(new NotFoundError('Deal', dealId));
    }
    return ok(this.toDto(deal));
  }

  async updateDeal(
    organizationId: OrganizationId,
    dealId: string,
    input: UpdateDealInput,
    actorId?: UserId,
  ): Promise<Result<DealDto, ValidationError | NotFoundError | ConflictError>> {
    const existing = await this.deps.dealRepository.findById(organizationId, dealId);
    if (existing === null) {
      return err(new NotFoundError('Deal', dealId));
    }

    if (input.version !== existing.version) {
      return err(
        new ConflictError('Deal version mismatch', {
          details: { expected: input.version, actual: existing.version },
        }),
      );
    }

    if (input.name !== undefined && input.name.trim().length === 0) {
      return err(new ValidationError('Deal name cannot be empty', { field: 'name' }));
    }

    if (input.pipelineStageId !== undefined) {
      const stageValidation = await this.validatePipelineStage(
        organizationId,
        input.pipelineStageId,
      );
      if (!stageValidation.ok) {
        return stageValidation;
      }
    }

    if (input.ownerId !== undefined) {
      const ownerValidation = await this.validateOwner(organizationId, input.ownerId);
      if (!ownerValidation.ok) {
        return ownerValidation;
      }
    }

    if (input.accountId !== undefined && input.accountId !== null) {
      const account = await this.deps.accountRepository.findById(organizationId, input.accountId);
      if (account === null) {
        return err(
          new ValidationError('Account not found in organization', { field: 'accountId' }),
        );
      }
    }

    if (input.contactId !== undefined && input.contactId !== null) {
      const contact = await this.deps.contactRepository.findById(organizationId, input.contactId);
      if (contact === null) {
        return err(
          new ValidationError('Contact not found in organization', { field: 'contactId' }),
        );
      }
    }

    if (input.probability !== undefined && (input.probability < 0 || input.probability > 100)) {
      return err(
        new ValidationError('Deal probability must be between 0 and 100', { field: 'probability' }),
      );
    }

    const updateData: UpdateDealData = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.externalId !== undefined ? { externalId: input.externalId } : {}),
      ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
      ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
      ...(input.pipelineStageId !== undefined ? { pipelineStageId: input.pipelineStageId } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
      ...(input.probability !== undefined ? { probability: input.probability } : {}),
      ...(input.expectedCloseDate !== undefined
        ? {
            expectedCloseDate:
              input.expectedCloseDate === null ? null : new Date(input.expectedCloseDate),
          }
        : {}),
      ...(input.actualCloseDate !== undefined
        ? {
            actualCloseDate:
              input.actualCloseDate === null ? null : new Date(input.actualCloseDate),
          }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.lossReason !== undefined ? { lossReason: input.lossReason } : {}),
      ...(input.leadSource !== undefined ? { leadSource: input.leadSource } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(actorId !== undefined ? { updatedBy: actorId } : {}),
    };

    const updated = await this.deps.dealRepository.update(
      organizationId,
      dealId,
      updateData,
      input.version,
    );

    if (updated === null) {
      return err(
        new ConflictError('Deal was modified concurrently', {
          details: { id: dealId, expectedVersion: input.version },
        }),
      );
    }

    return ok(this.toDto(updated));
  }

  async listDeals(
    organizationId: OrganizationId,
    input: ListDealsInput = {},
  ): Promise<CursorPageResult<DealDto>> {
    const limit = resolveListLimit(input.limit);

    const deals = await this.deps.dealRepository.list({
      organizationId,
      limit,
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.pipelineStageId !== undefined ? { pipelineStageId: input.pipelineStageId } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
      ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
    });

    return {
      data: deals.map((deal) => this.toDto(deal)),
      nextCursor: deals.length === limit ? (deals.at(-1)?.id ?? null) : null,
    };
  }

  private async validatePipelineStage(
    organizationId: OrganizationId,
    pipelineStageId: string,
  ): Promise<Result<void, ValidationError>> {
    const stage = await this.deps.pipelineStageRepository.findById(
      organizationId,
      pipelineStageId,
    );
    if (stage === null) {
      return err(
        new ValidationError('Pipeline stage not found in organization', {
          field: 'pipelineStageId',
        }),
      );
    }
    return ok(undefined);
  }

  private async validateOwner(
    organizationId: OrganizationId,
    ownerId: string,
  ): Promise<Result<void, ValidationError>> {
    const userIdResult = createUserId(ownerId);
    if (!userIdResult.ok) {
      return err(new ValidationError('Owner ID must be a valid UUID', { field: 'ownerId' }));
    }

    const isMember = await this.deps.membershipPort.isActiveMember(
      organizationId,
      userIdResult.value,
    );
    if (!isMember) {
      return err(
        new ValidationError('Owner must be an active organization member', { field: 'ownerId' }),
      );
    }

    return ok(undefined);
  }

  toDto(record: DealRecord): DealDto {
    return {
      id: record.id,
      organizationId: record.organizationId,
      externalId: record.externalId,
      name: record.name,
      accountId: record.accountId,
      contactId: record.contactId,
      pipelineStageId: record.pipelineStageId,
      ownerId: record.ownerId,
      amount: record.amount,
      currencyCode: record.currencyCode,
      probability: record.probability,
      expectedCloseDate: record.expectedCloseDate?.toISOString().slice(0, 10) ?? null,
      actualCloseDate: record.actualCloseDate?.toISOString().slice(0, 10) ?? null,
      status: record.status,
      lossReason: record.lossReason,
      leadSource: record.leadSource,
      description: record.description,
      metadata: record.metadata,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      deletedAt: record.deletedAt?.toISOString() ?? null,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      version: record.version,
    };
  }
}