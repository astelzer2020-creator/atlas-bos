import { describe, expect, it } from 'vitest';

import { executeServiceTask } from '../application/engine/service-task.executor.js';

describe('executeServiceTask', () => {
  it('executes noop service tasks by default', async () => {
    const result = await executeServiceTask({
      organizationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      instanceId: '6fa459ea-ee8a-3ca4-894e-db77e160355e',
      nodeId: 'notify',
      config: {},
    });

    expect(result.executed).toBe(true);
    expect(result.service).toBe('noop');
  });

  it('validates notify service task configuration', async () => {
    const result = await executeServiceTask({
      organizationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      instanceId: '6fa459ea-ee8a-3ca4-894e-db77e160355e',
      nodeId: 'notify',
      config: { service: 'notify', title: 'Approval required' },
    });

    expect(result.executed).toBe(true);
    expect(result.output).toEqual(
      expect.objectContaining({ title: 'Approval required' }),
    );
  });
});