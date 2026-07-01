import type { TenantContext } from '@atlas/platform';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
    auth?: {
      readonly userId: string;
      readonly organizationId: string;
      readonly workspaceId: string;
      readonly sessionId: string;
    };
    tenantContext?: TenantContext;
  }
}