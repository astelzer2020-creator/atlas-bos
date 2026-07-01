import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type OrganizationId,
  type UserId,
} from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import { ProjectService } from '../application/services/project.service.js';
import type {
  ProjectRecord,
  ProjectRepository,
} from '../domain/repositories/project.repository.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;
const USER_ID = '550e8400-e29b-41d4-a716-446655440000' as UserId;
const PROJECT_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

function createProjectRecord(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: PROJECT_ID,
    organizationId: ORG_ID,
    workspaceId: null,
    code: 'PRJ-001',
    name: 'Website Redesign',
    description: null,
    status: 'planning',
    priority: 'medium',
    startDate: null,
    targetEndDate: null,
    progressPercent: '0',
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

function createProjectService(repository: Partial<ProjectRepository> = {}) {
  const projectRepository: ProjectRepository = {
    findById: vi.fn().mockResolvedValue(null),
    findByCode: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(createProjectRecord()),
    update: vi.fn().mockResolvedValue(createProjectRecord({ version: 2 })),
    list: vi.fn().mockResolvedValue([createProjectRecord()]),
    ...repository,
  };

  return {
    service: new ProjectService({ projectRepository }),
    projectRepository,
  };
}

describe('ProjectService', () => {
  it('createProject creates project with trimmed code and name', async () => {
    const { service, projectRepository } = createProjectService();

    const result = await service.createProject(
      ORG_ID,
      { code: '  PRJ-001  ', name: '  Website Redesign  ' },
      USER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.code).toBe('PRJ-001');
      expect(result.value.name).toBe('Website Redesign');
      expect(result.value.status).toBe('planning');
    }

    expect(projectRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        code: 'PRJ-001',
        name: 'Website Redesign',
        createdBy: USER_ID,
      }),
    );
  });

  it('createProject rejects empty name', async () => {
    const { service } = createProjectService();

    const result = await service.createProject(ORG_ID, { code: 'PRJ-001', name: '   ' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('createProject rejects empty code', async () => {
    const { service } = createProjectService();

    const result = await service.createProject(ORG_ID, { code: '   ', name: 'Website Redesign' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('createProject rejects duplicate code within organization', async () => {
    const { service } = createProjectService({
      findByCode: vi.fn().mockResolvedValue(createProjectRecord()),
    });

    const result = await service.createProject(ORG_ID, {
      code: 'PRJ-001',
      name: 'Another Project',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });

  it('getProject returns not found for missing project', async () => {
    const { service } = createProjectService();

    const result = await service.getProject(ORG_ID, PROJECT_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it('updateProject enforces optimistic version check', async () => {
    const { service } = createProjectService({
      findById: vi.fn().mockResolvedValue(createProjectRecord({ version: 2 })),
    });

    const result = await service.updateProject(
      ORG_ID,
      PROJECT_ID,
      { name: 'Updated', version: 1 },
      USER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });

  it('updateProject rejects invalid progress percent', async () => {
    const { service } = createProjectService({
      findById: vi.fn().mockResolvedValue(createProjectRecord()),
    });

    const result = await service.updateProject(ORG_ID, PROJECT_ID, {
      progressPercent: '150',
      version: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('listProjects returns paginated data', async () => {
    const { service } = createProjectService();

    const result = await service.listProjects(ORG_ID, { limit: 50 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.code).toBe('PRJ-001');
    expect(result.nextCursor).toBeNull();
  });
});