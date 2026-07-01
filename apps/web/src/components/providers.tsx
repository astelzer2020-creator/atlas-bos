'use client';

import { ToastProvider } from '@atlas/ui';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}