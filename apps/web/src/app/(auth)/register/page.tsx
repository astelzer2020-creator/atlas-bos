'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
} from '@atlas/ui';

import { ApiError, authApi } from '@/lib/api-client';

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [acceptTerms, setAcceptTerms] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    setFieldErrors({});
    setSuccessMessage(null);

    if (!acceptTerms) {
      setFieldErrors({ accept_terms: 'You must accept the terms of service' });
      setLoading(false);
      return;
    }

    try {
      const result = await authApi.register({
        email,
        password,
        display_name: displayName,
        accept_terms: true,
      });

      setSuccessMessage(
        `Account created for ${result.email}. Check your inbox to verify your email before signing in.`,
      );

      setTimeout(() => {
        router.push('/login');
      }, 2500);
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        setFieldErrors(error.fieldErrors);
      } else {
        setFormError('Unable to create account. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md shadow-elevation-2">
      <CardHeader>
        <CardTitle>Create your Atlas account</CardTitle>
        <CardDescription>Start your free trial in minutes.</CardDescription>
      </CardHeader>

      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        noValidate
      >
        <CardContent className="flex flex-col gap-4">
          {formError && (
            <div
              role="alert"
              className="rounded-md border border-error/30 bg-error-bg px-3 py-2 text-body-sm text-error"
            >
              {formError}
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              className="rounded-md border border-success/30 bg-success-bg px-3 py-2 text-body-sm text-success"
            >
              {successMessage}
            </div>
          )}

          <Input
            label="Display name"
            name="display_name"
            autoComplete="name"
            required
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
            }}
            {...(fieldErrors.display_name ? { error: fieldErrors.display_name } : {})}
            disabled={loading}
          />

          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            {...(fieldErrors.email ? { error: fieldErrors.email } : {})}
            disabled={loading}
          />

          <Input
            label="Password"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            helperText="At least 12 characters with uppercase, lowercase, number, and symbol."
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            {...(fieldErrors.password ? { error: fieldErrors.password } : {})}
            disabled={loading}
          />

          <label className="flex items-start gap-2 text-body-sm text-foreground-secondary">
            <input
              type="checkbox"
              name="accept_terms"
              checked={acceptTerms}
              onChange={(event) => {
                setAcceptTerms(event.target.checked);
              }}
              disabled={loading}
              className="mt-0.5 size-4 rounded border-border"
            />
            <span>
              I agree to the{' '}
              <Link href="/terms" className="text-foreground-link hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-foreground-link hover:underline">
                Privacy Policy
              </Link>
            </span>
          </label>
          {fieldErrors.accept_terms && (
            <p role="alert" className="text-body-sm text-error">
              {fieldErrors.accept_terms}
            </p>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" loading={loading}>
            Create Account
          </Button>
          <p className="text-center text-body-sm text-foreground-secondary">
            Already have an account?{' '}
            <Link href="/login" className="text-foreground-link hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}