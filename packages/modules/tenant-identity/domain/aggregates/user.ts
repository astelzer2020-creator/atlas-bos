import {
  ConflictError,
  Email,
  err,
  ok,
  UnauthorizedError,
  ValidationError,
  type Result,
  type UserId,
} from '@atlas/shared-kernel';
import type { Clock } from '@atlas/shared-kernel/time';

export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type UserType = 'HUMAN' | 'SERVICE_ACCOUNT' | 'AGENT';

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export interface CreateUserInput {
  readonly id: UserId;
  readonly email: Email;
  readonly passwordHash: string;
  readonly displayName: string;
  readonly locale?: string;
  readonly timezone?: string;
}

export interface UserProps {
  readonly id: UserId;
  readonly email: Email;
  readonly emailVerified: boolean;
  readonly emailVerifiedAt: Date | null;
  readonly passwordHash: string | null;
  readonly type: UserType;
  readonly status: UserStatus;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly locale: string;
  readonly timezone: string;
  readonly lastLoginAt: Date | null;
  readonly lastLoginIp: string | null;
  readonly failedLoginAttempts: number;
  readonly lockedUntil: Date | null;
  readonly passwordChangedAt: Date | null;
  readonly version: number;
}

export class User {
  private constructor(private props: UserProps) {}

  static create(input: CreateUserInput, clock: Clock): Result<User, ValidationError> {
    if (input.passwordHash.length === 0) {
      return err(new ValidationError('Password hash is required', { field: 'password' }));
    }

    if (input.displayName.trim().length === 0) {
      return err(new ValidationError('Display name is required', { field: 'display_name' }));
    }

    return ok(
      new User({
        id: input.id,
        email: input.email,
        emailVerified: false,
        emailVerifiedAt: null,
        passwordHash: input.passwordHash,
        type: 'HUMAN',
        status: 'PENDING_VERIFICATION',
        displayName: input.displayName.trim(),
        avatarUrl: null,
        locale: input.locale ?? 'en-US',
        timezone: input.timezone ?? 'UTC',
        lastLoginAt: null,
        lastLoginIp: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        passwordChangedAt: clock.now(),
        version: 1,
      }),
    );
  }

  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  get id(): UserId {
    return this.props.id;
  }

  get email(): Email {
    return this.props.email;
  }

  get emailVerified(): boolean {
    return this.props.emailVerified;
  }

  get emailVerifiedAt(): Date | null {
    return this.props.emailVerifiedAt;
  }

  get passwordHash(): string | null {
    return this.props.passwordHash;
  }

  get type(): UserType {
    return this.props.type;
  }

  get status(): UserStatus {
    return this.props.status;
  }

  get displayName(): string | null {
    return this.props.displayName;
  }

  get avatarUrl(): string | null {
    return this.props.avatarUrl;
  }

  get locale(): string {
    return this.props.locale;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  get lastLoginAt(): Date | null {
    return this.props.lastLoginAt;
  }

  get lastLoginIp(): string | null {
    return this.props.lastLoginIp;
  }

  get failedLoginAttempts(): number {
    return this.props.failedLoginAttempts;
  }

  get lockedUntil(): Date | null {
    return this.props.lockedUntil;
  }

  get passwordChangedAt(): Date | null {
    return this.props.passwordChangedAt;
  }

  get version(): number {
    return this.props.version;
  }

  toProps(): UserProps {
    return { ...this.props };
  }

  isLocked(clock: Clock): boolean {
    if (this.props.lockedUntil === null) {
      return false;
    }
    return this.props.lockedUntil.getTime() > clock.now().getTime();
  }

  verifyEmail(clock: Clock): Result<void, ConflictError> {
    if (this.props.emailVerified) {
      return err(new ConflictError('Email is already verified'));
    }

    this.props = {
      ...this.props,
      emailVerified: true,
      emailVerifiedAt: clock.now(),
      status: 'ACTIVE',
      version: this.props.version + 1,
    };

    return ok(undefined);
  }

  recordLogin(ipAddress: string | null, clock: Clock): Result<void, UnauthorizedError> {
    if (this.props.status === 'SUSPENDED' || this.props.status === 'DEACTIVATED') {
      return err(new UnauthorizedError('Account is not active'));
    }

    if (this.isLocked(clock)) {
      return err(new UnauthorizedError('Account is temporarily locked'));
    }

    this.props = {
      ...this.props,
      lastLoginAt: clock.now(),
      lastLoginIp: ipAddress,
      failedLoginAttempts: 0,
      lockedUntil: null,
      version: this.props.version + 1,
    };

    return ok(undefined);
  }

  recordFailedLogin(clock: Clock): Result<void, never> {
    const attempts = this.props.failedLoginAttempts + 1;
    const shouldLock = attempts >= MAX_FAILED_LOGIN_ATTEMPTS;

    this.props = {
      ...this.props,
      failedLoginAttempts: attempts,
      lockedUntil: shouldLock
        ? new Date(clock.now().getTime() + LOCK_DURATION_MS)
        : this.props.lockedUntil,
      version: this.props.version + 1,
    };

    return ok(undefined);
  }

  lockAccount(until: Date): Result<void, ValidationError> {
    if (until.getTime() <= Date.now()) {
      return err(new ValidationError('Lock expiry must be in the future', { field: 'locked_until' }));
    }

    this.props = {
      ...this.props,
      lockedUntil: until,
      version: this.props.version + 1,
    };

    return ok(undefined);
  }

  updateProfile(updates: {
    displayName?: string;
    locale?: string;
    timezone?: string;
    avatarUrl?: string | null;
  }): Result<void, ValidationError> {
    if (updates.displayName !== undefined && updates.displayName.trim().length === 0) {
      return err(new ValidationError('Display name must not be empty', { field: 'display_name' }));
    }

    this.props = {
      ...this.props,
      displayName: updates.displayName?.trim() ?? this.props.displayName,
      locale: updates.locale ?? this.props.locale,
      timezone: updates.timezone ?? this.props.timezone,
      avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : this.props.avatarUrl,
      version: this.props.version + 1,
    };

    return ok(undefined);
  }
}