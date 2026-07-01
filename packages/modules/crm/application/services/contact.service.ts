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

import type { CrmAccountRepository } from '../../domain/repositories/account.repository.js';
import type {
  CreateCrmContactData,
  CrmContactRecord,
  CrmContactRepository,
  CrmContactStatus,
  UpdateCrmContactData,
} from '../../domain/repositories/contact.repository.js';
import type { Address } from '../../domain/types/address.js';
import { resolveListLimit, type CursorPageResult } from '../../domain/types/pagination.js';

export interface ContactDto {
  readonly id: string;
  readonly organizationId: string;
  readonly externalId: string | null;
  readonly accountId: string | null;
  readonly salutation: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly displayName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly mobile: string | null;
  readonly jobTitle: string | null;
  readonly department: string | null;
  readonly mailingAddress: Address;
  readonly isPrimary: boolean;
  readonly ownerId: string | null;
  readonly leadSource: string | null;
  readonly status: CrmContactStatus;
  readonly lastContactedAt: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly version: number;
}

export interface CreateContactInput {
  readonly displayName: string;
  readonly externalId?: string;
  readonly accountId?: string;
  readonly salutation?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly mobile?: string;
  readonly jobTitle?: string;
  readonly department?: string;
  readonly mailingAddress?: Address;
  readonly isPrimary?: boolean;
  readonly ownerId?: string;
  readonly leadSource?: string;
  readonly status?: CrmContactStatus;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateContactInput {
  readonly displayName?: string;
  readonly externalId?: string | null;
  readonly accountId?: string | null;
  readonly salutation?: string | null;
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly mobile?: string | null;
  readonly jobTitle?: string | null;
  readonly department?: string | null;
  readonly mailingAddress?: Address;
  readonly isPrimary?: boolean;
  readonly ownerId?: string | null;
  readonly leadSource?: string | null;
  readonly status?: CrmContactStatus;
  readonly lastContactedAt?: string;
  readonly metadata?: Record<string, unknown>;
  readonly version: number;
}

export interface ListContactsInput {
  readonly limit?: number;
  readonly cursor?: string;
  readonly accountId?: string;
  readonly status?: CrmContactStatus;
  readonly ownerId?: string;
}

export interface ContactServiceDeps {
  readonly contactRepository: CrmContactRepository;
  readonly accountRepository: CrmAccountRepository;
}

export class ContactService {
  constructor(private readonly deps: ContactServiceDeps) {}

  async createContact(
    organizationId: OrganizationId,
    input: CreateContactInput,
    actorId?: UserId,
  ): Promise<Result<ContactDto, ValidationError>> {
    const displayName = input.displayName.trim();
    if (displayName.length === 0) {
      return err(new ValidationError('Contact display name is required', { field: 'displayName' }));
    }

    if (input.accountId !== undefined) {
      const account = await this.deps.accountRepository.findById(organizationId, input.accountId);
      if (account === null) {
        return err(
          new ValidationError('Account not found in organization', { field: 'accountId' }),
        );
      }
    }

    const createData: CreateCrmContactData = {
      organizationId,
      displayName,
      ...(input.externalId !== undefined ? { externalId: input.externalId } : {}),
      ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
      ...(input.salutation !== undefined ? { salutation: input.salutation } : {}),
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.mobile !== undefined ? { mobile: input.mobile } : {}),
      ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
      ...(input.department !== undefined ? { department: input.department } : {}),
      ...(input.mailingAddress !== undefined ? { mailingAddress: input.mailingAddress } : {}),
      ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
      ...(input.leadSource !== undefined ? { leadSource: input.leadSource } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(actorId !== undefined ? { createdBy: actorId } : {}),
    };

    const contact = await this.deps.contactRepository.create(createData);
    return ok(this.toDto(contact));
  }

  async getContact(
    organizationId: OrganizationId,
    contactId: string,
  ): Promise<Result<ContactDto, NotFoundError>> {
    const contact = await this.deps.contactRepository.findById(organizationId, contactId);
    if (contact === null) {
      return err(new NotFoundError('Contact', contactId));
    }
    return ok(this.toDto(contact));
  }

  async updateContact(
    organizationId: OrganizationId,
    contactId: string,
    input: UpdateContactInput,
    actorId?: UserId,
  ): Promise<Result<ContactDto, ValidationError | NotFoundError | ConflictError>> {
    const existing = await this.deps.contactRepository.findById(organizationId, contactId);
    if (existing === null) {
      return err(new NotFoundError('Contact', contactId));
    }

    if (input.version !== existing.version) {
      return err(
        new ConflictError('Contact version mismatch', {
          details: { expected: input.version, actual: existing.version },
        }),
      );
    }

    if (input.displayName !== undefined && input.displayName.trim().length === 0) {
      return err(
        new ValidationError('Contact display name cannot be empty', { field: 'displayName' }),
      );
    }

    if (input.accountId !== undefined && input.accountId !== null) {
      const account = await this.deps.accountRepository.findById(organizationId, input.accountId);
      if (account === null) {
        return err(
          new ValidationError('Account not found in organization', { field: 'accountId' }),
        );
      }
    }

    const updateData: UpdateCrmContactData = {
      ...(input.displayName !== undefined ? { displayName: input.displayName.trim() } : {}),
      ...(input.externalId !== undefined ? { externalId: input.externalId } : {}),
      ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
      ...(input.salutation !== undefined ? { salutation: input.salutation } : {}),
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.mobile !== undefined ? { mobile: input.mobile } : {}),
      ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
      ...(input.department !== undefined ? { department: input.department } : {}),
      ...(input.mailingAddress !== undefined ? { mailingAddress: input.mailingAddress } : {}),
      ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
      ...(input.leadSource !== undefined ? { leadSource: input.leadSource } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.lastContactedAt !== undefined
        ? { lastContactedAt: new Date(input.lastContactedAt) }
        : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(actorId !== undefined ? { updatedBy: actorId } : {}),
    };

    const updated = await this.deps.contactRepository.update(
      organizationId,
      contactId,
      updateData,
      input.version,
    );

    if (updated === null) {
      return err(
        new ConflictError('Contact was modified concurrently', {
          details: { id: contactId, expectedVersion: input.version },
        }),
      );
    }

    return ok(this.toDto(updated));
  }

  async listContacts(
    organizationId: OrganizationId,
    input: ListContactsInput = {},
  ): Promise<CursorPageResult<ContactDto>> {
    const limit = resolveListLimit(input.limit);

    const contacts = await this.deps.contactRepository.list({
      organizationId,
      limit,
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
      ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
    });

    return {
      data: contacts.map((contact) => this.toDto(contact)),
      nextCursor: contacts.length === limit ? (contacts.at(-1)?.id ?? null) : null,
    };
  }

  toDto(record: CrmContactRecord): ContactDto {
    return {
      id: record.id,
      organizationId: record.organizationId,
      externalId: record.externalId,
      accountId: record.accountId,
      salutation: record.salutation,
      firstName: record.firstName,
      lastName: record.lastName,
      displayName: record.displayName,
      email: record.email,
      phone: record.phone,
      mobile: record.mobile,
      jobTitle: record.jobTitle,
      department: record.department,
      mailingAddress: record.mailingAddress,
      isPrimary: record.isPrimary,
      ownerId: record.ownerId,
      leadSource: record.leadSource,
      status: record.status,
      lastContactedAt: record.lastContactedAt?.toISOString() ?? null,
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