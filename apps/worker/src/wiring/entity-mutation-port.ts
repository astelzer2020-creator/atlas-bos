import {
  AUTOMATION_SYSTEM_ACTOR_ID,
  type EntityMutationPort,
} from '@atlas/module-automation';
import type {
  AccountService,
  ContactService,
  CreateAccountInput,
  CreateContactInput,
  CreateDealInput,
  DealService,
  UpdateAccountInput,
  UpdateContactInput,
  UpdateDealInput,
} from '@atlas/module-crm';
import type {
  CreateProjectInput,
  CreateTaskInput,
  ProjectService,
  TaskService,
  UpdateProjectInput,
  UpdateTaskInput,
} from '@atlas/module-projects';
import type { OrganizationId } from '@atlas/shared-kernel';

const SUPPORTED_ENTITY_TYPES = new Set([
  'contact',
  'account',
  'deal',
  'project',
  'task',
]);

function toCamelCaseKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, character: string) => character.toUpperCase());
}

function normalizeFields(fields: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    normalized[toCamelCaseKey(key)] = value;
  }

  return normalized;
}

function requireStringField(
  fields: Record<string, unknown>,
  field: string,
  entityType: string,
): string {
  const value = fields[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`fields.${field} is required for ${entityType}`);
  }

  return value.trim();
}

function mergeTags(
  current: readonly string[],
  tags: readonly string[],
  mode: 'add' | 'remove' | 'replace',
): string[] {
  if (mode === 'replace') {
    return [...tags];
  }

  if (mode === 'remove') {
    const removeSet = new Set(tags);
    return current.filter((tag) => !removeSet.has(tag));
  }

  return [...new Set([...current, ...tags])];
}

function readMetadataTags(metadata: Record<string, unknown>): string[] {
  const tags = metadata.tags;
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags.filter((tag): tag is string => typeof tag === 'string');
}

export interface CreateEntityMutationPortOptions {
  readonly contactService: ContactService;
  readonly accountService: AccountService;
  readonly dealService: DealService;
  readonly projectService: ProjectService;
  readonly taskService: TaskService;
}

export function createEntityMutationPort(
  options: CreateEntityMutationPortOptions,
): EntityMutationPort {
  const actorId = AUTOMATION_SYSTEM_ACTOR_ID;

  return {
    async createEntity(input) {
      const entityType = input.entityType.toLowerCase();
      if (!SUPPORTED_ENTITY_TYPES.has(entityType)) {
        throw new Error(`Unsupported entity type: ${input.entityType}`);
      }

      const fields = normalizeFields(input.fields);
      const organizationId = input.organizationId as OrganizationId;

      switch (entityType) {
        case 'contact': {
          const displayName = requireStringField(fields, 'displayName', entityType);
          const result = await options.contactService.createContact(
            organizationId,
            { ...fields, displayName } as CreateContactInput,
            actorId,
          );
          if (!result.ok) {
            throw new Error(result.error.message);
          }
          return { entityId: result.value.id };
        }
        case 'account': {
          const name = requireStringField(fields, 'name', entityType);
          const result = await options.accountService.createAccount(
            organizationId,
            { ...fields, name } as CreateAccountInput,
            actorId,
          );
          if (!result.ok) {
            throw new Error(result.error.message);
          }
          return { entityId: result.value.id };
        }
        case 'deal': {
          const name = requireStringField(fields, 'name', entityType);
          const result = await options.dealService.createDeal(
            organizationId,
            { ...fields, name } as CreateDealInput,
            actorId,
          );
          if (!result.ok) {
            throw new Error(result.error.message);
          }
          return { entityId: result.value.id };
        }
        case 'project': {
          const name = requireStringField(fields, 'name', entityType);
          const code = requireStringField(fields, 'code', entityType);
          const result = await options.projectService.createProject(
            organizationId,
            { ...fields, name, code } as CreateProjectInput,
            actorId,
          );
          if (!result.ok) {
            throw new Error(result.error.message);
          }
          return { entityId: result.value.id };
        }
        case 'task': {
          const projectId = input.parentId ?? (fields.projectId as string | undefined);
          if (typeof projectId !== 'string' || projectId.length === 0) {
            throw new Error('parent_id or fields.project_id is required for task');
          }
          const title = requireStringField(fields, 'title', entityType);
          const result = await options.taskService.createTask(
            organizationId,
            projectId,
            { ...fields, title } as CreateTaskInput,
            actorId,
          );
          if (!result.ok) {
            throw new Error(result.error.message);
          }
          return { entityId: result.value.id };
        }
        default:
          throw new Error(`Unsupported entity type: ${input.entityType}`);
      }
    },

    async updateEntity(input) {
      const entityType = input.entityType.toLowerCase();
      if (!SUPPORTED_ENTITY_TYPES.has(entityType)) {
        throw new Error(`Unsupported entity type: ${input.entityType}`);
      }

      const fields = normalizeFields(input.fields);
      const organizationId = input.organizationId as OrganizationId;

      switch (entityType) {
        case 'contact': {
          const existing = await options.contactService.getContact(organizationId, input.entityId);
          if (!existing.ok) {
            throw new Error(existing.error.message);
          }
          const result = await options.contactService.updateContact(
            organizationId,
            input.entityId,
            { ...fields, version: existing.value.version } as UpdateContactInput,
            actorId,
          );
          if (!result.ok) {
            throw new Error(result.error.message);
          }
          return { entityId: result.value.id };
        }
        case 'account': {
          const existing = await options.accountService.getAccount(organizationId, input.entityId);
          if (!existing.ok) {
            throw new Error(existing.error.message);
          }
          const result = await options.accountService.updateAccount(
            organizationId,
            input.entityId,
            { ...fields, version: existing.value.version } as UpdateAccountInput,
            actorId,
          );
          if (!result.ok) {
            throw new Error(result.error.message);
          }
          return { entityId: result.value.id };
        }
        case 'deal': {
          const existing = await options.dealService.getDeal(organizationId, input.entityId);
          if (!existing.ok) {
            throw new Error(existing.error.message);
          }
          const result = await options.dealService.updateDeal(
            organizationId,
            input.entityId,
            { ...fields, version: existing.value.version } as UpdateDealInput,
            actorId,
          );
          if (!result.ok) {
            throw new Error(result.error.message);
          }
          return { entityId: result.value.id };
        }
        case 'project': {
          const existing = await options.projectService.getProject(organizationId, input.entityId);
          if (!existing.ok) {
            throw new Error(existing.error.message);
          }
          const result = await options.projectService.updateProject(
            organizationId,
            input.entityId,
            { ...fields, version: existing.value.version } as UpdateProjectInput,
            actorId,
          );
          if (!result.ok) {
            throw new Error(result.error.message);
          }
          return { entityId: result.value.id };
        }
        case 'task': {
          const projectId = fields.projectId as string | undefined;
          if (typeof projectId !== 'string' || projectId.length === 0) {
            throw new Error('fields.project_id is required when updating a task');
          }
          const existing = await options.taskService.getTask(
            organizationId,
            projectId,
            input.entityId,
          );
          if (!existing.ok) {
            throw new Error(existing.error.message);
          }
          const result = await options.taskService.updateTask(
            organizationId,
            projectId,
            input.entityId,
            { ...fields, version: existing.value.version } as UpdateTaskInput,
            actorId,
          );
          if (!result.ok) {
            throw new Error(result.error.message);
          }
          return { entityId: result.value.id };
        }
        default:
          throw new Error(`Unsupported entity type: ${input.entityType}`);
      }
    },

    async tagEntity(input) {
      const entityType = input.entityType.toLowerCase();
      const mode = input.mode ?? 'add';
      const organizationId = input.organizationId as OrganizationId;

      const applyTags = async (
        metadata: Record<string, unknown>,
        version: number,
        update: (
          nextMetadata: Record<string, unknown>,
          nextVersion: number,
        ) => Promise<{ entityId: string }>,
      ): Promise<{ entityId: string; tags: string[] }> => {
        const nextTags = mergeTags(readMetadataTags(metadata), input.tags, mode);
        const result = await update(
          { ...metadata, tags: nextTags },
          version,
        );
        return { entityId: result.entityId, tags: nextTags };
      };

      switch (entityType) {
        case 'contact': {
          const existing = await options.contactService.getContact(organizationId, input.entityId);
          if (!existing.ok) {
            throw new Error(existing.error.message);
          }
          return applyTags(existing.value.metadata, existing.value.version, async (metadata, version) => {
            const result = await options.contactService.updateContact(
              organizationId,
              input.entityId,
              { metadata, version },
              actorId,
            );
            if (!result.ok) {
              throw new Error(result.error.message);
            }
            return { entityId: result.value.id };
          });
        }
        case 'account': {
          const existing = await options.accountService.getAccount(organizationId, input.entityId);
          if (!existing.ok) {
            throw new Error(existing.error.message);
          }
          return applyTags(existing.value.metadata, existing.value.version, async (metadata, version) => {
            const result = await options.accountService.updateAccount(
              organizationId,
              input.entityId,
              { metadata, version },
              actorId,
            );
            if (!result.ok) {
              throw new Error(result.error.message);
            }
            return { entityId: result.value.id };
          });
        }
        case 'deal': {
          const existing = await options.dealService.getDeal(organizationId, input.entityId);
          if (!existing.ok) {
            throw new Error(existing.error.message);
          }
          return applyTags(existing.value.metadata, existing.value.version, async (metadata, version) => {
            const result = await options.dealService.updateDeal(
              organizationId,
              input.entityId,
              { metadata, version },
              actorId,
            );
            if (!result.ok) {
              throw new Error(result.error.message);
            }
            return { entityId: result.value.id };
          });
        }
        case 'project': {
          const existing = await options.projectService.getProject(organizationId, input.entityId);
          if (!existing.ok) {
            throw new Error(existing.error.message);
          }
          return applyTags(existing.value.metadata, existing.value.version, async (metadata, version) => {
            const result = await options.projectService.updateProject(
              organizationId,
              input.entityId,
              { metadata, version },
              actorId,
            );
            if (!result.ok) {
              throw new Error(result.error.message);
            }
            return { entityId: result.value.id };
          });
        }
        default:
          throw new Error(`Tagging is not supported for entity type: ${input.entityType}`);
      }
    },
  };
}