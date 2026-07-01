import { z } from 'zod';

const auditActionSchema = z.enum([
  'CREATE',
  'UPDATE',
  'DELETE',
  'RESTORE',
  'ACCESS',
  'EXPORT',
  'PERMISSION_CHANGE',
]);

export const organizationAuditParamsSchema = z.object({
  organizationId: z.string().uuid(),
});

export const entityAuditParamsSchema = z.object({
  organizationId: z.string().uuid(),
  entityType: z.string().min(1).max(128),
  entityId: z.string().uuid(),
});

export const auditLogQuerySchema = z
  .object({
    entity_type: z.string().min(1).max(128).optional(),
    entity_id: z.string().uuid().optional(),
    actor_id: z.string().uuid().optional(),
    action: auditActionSchema.optional(),
    occurred_from: z.string().datetime().optional(),
    occurred_to: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().regex(/^\d+$/).optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    ...(value.entity_type !== undefined ? { entityType: value.entity_type } : {}),
    ...(value.entity_id !== undefined ? { entityId: value.entity_id } : {}),
    ...(value.actor_id !== undefined ? { actorId: value.actor_id } : {}),
    ...(value.action !== undefined ? { action: value.action } : {}),
    ...(value.occurred_from !== undefined ? { occurredFrom: new Date(value.occurred_from) } : {}),
    ...(value.occurred_to !== undefined ? { occurredTo: new Date(value.occurred_to) } : {}),
    ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
  }));