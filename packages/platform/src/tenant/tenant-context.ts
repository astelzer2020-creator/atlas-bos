import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  readonly organizationId: string;
  readonly workspaceId: string;
  readonly userId: string;
}

export class TenantContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantContextError';
  }
}

const tenantStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Executes a function within a tenant context bound to the current async scope.
 */
export function runWithTenant<T>(context: TenantContext, fn: () => T): T {
  return tenantStorage.run(context, fn);
}

/**
 * Returns the active tenant context or undefined when not inside {@link runWithTenant}.
 */
export function getTenantContext(): TenantContext | undefined {
  return tenantStorage.getStore();
}

/**
 * Returns the active tenant context or throws when absent.
 */
export function requireTenantContext(): TenantContext {
  const context = getTenantContext();
  if (context === undefined) {
    throw new TenantContextError('Tenant context is not available for the current async scope');
  }
  return context;
}