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
import { clearMfaSession, getMfaSession, setAccessToken } from '@/lib/auth';

export default function MfaChallengePage() {
  const router = useRouter();
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const sessionId = getMfaSession();

  React.useEffect(() => {
    if (!sessionId) {
      router.replace('/login');
    }
  }, [sessionId, router]);

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionId) {
      return;
    }

    setLoading(true);
    setFormError(null);

    try {
      const result = await authApi.verifyMfa({ session_id: sessionId, code });
      if (result.access_token) {
        setAccessToken(result.access_token);
        clearMfaSession();
        router.push('/dashboard');
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError('Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md shadow-elevation-2">
      <CardHeader>
        <CardTitle>Verify your identity</CardTitle>
        <CardDescription>Enter the 6-digit code from your authenticator app.</CardDescription>
      </CardHeader>

      <form onSubmit={(e) => { void handleSubmit(e); }} noValidate>
        <CardContent className="flex flex-col gap-4">
          {formError && (
            <div role="alert" className="rounded-md border border-error/30 bg-error-bg px-3 py-2 text-body-sm text-error">
              {formError}
            </div>
          )}

          <Input
            label="Authentication code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
            disabled={loading}
          />
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" loading={loading} disabled={code.length !== 6}>
            Verify
          </Button>
          <p className="text-center text-body-sm text-foreground-secondary">
            <Link href="/login" className="text-foreground-link hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}