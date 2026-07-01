export { Prisma, PrismaClient } from '@prisma/client';
export type * from '@prisma/client';

export {
  createPrismaClient,
  disconnectPrismaClient,
  getPrismaClient,
  prisma,
} from './client.js';

export {
  configureTenantContextResolver,
  createTenantExtension,
  setOrganizationContext,
  withOrganizationContext,
} from './tenant-extension.js';