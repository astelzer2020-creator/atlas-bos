import type { PrismaClient } from '@atlas/database';
import { createPasswordHasher, createJwtService } from '@atlas/platform';
import type { JwtServiceOptions, PasswordHasher } from '@atlas/platform';
import { SystemClock } from '@atlas/shared-kernel/time';

import { AuthService } from './application/services/auth.service.js';
import { AuthorizationService } from './application/services/authorization.service.js';
import { OrganizationService } from './application/services/organization.service.js';
import { TeamService } from './application/services/team.service.js';
import { UserService } from './application/services/user.service.js';
import { WorkspaceService } from './application/services/workspace.service.js';
import { PrismaOrganizationRepository } from './infrastructure/persistence/prisma-organization.repository.js';
import { PrismaSessionRepository } from './infrastructure/persistence/prisma-session.repository.js';
import { PrismaTeamRepository } from './infrastructure/persistence/prisma-team.repository.js';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository.js';
import { PrismaWorkspaceRepository } from './infrastructure/persistence/prisma-workspace.repository.js';
export { AuthService } from './application/services/auth.service.js';
export { AuthorizationService } from './application/services/authorization.service.js';
export { OrganizationService } from './application/services/organization.service.js';
export { TeamService } from './application/services/team.service.js';
export { UserService } from './application/services/user.service.js';
export { WorkspaceService } from './application/services/workspace.service.js';
export { registerAuthRoutes } from './presentation/rest/auth.routes.js';
export { registerPlatformRoutes } from './presentation/rest/platform.routes.js';

export type { AuthRoutesDeps } from './presentation/rest/auth.routes.js';
export type { PlatformRoutesDeps } from './presentation/rest/platform.routes.js';

export interface TenantIdentityModuleOptions {
  readonly prisma: PrismaClient;
  readonly jwt: JwtServiceOptions;
  readonly passwordHasher?: PasswordHasher;
  readonly accessTtlSeconds?: number;
}

export interface TenantIdentityModule {
  readonly authService: AuthService;
  readonly organizationService: OrganizationService;
  readonly workspaceService: WorkspaceService;
  readonly teamService: TeamService;
  readonly userService: UserService;
  readonly authorizationService: AuthorizationService;
}

/**
 * Wires tenant-identity bounded context services with Prisma repositories.
 */
export function createTenantIdentityModule(
  options: TenantIdentityModuleOptions,
): TenantIdentityModule {
  const clock = new SystemClock();
  const passwordHasher = options.passwordHasher ?? createPasswordHasher();
  const jwtService = createJwtService(options.jwt);
  const accessTtlSeconds = options.accessTtlSeconds ?? options.jwt.accessTtlSeconds;

  const userRepository = new PrismaUserRepository(options.prisma);
  const sessionRepository = new PrismaSessionRepository(options.prisma);
  const organizationRepository = new PrismaOrganizationRepository(options.prisma);
  const workspaceRepository = new PrismaWorkspaceRepository(options.prisma);
  const teamRepository = new PrismaTeamRepository(options.prisma);

  const authService = new AuthService({
    userRepository,
    sessionRepository,
    prisma: options.prisma,
    passwordHasher,
    jwtService,
    accessTtlSeconds,
    clock,
  });

  const organizationService = new OrganizationService({ organizationRepository });
  const workspaceService = new WorkspaceService({ workspaceRepository });
  const teamService = new TeamService({ teamRepository, organizationRepository });
  const userService = new UserService({ userRepository });
  const authorizationService = new AuthorizationService({ prisma: options.prisma });

  return {
    authService,
    organizationService,
    workspaceService,
    teamService,
    userService,
    authorizationService,
  };
}