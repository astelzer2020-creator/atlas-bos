const WEBHOOK_TIMEOUT_MS = 10_000;
async function executeWebhook(config) {
    const url = config.url;
    const method = (typeof config.method === 'string' ? config.method.toUpperCase() : 'POST');
    const body = config.body;
    if (typeof url !== 'string' || url.length === 0) {
        return {
            service: 'webhook',
            executed: false,
            executedAt: new Date().toISOString(),
            error: 'config.url is required for webhook service tasks',
        };
    }
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error('Only http and https URLs are supported');
        }
        const requestBody = body !== undefined
            ? JSON.stringify(body)
            : method === 'GET' || method === 'HEAD'
                ? null
                : '{}';
        const response = await fetch(url, {
            method,
            headers: {
                'content-type': 'application/json',
                'user-agent': 'atlas-workflow/1.0',
            },
            ...(requestBody !== null ? { body: requestBody } : {}),
            signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        });
        const responseText = await response.text();
        return {
            service: 'webhook',
            executed: response.ok,
            executedAt: new Date().toISOString(),
            output: {
                status: response.status,
                statusText: response.statusText,
                body: responseText.slice(0, 2000),
            },
            ...(response.ok ? {} : { error: `Webhook returned HTTP ${String(response.status)}` }),
        };
    }
    catch (error) {
        return {
            service: 'webhook',
            executed: false,
            executedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
function executeNotify(config) {
    const title = config.title;
    const recipientUserId = config.recipient_user_id ?? config.recipientUserId;
    if (typeof title !== 'string' || title.trim().length === 0) {
        return {
            service: 'notify',
            executed: false,
            executedAt: new Date().toISOString(),
            error: 'config.title is required for notify service tasks',
        };
    }
    return {
        service: 'notify',
        executed: true,
        executedAt: new Date().toISOString(),
        output: {
            title,
            recipientUserId: typeof recipientUserId === 'string' ? recipientUserId : null,
            body: typeof config.body === 'string' ? config.body : null,
        },
    };
}
/**
 * Executes workflow service_task nodes based on `config.service` (defaults to `noop`).
 */
export async function executeServiceTask(context) {
    const service = typeof context.config.service === 'string' ? context.config.service : 'noop';
    const executedAt = new Date().toISOString();
    switch (service) {
        case 'webhook':
            return executeWebhook(context.config);
        case 'notify':
            return executeNotify(context.config);
        case 'noop':
            return {
                service: 'noop',
                executed: true,
                executedAt,
                output: {
                    nodeId: context.nodeId,
                    instanceId: context.instanceId,
                },
            };
        default:
            return {
                service,
                executed: false,
                executedAt,
                error: `Unknown service task type: ${service}`,
            };
    }
}
//# sourceMappingURL=service-task.executor.js.map