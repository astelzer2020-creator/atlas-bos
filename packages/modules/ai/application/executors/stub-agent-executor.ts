import type { AgentExecutor, AgentExecutionContext, AgentExecutionResult } from './agent-executor.js';

export const STUB_RUN_RESULT_SUMMARY = 'Run completed (stub executor)';

export class StubAgentExecutor implements AgentExecutor {
  readonly name = 'stub';

  async execute(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    return {
      status: 'completed',
      resultSummary: STUB_RUN_RESULT_SUMMARY,
      resultPayload: {
        executor: this.name,
        goal: context.run.goal,
        completedAt: new Date().toISOString(),
      },
      costCents: 0,
      llmInputTokens: 0n,
      llmOutputTokens: 0n,
    };
  }
}