import { z } from 'zod';

export const createWorkspaceBodySchema = z.object({
  slug: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  display_name: z.string().max(255).optional(),
});

export const createOrganizationBodySchema = z.object({
  workspace_id: z.string().uuid(),
  slug: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  display_name: z.string().max(255).optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  currency_code: z.string().length(3).optional(),
  data_region: z.string().optional(),
});

export const updateOrganizationBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  display_name: z.string().max(255).nullable().optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  currency_code: z.string().length(3).optional(),
  status: z.enum(['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED']).optional(),
});

export const createTeamBodySchema = z.object({
  slug: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  parent_team_id: z.string().uuid().optional(),
});

export const addTeamMemberBodySchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['LEAD', 'MEMBER']).default('MEMBER'),
});

export const updateUserBodySchema = z.object({
  display_name: z.string().min(1).max(255).optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  avatar_url: z.string().url().nullable().optional(),
});

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
  workspace_id: z.string().uuid().optional(),
  status: z.enum(['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED']).optional(),
  parent_team_id: z.string().uuid().optional(),
});

export const organizationParamsSchema = z.object({
  organization_id: z.string().uuid(),
});

export const teamParamsSchema = z.object({
  organization_id: z.string().uuid(),
  team_id: z.string().uuid(),
});

export const workspaceParamsSchema = z.object({
  workspace_id: z.string().uuid(),
});