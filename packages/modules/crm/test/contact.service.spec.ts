import {
  ConflictError,
  ValidationError,
  type OrganizationId,
  type UserId,
} from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import { ContactService } from '../application/services/contact.service.js';
import type { CrmAccountRepository } from '../domain/repositories/account.repository.js';
import type {
  CrmContactRecord,
  CrmContactRepository,
} from '../domain/repositories/contact.repository.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;
const USER_ID = '550e8400-e29b-41d4-a716-446655440000' as UserId;
const CONTACT_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const ACCOUNT_ID = '8d7e6679-7425-40de-944b-e07fc1f90ae8';

function createContactRecord(overrides: Partial<CrmContactRecord> = {}): CrmContactRecord {
  return {
    id: CONTACT_ID,
    organizationId: ORG_ID,
    externalId: null,
    accountId: null,
    salutation: null,
    firstName: 'Jane',
    lastName: 'Doe',
    displayName: 'Jane Doe',
    email: 'jane@example.com',
    phone: null,
    mobile: null,
    jobTitle: null,
    department: null,
    mailingAddress: {},
    isPrimary: false,
    ownerId: null,
    leadSource: null,
    status: 'active',
    lastContactedAt: null,
    metadata: {},
    createdAt: new Date('2026-06-30T08:00:00Z'),
    updatedAt: new Date('2026-06-30T08:00:00Z'),
    deletedAt: null,
    createdBy: USER_ID,
    updatedBy: null,
    version: 1,
    ...overrides,
  };
}

function createContactService(
  contactRepository: Partial<CrmContactRepository> = {},
  accountRepository: Partial<CrmAccountRepository> = {},
) {
  const contactRepo: CrmContactRepository = {
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(createContactRecord()),
    update: vi.fn().mockResolvedValue(createContactRecord({ version: 2 })),
    list: vi.fn().mockResolvedValue([createContactRecord()]),
    ...contactRepository,
  };

  const accountRepo: CrmAccountRepository = {
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
    ...accountRepository,
  };

  return {
    service: new ContactService({
      contactRepository: contactRepo,
      accountRepository: accountRepo,
    }),
    contactRepository: contactRepo,
    accountRepository: accountRepo,
  };
}

describe('ContactService', () => {
  it('createContact creates contact with display name', async () => {
    const { service, contactRepository } = createContactService();

    const result = await service.createContact(
      ORG_ID,
      { displayName: 'Jane Doe', email: 'jane@example.com' },
      USER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.displayName).toBe('Jane Doe');
    }

    expect(contactRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        displayName: 'Jane Doe',
      }),
    );
  });

  it('createContact rejects invalid account reference', async () => {
    const { service } = createContactService();

    const result = await service.createContact(ORG_ID, {
      displayName: 'Jane Doe',
      accountId: ACCOUNT_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('updateContact enforces optimistic version check', async () => {
    const { service } = createContactService({
      findById: vi.fn().mockResolvedValue(createContactRecord({ version: 3 })),
    });

    const result = await service.updateContact(
      ORG_ID,
      CONTACT_ID,
      { displayName: 'Updated', version: 1 },
      USER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });
});