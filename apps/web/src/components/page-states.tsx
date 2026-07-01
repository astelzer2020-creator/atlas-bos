'use client';

import { Button, Spinner } from '@atlas/ui';

export function PageLoading({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <Spinner size={32} />
      <p className="text-body-sm text-foreground-secondary">{label}</p>
    </div>
  );
}

export function PageError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-error/30 bg-error-bg px-6 py-12 text-center"
    >
      <p className="text-body-md text-error">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function PageEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-subtle/50 px-6 py-16 text-center">
      <h3 className="text-heading-sm font-medium text-foreground-primary">{title}</h3>
      {description && <p className="max-w-md text-body-sm text-foreground-secondary">{description}</p>}
      {action}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <div
      role="alert"
      className="rounded-md border border-error/30 bg-error-bg px-3 py-2 text-body-sm text-error"
    >
      {message}
    </div>
  );
}