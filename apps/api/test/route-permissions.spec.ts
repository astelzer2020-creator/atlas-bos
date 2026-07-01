import { describe, expect, it } from 'vitest';

import { resolveRoutePermission } from '../src/middleware/route-permissions.js';

describe('resolveRoutePermission', () => {
  it('maps CRM contact reads to crm:contacts:read', () => {
    expect(
      resolveRoutePermission(
        'GET',
        '/v1/organizations/00000000-0000-4000-8000-000000000001/contacts',
      ),
    ).toBe('crm:contacts:read');
  });

  it('maps CRM contact writes to crm:contacts:write', () => {
    expect(
      resolveRoutePermission(
        'POST',
        '/v1/organizations/00000000-0000-4000-8000-000000000001/contacts',
      ),
    ).toBe('crm:contacts:write');
  });

  it('maps agent run creation to ai:agents:execute', () => {
    expect(
      resolveRoutePermission(
        'POST',
        '/v1/organizations/00000000-0000-4000-8000-000000000001/agent-runs',
      ),
    ).toBe('ai:agents:execute');
  });

  it('maps organization settings updates to platform:settings:manage', () => {
    expect(
      resolveRoutePermission(
        'PATCH',
        '/v1/organizations/00000000-0000-4000-8000-000000000001',
      ),
    ).toBe('platform:settings:manage');
  });

  it('returns null for routes with membership-only access', () => {
    expect(
      resolveRoutePermission(
        'GET',
        '/v1/organizations/00000000-0000-4000-8000-000000000001/audit-log',
      ),
    ).toBeNull();
  });
});