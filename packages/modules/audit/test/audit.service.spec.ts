import {
  ValidationError,
  type OrganizationId,
  type UserId,
} from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import { AuditService } from '../application/services/audit.service.js';
import type { AuditLogEntryRecord, AuditLogRepository } from '../domain/repositories/audit-log.repository.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;
const USER_ID = '550e8400-e29b-41d4-a716-446655440000' as UserId;
const ENTITY_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

function createAuditEntry(overrides: Partial<AuditLogEntryRecord> = {}): AuditLogEntryRecord {
  return {
    id: '42',
    tenantId: ORG_ID,
    entityType: 'contact',
    entityId: ENTITY_ID,
    action: 'CREATE',
    actorId: USER_ID,
    actorType: 'user',
    changes: { status: { old: 'draft', new: 'open' } },
    previousState: null,
    newState: null,
    metadata: {},
    correlationId: 'corr-1',
    requestId: 'req-1',
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    occurredAt: new Date('2026-06-30T12:00:00.000Z'),
    ...overrides,
  };
}

function createAuditService(repository: Partial<AuditLogRepository> = {}) {
  const auditLogRepository: AuditLogRepository = {
    append: vi.fn().mockResolvedValue(createAuditEntry()),
    query: vi.fn().mockResolvedValue([createAuditEntry()]),
    ...repository,
  };

  return {
    service: new AuditService({ auditLogRepository }),
    auditLogRepository,
  };
}

describe('AuditService', () => {
  it('recordAuditEntry appends an immutable audit log entry', async () => {
    const { service, auditLogRepository } = createAuditService();

    const result = await service.recordAuditEntry({
      tenantId: ORG_ID,
      entityType: 'contact',
      entityId: ENTITY_ID,
      action: 'CREATE',
      actorId: USER_ID,
      changes: { status: { old: 'draft', new: 'open' } },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entity_type).toBe('contact');
      expect(result.value.action).toBe('CREATE');
      expect(result.value.organization_id).toBe(ORG_ID);
    }

    expect(auditLogRepository.append).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: ORG_ID,
        entityType: 'contact',
        entityId: ENTITY_ID,
        action: 'CREATE',
        actorId: USER_ID,
      }),
      undefined,
    );
  });

  it('recordAuditEntry rejects invalid entityId', async () => {
    const { service } = createAuditService();

    const result = await service.recordAuditEntry({
      tenantId: ORG_ID,
      entityType: 'contact',
      entityId: 'not-a-uuid',
      action: 'CREATE',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('recordAuditEntry rejects empty entityType', async () => {
    const { service } = createAuditService();

    const result = await service.recordAuditEntry({
      tenantId: ORG_ID,
      entityType: '   ',
      entityId: ENTITY_ID,
      action: 'ACCESS',
    });

    expect(result.ok).toBe(false);
  });

  it('queryAuditLog applies tenant and entity filters', async () => {
    const { service, auditLogRepository } = createAuditService();

    const result = await service.queryAuditLog({
      tenantId: ORG_ID,
      entityType: 'contact',
      entityId: ENTITY_ID,
      actorId: USER_ID,
      limit: 25,
    });

    expect(result.ok).toBe(true);
    expect(auditLogRepository.query).toHaveBeenCalledWith({
      tenantId: ORG_ID,
      entityType: 'contact',
      entityId: ENTITY_ID,
      actorId: USER_ID,
      limit: 25,
    });
  });

  it('queryAuditLog rejects inverted date ranges', async () => {
    const { service } = createAuditService();

    const result = await service.queryAuditLog({
      tenantId: ORG_ID,
      occurredFrom: new Date('2026-06-30T12:00:00.000Z'),
      occurredTo: new Date('2026-06-29T12:00:00.000Z'),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('queryAuditLog returns next_cursor when page is full', async () => {
    const entries = Array.from({ length: 50 }, (_, index) =>
      createAuditEntry({ id: String(50 - index) }),
    );

    const { service } = createAuditService({
      query: vi.fn().mockResolvedValue(entries),
    });

    const result = await service.queryAuditLog({
      tenantId: ORG_ID,
      limit: 50,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries).toHaveLength(50);
      expect(result.value.next_cursor).toBe('1');
    }
  });
});