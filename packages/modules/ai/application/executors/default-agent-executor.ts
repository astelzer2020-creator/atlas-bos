import type { AgentToolRegistry } from '../tools/tool-registry.js';
import type { AgentExecutor, AgentExecutionContext, AgentExecutionResult } from './agent-executor.js';

export const DEFAULT_RUN_RESULT_SUMMARY = 'Run completed successfully';

export interface DefaultAgentExecutorOptions {
  readonly toolRegistry: AgentToolRegistry;
}

/**
 * Executes agent runs by orchestrating registered tools against the run goal.
 */
export class DefaultAgentExecutor implements AgentExecutor {
  readonly name = 'tool-orchestration';

  constructor(private readonly options: DefaultAgentExecutorOptions) {}

  async execute(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    const toolResults = [];

    const timeResult = await this.options.toolRegistry.invoke({ name: 'get_current_time', arguments: {} });
    toolResults.push(timeResult);

    const echoResult = await this.options.toolRegistry.invoke({
      name: 'echo',
      arguments: { message: context.run.goal },
    });
    toolResults.push(echoResult);

    const failedTool = toolResults.find((result) => result.error !== undefined);

    if (failedTool !== undefined) {
      return {
        status: 'failed',
        resultSummary: `Tool execution failed: ${failedTool.name}`,
        resultPayload: {
          executor: this.name,
          goal: context.run.goal,
          tools: toolResults,
          failedAt: new Date().toISOString(),
        },
      };
    }

    return {
      status: 'completed',
      resultSummary: DEFAULT_RUN_RESULT_SUMMARY,
      resultPayload: {
        executor: this.name,
        goal: context.run.goal,
        tools: toolResults,
        completedAt: new Date().toISOString(),
      },
      costCents: 0,
      llmInputTokens: 0n,
      llmOutputTokens: 0n,
    };
  }
}