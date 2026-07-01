import { z } from 'zod';
export declare const organizationParamsSchema: z.ZodObject<{
    organizationId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    organizationId: string;
}, {
    organizationId: string;
}>;
export declare const notificationParamsSchema: z.ZodObject<{
    organizationId: z.ZodString;
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    organizationId: string;
}, {
    id: string;
    organizationId: string;
}>;
export declare const inboxQuerySchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodNumber>;
    cursor: z.ZodOptional<z.ZodString>;
    unread_only: z.ZodEffects<z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"true">, z.ZodLiteral<"false">]>>, boolean, "true" | "false" | undefined>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    unread_only: boolean;
    cursor?: string | undefined;
}, {
    cursor?: string | undefined;
    limit?: number | undefined;
    unread_only?: "true" | "false" | undefined;
}>;
export declare const sendNotificationBodySchema: z.ZodObject<{
    definition_id: z.ZodString;
    category: z.ZodEnum<["transactional", "operational", "digest", "alert", "marketing"]>;
    recipient_user_id: z.ZodString;
    title: z.ZodString;
    body: z.ZodOptional<z.ZodString>;
    action_url: z.ZodOptional<z.ZodString>;
    entity_type: z.ZodOptional<z.ZodString>;
    entity_id: z.ZodOptional<z.ZodString>;
    payload: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    locale: z.ZodOptional<z.ZodString>;
    idempotency_key: z.ZodString;
    priority: z.ZodOptional<z.ZodNumber>;
    actor_user_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    recipient_user_id: string;
    title: string;
    definition_id: string;
    idempotency_key: string;
    category: "transactional" | "operational" | "digest" | "alert" | "marketing";
    payload?: Record<string, unknown> | undefined;
    body?: string | undefined;
    entity_type?: string | undefined;
    entity_id?: string | undefined;
    locale?: string | undefined;
    priority?: number | undefined;
    action_url?: string | undefined;
    actor_user_id?: string | undefined;
}, {
    recipient_user_id: string;
    title: string;
    definition_id: string;
    idempotency_key: string;
    category: "transactional" | "operational" | "digest" | "alert" | "marketing";
    payload?: Record<string, unknown> | undefined;
    body?: string | undefined;
    entity_type?: string | undefined;
    entity_id?: string | undefined;
    locale?: string | undefined;
    priority?: number | undefined;
    action_url?: string | undefined;
    actor_user_id?: string | undefined;
}>;
export declare const updatePreferencesBodySchema: z.ZodObject<{
    preferences: z.ZodArray<z.ZodObject<{
        definition_id: z.ZodString;
        channel_type: z.ZodEnum<["in_app", "email"]>;
        enabled: z.ZodBoolean;
        digest_mode: z.ZodOptional<z.ZodNullable<z.ZodEnum<["instant", "hourly", "daily", "weekly"]>>>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        definition_id: string;
        channel_type: "email" | "in_app";
        digest_mode?: "instant" | "hourly" | "daily" | "weekly" | null | undefined;
    }, {
        enabled: boolean;
        definition_id: string;
        channel_type: "email" | "in_app";
        digest_mode?: "instant" | "hourly" | "daily" | "weekly" | null | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    preferences: {
        enabled: boolean;
        definition_id: string;
        channel_type: "email" | "in_app";
        digest_mode?: "instant" | "hourly" | "daily" | "weekly" | null | undefined;
    }[];
}, {
    preferences: {
        enabled: boolean;
        definition_id: string;
        channel_type: "email" | "in_app";
        digest_mode?: "instant" | "hourly" | "daily" | "weekly" | null | undefined;
    }[];
}>;
//# sourceMappingURL=schemas.d.ts.map