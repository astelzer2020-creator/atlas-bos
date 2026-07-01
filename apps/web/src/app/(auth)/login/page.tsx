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
import { setAccessToken, setMfaSession } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const result = await authApi.login({ email, password });

      if (result.mfa_required) {
        if (result.session_id) {
          setMfaSession(result.session_id);
        }
        router.push('/login/mfa');
        return;
      }

      if (result.access_token) {
        setAccessToken(result.access_token);
      }

      const next = new URLSearchParams(window.location.search).get('next');
      router.push(next && next.startsWith('/') ? next : '/dashboard');
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        setFieldErrors(error.fieldErrors);
      } else {
        setFormError('Unable to sign in. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md shadow-elevation-2">
      <CardHeader>
        <CardTitle>Sign in to Atlas</CardTitle>
        <CardDescription>Enter your credentials to access your workspace.</CardDescription>
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            {...(fieldErrors.password ? { error: fieldErrors.password } : {})}
            disabled={loading}
          />
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" loading={loading}>
            Sign In
          </Button>
          <p className="text-center text-body-sm text-foreground-secondary">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-foreground-link hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}