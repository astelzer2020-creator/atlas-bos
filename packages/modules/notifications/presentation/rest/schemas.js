import { z } from 'zod';
export const organizationParamsSchema = z.object({
    organizationId: z.string().uuid(),
});
export const notificationParamsSchema = z.object({
    organizationId: z.string().uuid(),
    id: z.string().uuid(),
});
export const inboxQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().uuid().optional(),
    unread_only: z
        .union([z.literal('true'), z.literal('false')])
        .optional()
        .transform((value) => value === 'true'),
});
export const sendNotificationBodySchema = z.object({
    definition_id: z.string().min(1).max(128),
    category: z.enum(['transactional', 'operational', 'digest', 'alert', 'marketing']),
    recipient_user_id: z.string().uuid(),
    title: z.string().min(1).max(500),
    body: z.string().max(5000).optional(),
    action_url: z.string().url().optional(),
    entity_type: z.string().max(128).optional(),
    entity_id: z.string().uuid().optional(),
    payload: z.record(z.unknown()).optional(),
    locale: z.string().max(16).optional(),
    idempotency_key: z.string().min(1).max(255),
    priority: z.number().int().min(1).max(5).optional(),
    actor_user_id: z.string().uuid().optional(),
});
export const updatePreferencesBodySchema = z.object({
    preferences: z
        .array(z.object({
        definition_id: z.string().min(1).max(128),
        channel_type: z.enum(['in_app', 'email']),
        enabled: z.boolean(),
        digest_mode: z.enum(['instant', 'hourly', 'daily', 'weekly']).nullable().optional(),
    }))
        .min(1)
        .max(100),
});
//# sourceMappingURL=schemas.js.map