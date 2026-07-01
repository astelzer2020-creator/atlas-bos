import type { OrganizationId, UserId } from '@atlas/shared-kernel';

export type ProjectStatus =
  | 'planning'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'cancelled'
  | 'archived';

export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical';

export interface ProjectRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly workspaceId: string | null;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: ProjectStatus;
  readonly priority: ProjectPriority;
  readonly startDate: Date | null;
  readonly targetEndDate: Date | null;
  readonly progressPercent: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly version: number;
}

export interface CreateProjectData {
  readonly organizationId: OrganizationId;
  readonly code: string;
  readonly name: string;
  readonly workspaceId?: string;
  readonly description?: string;
  readonly status?: ProjectStatus;
  readonly priority?: ProjectPriority;
  readonly startDate?: Date;
  readonly targetEndDate?: Date;
  readonly metadata?: Record<string, unknown>;
  readonly createdBy?: UserId;
}

export interface UpdateProjectData {
  readonly workspaceId?: string | null;
  readonly code?: string;
  readonly name?: string;
  readonly description?: string | null;
  readonly status?: ProjectStatus;
  readonly priority?: ProjectPriority;
  readonly startDate?: Date | null;
  readonly targetEndDate?: Date | null;
  readonly progressPercent?: string;
  readonly metadata?: Record<string, unknown>;
  readonly updatedBy?: UserId;
}

export interface ListProjectsFilter {
  readonly organizationId: OrganizationId;
  readonly limit: number;
  readonly cursor?: string;
  readonly status?: ProjectStatus;
  readonly priority?: ProjectPriority;
  readonly workspaceId?: string;
}

export interface ProjectRepository {
  findById(organizationId: OrganizationId, id: string): Promise<ProjectRecord | null>;
  findByCode(organizationId: OrganizationId, code: string): Promise<ProjectRecord | null>;
  create(data: CreateProjectData): Promise<ProjectRecord>;
  update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateProjectData,
    expectedVersion: number,
  ): Promise<ProjectRecord | null>;
  list(filter: ListProjectsFilter): Promise<ProjectRecord[]>;
}