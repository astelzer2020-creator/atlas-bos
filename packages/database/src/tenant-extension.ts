import { Prisma, type PrismaClient } from '@prisma/client';

const ORGANIZATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let resolveOrganizationId: () => string | undefined = () => undefined;

/**
 * Registers the active organization resolver used by the tenant Prisma extension.
 * Call from application bootstrap (e.g. wire to platform `getTenantContext`).
 */
export function configureTenantContextResolver(
  resolver: () => string | undefined,
): void {
  resolveOrganizationId = resolver;
}

function assertOrganizationId(organizationId: string): void {
  if (!ORGANIZATION_ID_PATTERN.test(organizationId)) {
    throw new Error(`Invalid organization ID format: ${organizationId}`);
  }
}

/**
 * Sets the PostgreSQL session variable used by RLS policies for the current transaction.
 * Uses SET LOCAL semantics via set_config(..., true) so the value does not leak across pooled connections.
 */
type PrismaExecutor = Pick<PrismaClient, '$executeRawUnsafe'>;

export async function setOrganizationContext(
  client: PrismaExecutor,
  organizationId: string | null,
): Promise<void> {
  if (organizationId) {
    assertOrganizationId(organizationId);
    await client.$executeRawUnsafe(
      `SELECT set_config('app.organization_id', '${organizationId}', true)`,
    );
    return;
  }

  await client.$executeRawUnsafe(`SELECT set_config('app.organization_id', '', true)`);
}

/**
 * Runs a callback with organization context applied on the same connection/transaction.
 */
export async function withOrganizationContext<T>(
  client: PrismaClient,
  organizationId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return client.$transaction(async (tx) => {
    await setOrganizationContext(tx, organizationId);
    return fn(tx);
  });
}

/**
 * Prisma client extension that applies RLS session variables from the active tenant context.
 */
export function createTenantExtension() {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: 'atlas-tenant-rls',
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            const organizationId = resolveOrganizationId();
            if (organizationId !== undefined) {
              await setOrganizationContext(client, organizationId);
            }
            return query(args);
          },
        },
      },
    }),
  );
}