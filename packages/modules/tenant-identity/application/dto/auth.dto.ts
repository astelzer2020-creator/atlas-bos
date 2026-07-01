import { z } from 'zod';

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a digit')
    .regex(/[^A-Za-z0-9]/, 'Password must contain a special character'),
  display_name: z.string().min(1).max(255),
  locale: z.string().default('en-US'),
  timezone: z.string().default('UTC'),
  accept_terms: z.literal(true, {
    errorMap: () => ({ message: 'Terms must be accepted' }),
  }),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  organization_id: z.string().uuid().optional(),
  remember_device: z.boolean().default(false),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const refreshRequestSchema = z.object({
  refresh_token: z.string().min(1).optional(),
});

export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const mfaVerifyRequestSchema = z.object({
  session_id: z.string().uuid(),
  code: z.string().length(6),
});

export type MfaVerifyRequest = z.infer<typeof mfaVerifyRequestSchema>;

export interface RegisterResponse {
  readonly user_id: string;
  readonly email: string;
  readonly status: string;
  readonly verification_sent: boolean;
}

export interface TokenResponse {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly token_type: 'Bearer';
  readonly expires_in: number;
  readonly session_id: string;
}

export interface LoginResponse {
  readonly mfa_required: boolean;
  readonly access_token?: string;
  readonly refresh_token?: string;
  readonly token_type?: 'Bearer';
  readonly expires_in?: number;
  readonly session_id?: string;
}

export interface CurrentUserResponse {
  readonly id: string;
  readonly email: string;
  readonly email_verified: boolean;
  readonly display_name: string | null;
  readonly status: string;
  readonly type: string;
  readonly locale: string;
  readonly timezone: string;
  readonly avatar_url: string | null;
  readonly created_at: string;
}