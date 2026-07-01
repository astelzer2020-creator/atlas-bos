import type { OrganizationId, UserId } from '@atlas/shared-kernel';

import type { ProjectPriority } from './project.repository.js';

export type TaskStatus =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'blocked'
  | 'done'
  | 'cancelled';

export interface ProjectTaskRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly projectId: string;
  readonly parentTaskId: string | null;
  readonly assigneeId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly status: TaskStatus;
  readonly priority: ProjectPriority;
  readonly dueDate: Date | null;
  readonly completedAt: Date | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly version: number;
}

export interface CreateProjectTaskData {
  readonly organizationId: OrganizationId;
  readonly projectId: string;
  readonly title: string;
  readonly parentTaskId?: string;
  readonly assigneeId?: string;
  readonly description?: string;
  readonly status?: TaskStatus;
  readonly priority?: ProjectPriority;
  readonly dueDate?: Date;
  readonly metadata?: Record<string, unknown>;
  readonly createdBy?: UserId;
}

export interface UpdateProjectTaskData {
  readonly parentTaskId?: string | null;
  readonly assigneeId?: string | null;
  readonly title?: string;
  readonly description?: string | null;
  readonly status?: TaskStatus;
  readonly priority?: ProjectPriority;
  readonly dueDate?: Date | null;
  readonly completedAt?: Date | null;
  readonly metadata?: Record<string, unknown>;
  readonly updatedBy?: UserId;
}

export interface ListProjectTasksFilter {
  readonly organizationId: OrganizationId;
  readonly projectId: string;
  readonly limit: number;
  readonly cursor?: string;
  readonly status?: TaskStatus;
  readonly assigneeId?: string;
}

export interface ProjectTaskRepository {
  findById(
    organizationId: OrganizationId,
    projectId: string,
    id: string,
  ): Promise<ProjectTaskRecord | null>;
  create(data: CreateProjectTaskData): Promise<ProjectTaskRecord>;
  update(
    organizationId: OrganizationId,
    projectId: string,
    id: string,
    data: UpdateProjectTaskData,
    expectedVersion: number,
  ): Promise<ProjectTaskRecord | null>;
  list(filter: ListProjectTasksFilter): Promise<ProjectTaskRecord[]>;
}