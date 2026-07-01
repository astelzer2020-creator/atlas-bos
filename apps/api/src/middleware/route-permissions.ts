/**
 * Maps HTTP method + path to RBAC permission codes.
 * Returns null when membership-only access is sufficient.
 */

export interface RoutePermissionRule {
  readonly methods: readonly string[];
  readonly pattern: RegExp;
  readonly permission: string;
}

const RULES: readonly RoutePermissionRule[] = [
  // Platform / admin
  {
    methods: ['PATCH'],
    pattern: /^\/v1\/organizations\/[^/]+$/,
    permission: 'platform:settings:manage',
  },
  {
    methods: ['POST'],
    pattern: /^\/v1\/organizations\/[^/]+\/teams\/[^/]+\/members$/,
    permission: 'admin:members:invite',
  },

  // CRM — contacts
  {
    methods: ['GET'],
    pattern: /\/contacts(?:\/|$)/,
    permission: 'crm:contacts:read',
  },
  {
    methods: ['POST', 'PATCH'],
    pattern: /\/contacts(?:\/|$)/,
    permission: 'crm:contacts:write',
  },
  {
    methods: ['DELETE'],
    pattern: /\/contacts(?:\/|$)/,
    permission: 'crm:contacts:delete',
  },

  // CRM — deals & accounts (read/write via contacts/deals permissions)
  {
    methods: ['GET'],
    pattern: /\/(?:accounts|deals|pipeline-stages)(?:\/|$)/,
    permission: 'crm:deals:read',
  },
  {
    methods: ['POST', 'PATCH'],
    pattern: /\/(?:accounts|deals|pipeline-stages)(?:\/|$)/,
    permission: 'crm:deals:write',
  },

  // Finance
  {
    methods: ['GET'],
    pattern: /\/(?:chart-of-accounts|journal-entries)(?:\/|$)/,
    permission: 'finance:invoices:read',
  },
  {
    methods: ['POST', 'PATCH'],
    pattern: /\/(?:chart-of-accounts|journal-entries)(?:\/|$)/,
    permission: 'finance:invoices:write',
  },
  {
    methods: ['POST'],
    pattern: /\/journal-entries\/[^/]+\/post$/,
    permission: 'finance:invoices:approve',
  },

  // Projects
  {
    methods: ['GET'],
    pattern: /\/(?:projects|tasks)(?:\/|$)/,
    permission: 'projects:tasks:read',
  },
  {
    methods: ['POST', 'PATCH'],
    pattern: /\/(?:projects|tasks)(?:\/|$)/,
    permission: 'projects:tasks:write',
  },

  // AI agents
  {
    methods: ['GET'],
    pattern: /\/(?:agent-definitions|agent-runs)(?:\/|$)/,
    permission: 'ai:agents:execute',
  },
  {
    methods: ['POST', 'PATCH'],
    pattern: /\/agent-definitions(?:\/|$)/,
    permission: 'ai:agents:execute',
  },
  {
    methods: ['POST'],
    pattern: /\/agent-runs(?:\/|$)/,
    permission: 'ai:agents:execute',
  },
] as const;

/**
 * Resolves the RBAC permission required for a request, or null if only membership is required.
 */
export function resolveRoutePermission(method: string, path: string): string | null {
  const normalizedPath = path.split('?')[0] ?? path;
  const upperMethod = method.toUpperCase();

  for (const rule of RULES) {
    if (rule.methods.includes(upperMethod) && rule.pattern.test(normalizedPath)) {
      return rule.permission;
    }
  }

  return null;
}