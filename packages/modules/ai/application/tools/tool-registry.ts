export interface AgentToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

export interface AgentToolInvocation {
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

export interface AgentToolResult {
  readonly name: string;
  readonly output: unknown;
  readonly error?: string;
}

export interface AgentToolHandler {
  readonly definition: AgentToolDefinition;
  execute(args: Record<string, unknown>): Promise<unknown>;
}

export class AgentToolRegistry {
  private readonly handlers = new Map<string, AgentToolHandler>();

  register(handler: AgentToolHandler): void {
    this.handlers.set(handler.definition.name, handler);
  }

  listDefinitions(): AgentToolDefinition[] {
    return [...this.handlers.values()].map((handler) => handler.definition);
  }

  async invoke(invocation: AgentToolInvocation): Promise<AgentToolResult> {
    const handler = this.handlers.get(invocation.name);

    if (handler === undefined) {
      return {
        name: invocation.name,
        output: null,
        error: `Unknown tool: ${invocation.name}`,
      };
    }

    try {
      const output = await handler.execute(invocation.arguments);
      return { name: invocation.name, output };
    } catch (error) {
      return {
        name: invocation.name,
        output: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export function createDefaultToolRegistry(): AgentToolRegistry {
  const registry = new AgentToolRegistry();

  registry.register({
    definition: {
      name: 'get_current_time',
      description: 'Returns the current UTC timestamp in ISO 8601 format.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
    execute: async () => new Date().toISOString(),
  });

  registry.register({
    definition: {
      name: 'echo',
      description: 'Returns the input message unchanged.',
      parameters: {
        type: 'object',
        properties: { message: { type: 'string' } },
        required: ['message'],
      },
    },
    execute: async (args) => {
      const message = args.message;
      if (typeof message !== 'string') {
        throw new Error('message must be a string');
      }
      return message;
    },
  });

  return registry;
}