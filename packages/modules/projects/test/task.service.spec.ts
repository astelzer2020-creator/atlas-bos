import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type OrganizationId,
  type UserId,
} from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import { TaskService } from '../application/services/task.service.js';
import type { ProjectRecord, ProjectRepository } from '../domain/repositories/project.repository.js';
import type {
  ProjectTaskRecord,
  ProjectTaskRepository,
} from '../domain/repositories/task.repository.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;
const USER_ID = '550e8400-e29b-41d4-a716-446655440000' as UserId;
const PROJECT_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const TASK_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function createProjectRecord(): ProjectRecord {
  return {
    id: PROJECT_ID,
    organizationId: ORG_ID,
    workspaceId: null,
    code: 'PRJ-001',
    name: 'Website Redesign',
    description: null,
    status: 'active',
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
  };
}

function createTaskRecord(overrides: Partial<ProjectTaskRecord> = {}): ProjectTaskRecord {
  return {
    id: TASK_ID,
    organizationId: ORG_ID,
    projectId: PROJECT_ID,
    parentTaskId: null,
    assigneeId: null,
    title: 'Design homepage',
    description: null,
    status: 'todo',
    priority: 'medium',
    dueDate: null,
    completedAt: null,
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

function createTaskService(
  taskRepository: Partial<ProjectTaskRepository> = {},
  projectRepository: Partial<ProjectRepository> = {},
) {
  const taskRepo: ProjectTaskRepository = {
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(createTaskRecord()),
    update: vi.fn().mockResolvedValue(createTaskRecord({ version: 2, status: 'done' })),
    list: vi.fn().mockResolvedValue([createTaskRecord()]),
    ...taskRepository,
  };

  const projectRepo: ProjectRepository = {
    findById: vi.fn().mockResolvedValue(createProjectRecord()),
    findByCode: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
    ...projectRepository,
  };

  return {
    service: new TaskService({ taskRepository: taskRepo, projectRepository: projectRepo }),
    taskRepository: taskRepo,
    projectRepository: projectRepo,
  };
}

describe('TaskService', () => {
  it('createTask creates task with trimmed title', async () => {
    const { service, taskRepository } = createTaskService();

    const result = await service.createTask(
      ORG_ID,
      PROJECT_ID,
      { title: '  Design homepage  ' },
      USER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe('Design homepage');
      expect(result.value.status).toBe('todo');
    }

    expect(taskRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        title: 'Design homepage',
        createdBy: USER_ID,
      }),
    );
  });

  it('createTask rejects empty title', async () => {
    const { service } = createTaskService();

    const result = await service.createTask(ORG_ID, PROJECT_ID, { title: '   ' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('createTask returns not found when project is missing', async () => {
    const { service } = createTaskService(
      {},
      { findById: vi.fn().mockResolvedValue(null) },
    );

    const result = await service.createTask(ORG_ID, PROJECT_ID, { title: 'Design homepage' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it('getTask returns not found for missing task', async () => {
    const { service } = createTaskService();

    const result = await service.getTask(ORG_ID, PROJECT_ID, TASK_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it('updateTask enforces optimistic version check', async () => {
    const { service } = createTaskService({
      findById: vi.fn().mockResolvedValue(createTaskRecord({ version: 2 })),
    });

    const result = await service.updateTask(
      ORG_ID,
      PROJECT_ID,
      TASK_ID,
      { title: 'Updated', version: 1 },
      USER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });

  it('listTasks returns not found when project is missing', async () => {
    const { service } = createTaskService(
      {},
      { findById: vi.fn().mockResolvedValue(null) },
    );

    const result = await service.listTasks(ORG_ID, PROJECT_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it('listTasks returns tasks for existing project', async () => {
    const { service } = createTaskService();

    const result = await service.listTasks(ORG_ID, PROJECT_ID, { limit: 50 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data).toHaveLength(1);
      expect(result.value.data[0]?.title).toBe('Design homepage');
      expect(result.value.nextCursor).toBeNull();
    }
  });
});