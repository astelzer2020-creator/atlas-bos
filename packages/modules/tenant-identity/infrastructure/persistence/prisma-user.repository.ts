import type { PrismaClient } from '@atlas/database';
import { Email, type UserId } from '@atlas/shared-kernel';

import { User, type UserProps, type UserStatus, type UserType } from '../../domain/aggregates/user.js';
import type { UserRepository } from '../../domain/repositories/user.repository.js';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: UserId): Promise<User | null> {
    const record = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (record === null) {
      return null;
    }

    return this.toDomain(record);
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });

    if (record === null) {
      return null;
    }

    return this.toDomain(record);
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { email: email.toLowerCase(), deletedAt: null },
    });

    return count > 0;
  }

  async save(user: User): Promise<void> {
    const props = user.toProps();

    await this.prisma.user.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        email: props.email.value,
        emailVerified: props.emailVerified,
        emailVerifiedAt: props.emailVerifiedAt,
        passwordHash: props.passwordHash,
        type: props.type,
        status: props.status,
        displayName: props.displayName,
        avatarUrl: props.avatarUrl,
        locale: props.locale,
        timezone: props.timezone,
        lastLoginAt: props.lastLoginAt,
        lastLoginIp: props.lastLoginIp,
        failedLoginAttempts: props.failedLoginAttempts,
        lockedUntil: props.lockedUntil,
        passwordChangedAt: props.passwordChangedAt,
        version: props.version,
      },
      update: {
        emailVerified: props.emailVerified,
        emailVerifiedAt: props.emailVerifiedAt,
        passwordHash: props.passwordHash,
        status: props.status,
        displayName: props.displayName,
        avatarUrl: props.avatarUrl,
        locale: props.locale,
        timezone: props.timezone,
        lastLoginAt: props.lastLoginAt,
        lastLoginIp: props.lastLoginIp,
        failedLoginAttempts: props.failedLoginAttempts,
        lockedUntil: props.lockedUntil,
        passwordChangedAt: props.passwordChangedAt,
        version: props.version,
      },
    });
  }

  private toDomain(record: {
    id: string;
    email: string;
    emailVerified: boolean;
    emailVerifiedAt: Date | null;
    passwordHash: string | null;
    type: string;
    status: string;
    displayName: string | null;
    avatarUrl: string | null;
    locale: string;
    timezone: string;
    lastLoginAt: Date | null;
    lastLoginIp: string | null;
    failedLoginAttempts: number;
    lockedUntil: Date | null;
    passwordChangedAt: Date | null;
    version: number;
  }): User {
    const emailResult = Email.create(record.email);
    if (!emailResult.ok) {
      throw new Error(`Invalid email in database for user ${record.id}`);
    }

    const props: UserProps = {
      id: record.id as UserId,
      email: emailResult.value,
      emailVerified: record.emailVerified,
      emailVerifiedAt: record.emailVerifiedAt,
      passwordHash: record.passwordHash,
      type: record.type as UserType,
      status: record.status as UserStatus,
      displayName: record.displayName,
      avatarUrl: record.avatarUrl,
      locale: record.locale,
      timezone: record.timezone,
      lastLoginAt: record.lastLoginAt,
      lastLoginIp: record.lastLoginIp,
      failedLoginAttempts: record.failedLoginAttempts,
      lockedUntil: record.lockedUntil,
      passwordChangedAt: record.passwordChangedAt,
      version: record.version,
    };

    return User.reconstitute(props);
  }
}