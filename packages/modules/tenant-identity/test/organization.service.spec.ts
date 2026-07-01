import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  type OrganizationId,
  type UserId,
  type WorkspaceId,
} from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import type {
  OrganizationMemberRecord,
  OrganizationRecord,
  OrganizationRepository,
} from '../domain/repositories/organization.repository.js';
import { OrganizationService } from '../application/services/organization.service.js';

const ACTOR_ID = '550e8400-e29b-41d4-a716-446655440000' as UserId;
const ORG_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7' as OrganizationId;
const WORKSPACE_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as WorkspaceId;

const MEMBER_ID = '8f14e45f-ceea-467a-9bf5-8c6b4b8b5c2d';

const sampleMember: OrganizationMemberRecord = {
  id: MEMBER_ID,
  userId: ACTOR_ID,
  status: 'ACTIVE',
  isOwner: true,
  title: 'CEO',
  department: 'Executive',
  joinedAt: new Date('2026-01-15T08:00:00Z'),
  userEmail: 'owner@acme.example',
  userDisplayName: 'Acme Owner',
};

const sampleOrganization: OrganizationRecord = {
  id: ORG_ID,
  workspaceId: WORKSPACE_ID,
  slug: 'acme-corp',
  name: 'Acme Corp',
  displayName: 'Acme Corporation',
  status: 'ACTIVE',
  timezone: 'UTC',
  locale: 'en-US',
  currencyCode: 'USD',
  dataRegion: 'us-east-1',
  version: 1,
  createdAt: new Date('2026-01-15T08:00:00Z'),
  updatedAt: new Date('2026-01-15T08:00:00Z'),
};

function createOrganizationService(repositoryOverrides: Partial<OrganizationRepository> = {}) {
  const organizationRepository: OrganizationRepository = {
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceAndSlug: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(sampleOrganization),
    update: vi.fn().mockResolvedValue(sampleOrganization),
    list: vi.fn().mockResolvedValue([sampleOrganization]),
    seedSystemRoles: vi.fn().mockResolvedValue(undefined),
    addOwnerMember: vi.fn().mockResolvedValue(undefined),
    findMembership: vi.fn().mockResolvedValue({ isOwner: true, status: 'ACTIVE' }),
    listMembers: vi.fn().mockResolvedValue([sampleMember]),
    ...repositoryOverrides,
  };

  return {
    service: new OrganizationService({ organizationRepository }),
    organizationRepository,
  };
}

describe('OrganizationService', () => {
  it('creates an organization and seeds roles', async () => {
    const { service, organizationRepository } = createOrganizationService();

    const result = await service.createOrganization(
      {
        workspace_id: WORKSPACE_ID,
        slug: 'acme-corp',
        name: 'Acme Corp',
        display_name: 'Acme Corporation',
      },
      ACTOR_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.slug).toBe('acme-corp');
      expect(result.value.name).toBe('Acme Corp');
    }

    expect(organizationRepository.create).toHaveBeenCalledOnce();
    expect(organizationRepository.seedSystemRoles).toHaveBeenCalledWith(ORG_ID);
    expect(organizationRepository.addOwnerMember).toHaveBeenCalledWith(ORG_ID, ACTOR_ID);
  });

  it('returns conflict when slug already exists', async () => {
    const { service } = createOrganizationService({
      findByWorkspaceAndSlug: vi.fn().mockResolvedValue(sampleOrganization),
    });

    const result = await service.createOrganization(
      {
        workspace_id: WORKSPACE_ID,
        slug: 'acme-corp',
        name: 'Acme Corp',
      },
      ACTOR_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });

  it('returns not found for unknown organization', async () => {
    const { service } = createOrganizationService({
      findById: vi.fn().mockResolvedValue(null),
    });

    const result = await service.getOrganization(ORG_ID, ACTOR_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it('denies access when user is not a member', async () => {
    const { service } = createOrganizationService({
      findById: vi.fn().mockResolvedValue(sampleOrganization),
      findMembership: vi.fn().mockResolvedValue(null),
    });

    const result = await service.getOrganization(ORG_ID, ACTOR_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ForbiddenError);
    }
  });

  it('lists organization members for an active member', async () => {
    const { service, organizationRepository } = createOrganizationService();

    const result = await service.listMembers(ORG_ID, ACTOR_ID, { limit: 10 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.user_id).toBe(ACTOR_ID);
      expect(result.value[0]?.user.email).toBe('owner@acme.example');
      expect(result.value[0]?.user.display_name).toBe('Acme Owner');
    }

    expect(organizationRepository.listMembers).toHaveBeenCalledWith(ORG_ID, {
      limit: 10,
    });
  });

  it('denies listing members when user is not a member', async () => {
    const { service } = createOrganizationService({
      findMembership: vi.fn().mockResolvedValue(null),
    });

    const result = await service.listMembers(ORG_ID, ACTOR_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ForbiddenError);
    }
  });

  it('lists organizations for the actor', async () => {
    const { service, organizationRepository } = createOrganizationService();

    const organizations = await service.listOrganizations(ACTOR_ID, { limit: 10 });

    expect(organizations).toHaveLength(1);
    expect(organizations[0]?.slug).toBe('acme-corp');
    expect(organizationRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ACTOR_ID, limit: 10 }),
    );
  });

  it('updates organization when actor is owner', async () => {
    const updatedOrganization: OrganizationRecord = {
      ...sampleOrganization,
      name: 'Acme International',
      updatedAt: new Date('2026-06-30T12:00:00Z'),
    };

    const { service, organizationRepository } = createOrganizationService({
      findById: vi.fn().mockResolvedValue(sampleOrganization),
      update: vi.fn().mockResolvedValue(updatedOrganization),
    });

    const result = await service.updateOrganization(
      ORG_ID,
      { name: 'Acme International' },
      ACTOR_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Acme International');
    }

    expect(organizationRepository.update).toHaveBeenCalledOnce();
  });
});