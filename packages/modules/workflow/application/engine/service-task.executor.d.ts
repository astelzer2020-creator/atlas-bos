export interface ServiceTaskContext {
    readonly organizationId: string;
    readonly instanceId: string;
    readonly nodeId: string;
    readonly nodeName?: string;
    readonly config: Record<string, unknown>;
}
export interface ServiceTaskResult {
    readonly service: string;
    readonly executed: boolean;
    readonly executedAt: string;
    readonly output?: Record<string, unknown>;
    readonly error?: string;
}
/**
 * Executes workflow service_task nodes based on `config.service` (defaults to `noop`).
 */
export declare function executeServiceTask(context: ServiceTaskContext): Promise<ServiceTaskResult>;
//# sourceMappingURL=service-task.executor.d.ts.map