import { z } from 'zod';

const projectStatusSchema = z.enum([
  'planning',
  'active',
  'on_hold',
  'completed',
  'cancelled',
  'archived',
]);

const prioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

const taskStatusSchema = z.enum([
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'blocked',
  'done',
  'cancelled',
]);

export const organizationParamsSchema = z.object({
  organizationId: z.string().uuid(),
});

export const projectParamsSchema = z.object({
  organizationId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export const taskParamsSchema = z.object({
  organizationId: z.string().uuid(),
  projectId: z.string().uuid(),
  taskId: z.string().uuid(),
});

const paginationQueryBase = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const listProjectsQuerySchema = paginationQueryBase
  .extend({
    status: projectStatusSchema.optional(),
    priority: prioritySchema.optional(),
    workspaceId: z.string().uuid().optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.priority !== undefined ? { priority: value.priority } : {}),
    ...(value.workspaceId !== undefined ? { workspaceId: value.workspaceId } : {}),
  }));

export const createProjectBodySchema = z
  .object({
    code: z.string().min(1).max(64),
    name: z.string().min(1).max(256),
    workspaceId: z.string().uuid().optional(),
    description: z.string().max(4096).optional(),
    status: projectStatusSchema.optional(),
    priority: prioritySchema.optional(),
    startDate: z.string().optional(),
    targetEndDate: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    code: value.code,
    name: value.name,
    ...(value.workspaceId !== undefined ? { workspaceId: value.workspaceId } : {}),
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.priority !== undefined ? { priority: value.priority } : {}),
    ...(value.startDate !== undefined ? { startDate: value.startDate } : {}),
    ...(value.targetEndDate !== undefined ? { targetEndDate: value.targetEndDate } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));

export const updateProjectBodySchema = z
  .object({
    version: z.number().int().min(1),
    workspaceId: z.string().uuid().nullable().optional(),
    code: z.string().min(1).max(64).optional(),
    name: z.string().min(1).max(256).optional(),
    description: z.string().max(4096).nullable().optional(),
    status: projectStatusSchema.optional(),
    priority: prioritySchema.optional(),
    startDate: z.string().nullable().optional(),
    targetEndDate: z.string().nullable().optional(),
    progressPercent: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    version: value.version,
    ...(value.workspaceId !== undefined ? { workspaceId: value.workspaceId } : {}),
    ...(value.code !== undefined ? { code: value.code } : {}),
    ...(value.name !== undefined ? { name: value.name } : {}),
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.priority !== undefined ? { priority: value.priority } : {}),
    ...(value.startDate !== undefined ? { startDate: value.startDate } : {}),
    ...(value.targetEndDate !== undefined ? { targetEndDate: value.targetEndDate } : {}),
    ...(value.progressPercent !== undefined ? { progressPercent: value.progressPercent } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));

export const listTasksQuerySchema = paginationQueryBase
  .extend({
    status: taskStatusSchema.optional(),
    assigneeId: z.string().uuid().optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.assigneeId !== undefined ? { assigneeId: value.assigneeId } : {}),
  }));

export const createTaskBodySchema = z
  .object({
    title: z.string().min(1).max(512),
    parentTaskId: z.string().uuid().optional(),
    assigneeId: z.string().uuid().optional(),
    description: z.string().max(4096).optional(),
    status: taskStatusSchema.optional(),
    priority: prioritySchema.optional(),
    dueDate: z.string().datetime().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    title: value.title,
    ...(value.parentTaskId !== undefined ? { parentTaskId: value.parentTaskId } : {}),
    ...(value.assigneeId !== undefined ? { assigneeId: value.assigneeId } : {}),
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.priority !== undefined ? { priority: value.priority } : {}),
    ...(value.dueDate !== undefined ? { dueDate: value.dueDate } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));

export const updateTaskBodySchema = z
  .object({
    version: z.number().int().min(1),
    parentTaskId: z.string().uuid().nullable().optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    title: z.string().min(1).max(512).optional(),
    description: z.string().max(4096).nullable().optional(),
    status: taskStatusSchema.optional(),
    priority: prioritySchema.optional(),
    dueDate: z.string().datetime().nullable().optional(),
    completedAt: z.string().datetime().nullable().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    version: value.version,
    ...(value.parentTaskId !== undefined ? { parentTaskId: value.parentTaskId } : {}),
    ...(value.assigneeId !== undefined ? { assigneeId: value.assigneeId } : {}),
    ...(value.title !== undefined ? { title: value.title } : {}),
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.priority !== undefined ? { priority: value.priority } : {}),
    ...(value.dueDate !== undefined ? { dueDate: value.dueDate } : {}),
    ...(value.completedAt !== undefined ? { completedAt: value.completedAt } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));