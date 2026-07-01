import type { PrismaClient } from '@atlas/database';
import { createLogger, type Logger } from '@atlas/platform';

import { ProjectService } from './application/services/project.service.js';
import { TaskService } from './application/services/task.service.js';
import { PrismaProjectRepository } from './infrastructure/persistence/prisma-project.repository.js';
import { PrismaProjectTaskRepository } from './infrastructure/persistence/prisma-task.repository.js';

export { ProjectService } from './application/services/project.service.js';
export { TaskService } from './application/services/task.service.js';
export { registerProjectsRoutes } from './presentation/rest/projects.routes.js';

export type { ProjectsRoutesDeps } from './presentation/rest/projects.routes.js';
export type {
  ProjectDto,
  CreateProjectInput,
  UpdateProjectInput,
} from './application/services/project.service.js';
export type {
  TaskDto,
  CreateTaskInput,
  UpdateTaskInput,
} from './application/services/task.service.js';

export interface ProjectsModuleOptions {
  readonly prisma: PrismaClient;
  readonly logger?: Logger;
}

export interface ProjectsModule {
  readonly projectService: ProjectService;
  readonly taskService: TaskService;
}

/**
 * Wires projects bounded context services with Prisma repositories.
 */
export function createProjectsModule(options: ProjectsModuleOptions): ProjectsModule {
  const logger =
    options.logger ??
    createLogger({
      service: 'atlas',
      bindings: { module: 'projects' },
    });

  void logger;

  const projectRepository = new PrismaProjectRepository(options.prisma);
  const taskRepository = new PrismaProjectTaskRepository(options.prisma);

  const projectService = new ProjectService({ projectRepository });
  const taskService = new TaskService({ taskRepository, projectRepository });

  return {
    projectService,
    taskService,
  };
}