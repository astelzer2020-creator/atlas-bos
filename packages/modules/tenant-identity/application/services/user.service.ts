import {
  err,
  NotFoundError,
  ok,
  ValidationError,
  type Result,
  type UserId,
} from '@atlas/shared-kernel';

import type { UserRepository } from '../../domain/repositories/user.repository.js';
import type { CurrentUserResponse } from '../dto/auth.dto.js';

export interface UpdateProfileRequest {
  readonly display_name?: string;
  readonly locale?: string;
  readonly timezone?: string;
  readonly avatar_url?: string | null;
}

export interface UserServiceDeps {
  readonly userRepository: UserRepository;
}

export class UserService {
  constructor(private readonly deps: UserServiceDeps) {}

  async getUserById(userId: UserId): Promise<Result<CurrentUserResponse, NotFoundError>> {
    const user = await this.deps.userRepository.findById(userId);

    if (user === null) {
      return err(new NotFoundError('User', userId));
    }

    return ok({
      id: user.id,
      email: user.email.value,
      email_verified: user.emailVerified,
      display_name: user.displayName,
      status: user.status,
      type: user.type,
      locale: user.locale,
      timezone: user.timezone,
      avatar_url: user.avatarUrl,
      created_at: new Date().toISOString(),
    });
  }

  async updateProfile(
    userId: UserId,
    request: UpdateProfileRequest,
  ): Promise<Result<CurrentUserResponse, NotFoundError | ValidationError>> {
    const user = await this.deps.userRepository.findById(userId);

    if (user === null) {
      return err(new NotFoundError('User', userId));
    }

    const updateResult = user.updateProfile({
      ...(request.display_name !== undefined ? { displayName: request.display_name } : {}),
      ...(request.locale !== undefined ? { locale: request.locale } : {}),
      ...(request.timezone !== undefined ? { timezone: request.timezone } : {}),
      ...(request.avatar_url !== undefined ? { avatarUrl: request.avatar_url } : {}),
    });

    if (!updateResult.ok) {
      return updateResult;
    }

    await this.deps.userRepository.save(user);

    return ok({
      id: user.id,
      email: user.email.value,
      email_verified: user.emailVerified,
      display_name: user.displayName,
      status: user.status,
      type: user.type,
      locale: user.locale,
      timezone: user.timezone,
      avatar_url: user.avatarUrl,
      created_at: new Date().toISOString(),
    });
  }
}