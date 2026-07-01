import { describe, expect, it } from 'vitest';

import { ValidationError } from '../src/errors/domain-errors.js';
import {
  createOrganizationId,
  createSessionId,
  createTeamId,
  createUserId,
  createWorkspaceId,
  parseUserId,
} from '../src/ids/branded-ids.js';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('Branded IDs', () => {
  it('creates branded IDs from valid UUIDs', () => {
    const userId = createUserId(VALID_UUID);
    const organizationId = createOrganizationId(VALID_UUID);
    const workspaceId = createWorkspaceId(VALID_UUID);
    const teamId = createTeamId(VALID_UUID);
    const sessionId = createSessionId(VALID_UUID);

    expect(userId.ok).toBe(true);
    expect(organizationId.ok).toBe(true);
    expect(workspaceId.ok).toBe(true);
    expect(teamId.ok).toBe(true);
    expect(sessionId.ok).toBe(true);

    if (userId.ok) {
      expect(userId.value).toBe(VALID_UUID);
    }
  });

  it('rejects invalid UUID strings', () => {
    const result = createUserId('not-a-uuid');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.field).toBe('UserId');
    }
  });

  it('parses unknown values with type checking', () => {
    const valid = parseUserId(VALID_UUID);
    const invalidType = parseUserId(42);
    const invalidFormat = parseUserId('bad-id');

    expect(valid.ok).toBe(true);
    expect(invalidType.ok).toBe(false);
    expect(invalidFormat.ok).toBe(false);

    if (!invalidType.ok) {
      expect(invalidType.error.field).toBe('UserId');
    }
  });

  it('prevents accidental cross-assignment at compile time', () => {
    const user = createUserId(VALID_UUID);
    const team = createTeamId('6ba7b810-9dad-11d1-80b4-00c04fd430c8');

    expect(user.ok && team.ok).toBe(true);

    if (user.ok && team.ok) {
      const assignUserOnly = (id: typeof user.value): typeof user.value => id;
      expect(assignUserOnly(user.value)).toBe(user.value);

      // @ts-expect-error UserId and TeamId are distinct branded types
      assignUserOnly(team.value);
    }
  });
});