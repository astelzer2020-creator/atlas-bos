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

import type { ProjectRepository } from '../../domain/repositories/project.repository.js';
import type {
  CreateProjectTaskData,
  ProjectTaskRecord,
  ProjectTaskRepository,
  TaskStatus,
  UpdateProjectTaskData,
} from '../../domain/repositories/task.repository.js';
import type { ProjectPriority } from '../../domain/repositories/project.repository.js';
import { resolveListLimit, type CursorPageResult } from '../../domain/types/pagination.js';

export interface TaskDto {
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly parentTaskId: string | null;
  readonly assigneeId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly status: TaskStatus;
  readonly priority: ProjectPriority;
  readonly dueDate: string | null;
  readonly completedAt: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly version: number;
}

export interface CreateTaskInput {
  readonly title: string;
  readonly parentTaskId?: string;
  readonly assigneeId?: string;
  readonly description?: string;
  readonly status?: TaskStatus;
  readonly priority?: ProjectPriority;
  readonly dueDate?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateTaskInput {
  readonly parentTaskId?: string | null;
  readonly assigneeId?: string | null;
  readonly title?: string;
  readonly description?: string | null;
  readonly status?: TaskStatus;
  readonly priority?: ProjectPriority;
  readonly dueDate?: string | null;
  readonly completedAt?: string | null;
  readonly metadata?: Record<string, unknown>;
  readonly version: number;
}

export interface ListTasksInput {
  readonly limit?: number;
  readonly cursor?: string;
  readonly status?: TaskStatus;
  readonly assigneeId?: string;
}

export interface TaskServiceDeps {
  readonly taskRepository: ProjectTaskRepository;
  readonly projectRepository: ProjectRepository;
}

function parseDateTime(value: string, field: string): Result<Date, ValidationError> {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return err(new ValidationError(`Invalid date-time for ${field}`, { field }));
  }
  return ok(parsed);
}

export class TaskService {
  constructor(private readonly deps: TaskServiceDeps) {}

  async createTask(
    organizationId: OrganizationId,
    projectId: string,
    input: CreateTaskInput,
    actorId?: UserId,
  ): Promise<Result<TaskDto, ValidationError | NotFoundError>> {
    const project = await this.deps.projectRepository.findById(organizationId, projectId);
    if (project === null) {
      return err(new NotFoundError('Project', projectId));
    }

    const title = input.title.trim();
    if (title.length === 0) {
      return err(new ValidationError('Task title is required', { field: 'title' }));
    }

    if (input.parentTaskId !== undefined) {
      const parent = await this.deps.taskRepository.findById(
        organizationId,
        projectId,
        input.parentTaskId,
      );
      if (parent === null) {
        return err(
          new ValidationError('Parent task not found in project', { field: 'parentTaskId' }),
        );
      }
    }

    let dueDate: Date | undefined;
    if (input.dueDate !== undefined) {
      const dueDateResult = parseDateTime(input.dueDate, 'dueDate');
      if (!dueDateResult.ok) {
        return dueDateResult;
      }
      dueDate = dueDateResult.value;
    }

    const createData: CreateProjectTaskData = {
      organizationId,
      projectId,
      title,
      ...(input.parentTaskId !== undefined ? { parentTaskId: input.parentTaskId } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(dueDate !== undefined ? { dueDate } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(actorId !== undefined ? { createdBy: actorId } : {}),
    };

    const task = await this.deps.taskRepository.create(createData);
    return ok(this.toDto(task));
  }

  async getTask(
    organizationId: OrganizationId,
    projectId: string,
    taskId: string,
  ): Promise<Result<TaskDto, NotFoundError>> {
    const task = await this.deps.taskRepository.findById(organizationId, projectId, taskId);
    if (task === null) {
      return err(new NotFoundError('Task', taskId));
    }
    return ok(this.toDto(task));
  }

  async updateTask(
    organizationId: OrganizationId,
    projectId: string,
    taskId: string,
    input: UpdateTaskInput,
    actorId?: UserId,
  ): Promise<Result<TaskDto, ValidationError | NotFoundError | ConflictError>> {
    const existing = await this.deps.taskRepository.findById(organizationId, projectId, taskId);
    if (existing === null) {
      return err(new NotFoundError('Task', taskId));
    }

    if (input.version !== existing.version) {
      return err(
        new ConflictError('Task version mismatch', {
          details: { expected: input.version, actual: existing.version },
        }),
      );
    }

    if (input.title !== undefined && input.title.trim().length === 0) {
      return err(new ValidationError('Task title cannot be empty', { field: 'title' }));
    }

    if (input.parentTaskId !== undefined && input.parentTaskId !== null) {
      if (input.parentTaskId === taskId) {
        return err(
          new ValidationError('Task cannot be its own parent', { field: 'parentTaskId' }),
        );
      }

      const parent = await this.deps.taskRepository.findById(
        organizationId,
        projectId,
        input.parentTaskId,
      );
      if (parent === null) {
        return err(
          new ValidationError('Parent task not found in project', { field: 'parentTaskId' }),
        );
      }
    }

    let dueDate: Date | null | undefined;
    if (input.dueDate !== undefined) {
      if (input.dueDate === null) {
        dueDate = null;
      } else {
        const dueDateResult = parseDateTime(input.dueDate, 'dueDate');
        if (!dueDateResult.ok) {
          return dueDateResult;
        }
        dueDate = dueDateResult.value;
      }
    }

    let completedAt: Date | null | undefined;
    if (input.completedAt !== undefined) {
      if (input.completedAt === null) {
        completedAt = null;
      } else {
        const completedAtResult = parseDateTime(input.completedAt, 'completedAt');
        if (!completedAtResult.ok) {
          return completedAtResult;
        }
        completedAt = completedAtResult.value;
      }
    } else if (input.status === 'done' && existing.completedAt === null) {
      completedAt = new Date();
    }

    const updateData: UpdateProjectTaskData = {
      ...(input.parentTaskId !== undefined ? { parentTaskId: input.parentTaskId } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(dueDate !== undefined ? { dueDate } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(actorId !== undefined ? { updatedBy: actorId } : {}),
    };

    const updated = await this.deps.taskRepository.update(
      organizationId,
      projectId,
      taskId,
      updateData,
      input.version,
    );

    if (updated === null) {
      return err(
        new ConflictError('Task was modified concurrently', {
          details: { id: taskId, expectedVersion: input.version },
        }),
      );
    }

    return ok(this.toDto(updated));
  }

  async listTasks(
    organizationId: OrganizationId,
    projectId: string,
    input: ListTasksInput = {},
  ): Promise<Result<CursorPageResult<TaskDto>, NotFoundError>> {
    const project = await this.deps.projectRepository.findById(organizationId, projectId);
    if (project === null) {
      return err(new NotFoundError('Project', projectId));
    }

    const limit = resolveListLimit(input.limit);

    const tasks = await this.deps.taskRepository.list({
      organizationId,
      projectId,
      limit,
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
    });

    return ok({
      data: tasks.map((task) => this.toDto(task)),
      nextCursor: tasks.length === limit ? (tasks.at(-1)?.id ?? null) : null,
    });
  }

  toDto(record: ProjectTaskRecord): TaskDto {
    return {
      id: record.id,
      organizationId: record.organizationId,
      projectId: record.projectId,
      parentTaskId: record.parentTaskId,
      assigneeId: record.assigneeId,
      title: record.title,
      description: record.description,
      status: record.status,
      priority: record.priority,
      dueDate: record.dueDate?.toISOString() ?? null,
      completedAt: record.completedAt?.toISOString() ?? null,
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