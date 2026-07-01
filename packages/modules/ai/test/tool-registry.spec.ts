import { describe, expect, it } from 'vitest';

import { createDefaultToolRegistry } from '../application/tools/tool-registry.js';

describe('AgentToolRegistry', () => {
  it('lists built-in tool definitions', () => {
    const registry = createDefaultToolRegistry();
    const names = registry.listDefinitions().map((tool) => tool.name);

    expect(names).toContain('get_current_time');
    expect(names).toContain('echo');
  });

  it('invokes echo tool with arguments', async () => {
    const registry = createDefaultToolRegistry();

    const result = await registry.invoke({
      name: 'echo',
      arguments: { message: 'hello atlas' },
    });

    expect(result.error).toBeUndefined();
    expect(result.output).toBe('hello atlas');
  });

  it('returns error for unknown tools', async () => {
    const registry = createDefaultToolRegistry();

    const result = await registry.invoke({
      name: 'missing_tool',
      arguments: {},
    });

    expect(result.error).toContain('Unknown tool');
  });
});