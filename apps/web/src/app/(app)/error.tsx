'use client';

import { Button } from '@atlas/ui';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-heading-md font-semibold">Something went wrong</h2>
      <p className="max-w-md text-body-md text-foreground-secondary">
        {error.message || 'An unexpected error occurred while loading this page.'}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}