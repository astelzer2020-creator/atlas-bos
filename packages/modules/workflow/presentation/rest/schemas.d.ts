import { z } from 'zod';
export declare const organizationParamsSchema: z.ZodObject<{
    organizationId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    organizationId: string;
}, {
    organizationId: string;
}>;
export declare const workflowDefinitionParamsSchema: z.ZodObject<{
    organizationId: z.ZodString;
    workflowDefinitionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    workflowDefinitionId: string;
    organizationId: string;
}, {
    workflowDefinitionId: string;
    organizationId: string;
}>;
export declare const workflowInstanceParamsSchema: z.ZodObject<{
    organizationId: z.ZodString;
    workflowInstanceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    organizationId: string;
    workflowInstanceId: string;
}, {
    organizationId: string;
    workflowInstanceId: string;
}>;
export declare const approvalParamsSchema: z.ZodObject<{
    organizationId: z.ZodString;
    approvalId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    organizationId: string;
    approvalId: string;
}, {
    organizationId: string;
    approvalId: string;
}>;
export declare const paginationQuerySchema: z.ZodEffects<z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    cursor?: string | undefined;
}, {
    cursor?: string | undefined;
    limit?: number | undefined;
}>, {
    cursor?: string;
    limit: number;
}, {
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
export declare const listWorkflowDefinitionsQuerySchema: z.ZodEffects<z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
} & {
    status: z.ZodOptional<z.ZodEnum<["draft", "published", "deprecated", "archived"]>>;
    category: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    status?: "draft" | "archived" | "published" | "deprecated" | undefined;
    cursor?: string | undefined;
    category?: string | undefined;
}, {
    status?: "draft" | "archived" | "published" | "deprecated" | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
    category?: string | undefined;
}>, {
    category?: string;
    status?: "draft" | "archived" | "published" | "deprecated";
    cursor?: string;
    limit: number;
}, {
    status?: "draft" | "archived" | "published" | "deprecated" | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
    category?: string | undefined;
}>;
export declare const createWorkflowDefinitionBodySchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    graph_definition: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    input_schema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    output_schema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    is_template: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    slug: string;
    description?: string | undefined;
    category?: string | undefined;
    graph_definition?: Record<string, unknown> | undefined;
    input_schema?: Record<string, unknown> | undefined;
    output_schema?: Record<string, unknown> | undefined;
    is_template?: boolean | undefined;
}, {
    name: string;
    slug: string;
    description?: string | undefined;
    category?: string | undefined;
    graph_definition?: Record<string, unknown> | undefined;
    input_schema?: Record<string, unknown> | undefined;
    output_schema?: Record<string, unknown> | undefined;
    is_template?: boolean | undefined;
}>, {
    isTemplate?: boolean;
    outputSchema?: Record<string, unknown>;
    inputSchema?: Record<string, unknown>;
    graphDefinition?: Record<string, unknown>;
    category?: string;
    description?: string;
    name: string;
    slug: string;
}, {
    name: string;
    slug: string;
    description?: string | undefined;
    category?: string | undefined;
    graph_definition?: Record<string, unknown> | undefined;
    input_schema?: Record<string, unknown> | undefined;
    output_schema?: Record<string, unknown> | undefined;
    is_template?: boolean | undefined;
}>;
export declare const updateWorkflowDefinitionBodySchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    graph_definition: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    sla_policies: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    input_schema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    output_schema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    graph_definition?: Record<string, unknown> | undefined;
    input_schema?: Record<string, unknown> | undefined;
    output_schema?: Record<string, unknown> | undefined;
    sla_policies?: Record<string, unknown> | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    graph_definition?: Record<string, unknown> | undefined;
    input_schema?: Record<string, unknown> | undefined;
    output_schema?: Record<string, unknown> | undefined;
    sla_policies?: Record<string, unknown> | undefined;
}>, {
    outputSchema?: Record<string, unknown>;
    inputSchema?: Record<string, unknown>;
    slaPolicies?: Record<string, unknown>;
    graphDefinition?: Record<string, unknown>;
    description?: string | null;
    name?: string;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    graph_definition?: Record<string, unknown> | undefined;
    input_schema?: Record<string, unknown> | undefined;
    output_schema?: Record<string, unknown> | undefined;
    sla_policies?: Record<string, unknown> | undefined;
}>;
export declare const listWorkflowInstancesQuerySchema: z.ZodEffects<z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
} & {
    status: z.ZodOptional<z.ZodEnum<["running", "waiting", "completed", "failed", "cancelled", "compensating", "suspended"]>>;
    definition_id: z.ZodOptional<z.ZodString>;
    entity_type: z.ZodOptional<z.ZodString>;
    entity_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    status?: "completed" | "failed" | "running" | "waiting" | "cancelled" | "compensating" | "suspended" | undefined;
    definition_id?: string | undefined;
    entity_type?: string | undefined;
    entity_id?: string | undefined;
    cursor?: string | undefined;
}, {
    status?: "completed" | "failed" | "running" | "waiting" | "cancelled" | "compensating" | "suspended" | undefined;
    definition_id?: string | undefined;
    entity_type?: string | undefined;
    entity_id?: string | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
}>, {
    entityId?: string;
    entityType?: string;
    definitionId?: string;
    status?: "completed" | "failed" | "running" | "waiting" | "cancelled" | "compensating" | "suspended";
    cursor?: string;
    limit: number;
}, {
    status?: "completed" | "failed" | "running" | "waiting" | "cancelled" | "compensating" | "suspended" | undefined;
    definition_id?: string | undefined;
    entity_type?: string | undefined;
    entity_id?: string | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
export declare const getWorkflowInstanceQuerySchema: z.ZodEffects<z.ZodObject<{
    include_steps: z.ZodDefault<z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"true">, z.ZodLiteral<"false">, z.ZodBoolean]>>>;
}, "strip", z.ZodTypeAny, {
    include_steps: boolean | "true" | "false";
}, {
    include_steps?: boolean | "true" | "false" | undefined;
}>, {
    includeSteps: boolean;
}, {
    include_steps?: boolean | "true" | "false" | undefined;
}>;
export declare const startWorkflowInstanceBodySchema: z.ZodEffects<z.ZodObject<{
    definition_id: z.ZodString;
    entity_type: z.ZodOptional<z.ZodString>;
    entity_id: z.ZodOptional<z.ZodString>;
    correlation_id: z.ZodOptional<z.ZodString>;
    input_payload: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    context_variables: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    definition_id: string;
    entity_type?: string | undefined;
    entity_id?: string | undefined;
    correlation_id?: string | undefined;
    input_payload?: Record<string, unknown> | undefined;
    context_variables?: Record<string, unknown> | undefined;
}, {
    definition_id: string;
    entity_type?: string | undefined;
    entity_id?: string | undefined;
    correlation_id?: string | undefined;
    input_payload?: Record<string, unknown> | undefined;
    context_variables?: Record<string, unknown> | undefined;
}>, {
    contextVariables?: Record<string, unknown>;
    inputPayload?: Record<string, unknown>;
    correlationId?: string;
    entityId?: string;
    entityType?: string;
    definitionId: string;
}, {
    definition_id: string;
    entity_type?: string | undefined;
    entity_id?: string | undefined;
    correlation_id?: string | undefined;
    input_payload?: Record<string, unknown> | undefined;
    context_variables?: Record<string, unknown> | undefined;
}>;
export declare const cancelWorkflowInstanceBodySchema: z.ZodEffects<z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason?: string | undefined;
}, {
    reason?: string | undefined;
}>, {
    reason?: string;
}, {
    reason?: string | undefined;
}>;
export declare const listWorkflowApprovalsQuerySchema: z.ZodEffects<z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
} & {
    status: z.ZodOptional<z.ZodEnum<["pending", "approved", "rejected", "expired", "delegated", "cancelled"]>>;
    instance_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    status?: "pending" | "expired" | "cancelled" | "approved" | "rejected" | "delegated" | undefined;
    cursor?: string | undefined;
    instance_id?: string | undefined;
}, {
    status?: "pending" | "expired" | "cancelled" | "approved" | "rejected" | "delegated" | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
    instance_id?: string | undefined;
}>, {
    instanceId?: string;
    status?: "pending" | "expired" | "cancelled" | "approved" | "rejected" | "delegated";
    cursor?: string;
    limit: number;
}, {
    status?: "pending" | "expired" | "cancelled" | "approved" | "rejected" | "delegated" | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
    instance_id?: string | undefined;
}>;
export declare const approveWorkflowStepBodySchema: z.ZodEffects<z.ZodObject<{
    resolution_note: z.ZodOptional<z.ZodString>;
    form_data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    resolution_note?: string | undefined;
    form_data?: Record<string, unknown> | undefined;
}, {
    resolution_note?: string | undefined;
    form_data?: Record<string, unknown> | undefined;
}>, {
    formData?: Record<string, unknown>;
    resolutionNote?: string;
}, {
    resolution_note?: string | undefined;
    form_data?: Record<string, unknown> | undefined;
}>;
export declare const rejectWorkflowStepBodySchema: z.ZodEffects<z.ZodObject<{
    resolution_note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    resolution_note: string;
}, {
    resolution_note: string;
}>, {
    resolutionNote: string;
}, {
    resolution_note: string;
}>;
export declare function parseIfMatchHeader(value: string | string[] | undefined): number | null;
//# sourceMappingURL=schemas.d.ts.map