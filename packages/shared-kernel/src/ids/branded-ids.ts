import { z } from 'zod';

import { ValidationError } from '../errors/domain-errors.js';
import { err, ok, type Result } from '../result/result.js';

/** Nominal brand applied to primitive identifiers to prevent accidental mixing. */
type Brand<T, B extends string> = T & { readonly __brand: B };

const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

function createBrandedId<Id extends string>(
  brand: string,
  value: string,
): Result<Id, ValidationError> {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    return err(
      new ValidationError(`Invalid ${brand}: expected a valid UUID`, {
        field: brand,
        details: { value, issues: parsed.error.issues },
      }),
    );
  }
  return ok(parsed.data as Id);
}

function parseBrandedId<Id extends string>(
  brand: string,
  value: unknown,
): Result<Id, ValidationError> {
  if (typeof value !== 'string') {
    return err(
      new ValidationError(`Invalid ${brand}: expected a string`, {
        field: brand,
        details: { receivedType: typeof value },
      }),
    );
  }
  return createBrandedId<Id>(brand, value);
}

export type UserId = Brand<string, 'UserId'>;
export type OrganizationId = Brand<string, 'OrganizationId'>;
export type WorkspaceId = Brand<string, 'WorkspaceId'>;
export type TeamId = Brand<string, 'TeamId'>;
export type SessionId = Brand<string, 'SessionId'>;

/** Creates a {@link UserId} from a UUID string. */
export function createUserId(value: string): Result<UserId, ValidationError> {
  return createBrandedId<UserId>('UserId', value);
}

/** Parses an unknown value into a {@link UserId}. */
export function parseUserId(value: unknown): Result<UserId, ValidationError> {
  return parseBrandedId<UserId>('UserId', value);
}

/** Creates an {@link OrganizationId} from a UUID string. */
export function createOrganizationId(value: string): Result<OrganizationId, ValidationError> {
  return createBrandedId<OrganizationId>('OrganizationId', value);
}

/** Parses an unknown value into an {@link OrganizationId}. */
export function parseOrganizationId(value: unknown): Result<OrganizationId, ValidationError> {
  return parseBrandedId<OrganizationId>('OrganizationId', value);
}

/** Creates a {@link WorkspaceId} from a UUID string. */
export function createWorkspaceId(value: string): Result<WorkspaceId, ValidationError> {
  return createBrandedId<WorkspaceId>('WorkspaceId', value);
}

/** Parses an unknown value into a {@link WorkspaceId}. */
export function parseWorkspaceId(value: unknown): Result<WorkspaceId, ValidationError> {
  return parseBrandedId<WorkspaceId>('WorkspaceId', value);
}

/** Creates a {@link TeamId} from a UUID string. */
export function createTeamId(value: string): Result<TeamId, ValidationError> {
  return createBrandedId<TeamId>('TeamId', value);
}

/** Parses an unknown value into a {@link TeamId}. */
export function parseTeamId(value: unknown): Result<TeamId, ValidationError> {
  return parseBrandedId<TeamId>('TeamId', value);
}

/** Creates a {@link SessionId} from a UUID string. */
export function createSessionId(value: string): Result<SessionId, ValidationError> {
  return createBrandedId<SessionId>('SessionId', value);
}

/** Parses an unknown value into a {@link SessionId}. */
export function parseSessionId(value: unknown): Result<SessionId, ValidationError> {
  return parseBrandedId<SessionId>('SessionId', value);
}