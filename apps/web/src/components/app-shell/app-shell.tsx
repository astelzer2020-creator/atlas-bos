'use client';

import Link from 'next/link';
import * as React from 'react';
import { Button } from '@atlas/ui';

import { OnboardingWizard } from '@/components/onboarding-wizard';
import { NotificationBell } from '@/components/notification-bell';
import { PageError, PageLoading } from '@/components/page-states';
import { ThemeToggle } from '@/components/theme-toggle';
import { OrgProvider, useOrgContext } from '@/hooks/use-org-context';

import { SidebarNav } from './sidebar-nav';

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { accessToken, loading, error, organization, user, organizations, setOrganization, signOut, refresh } =
    useOrgContext();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <PageLoading label="Loading workspace..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-md">
          <PageError message={error} onRetry={() => void refresh()} />
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <OnboardingWizard accessToken={accessToken} onComplete={refresh} />
      </div>
    );
  }

  const sidebar = (
    <>
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex size-8 items-center justify-center rounded-md bg-brand-600 text-foreground-inverse">
          <span className="text-label-sm font-bold">A</span>
        </div>
        <div className="min-w-0 flex-1">
          <Link href="/dashboard" className="block truncate text-heading-sm font-semibold">
            Atlas
          </Link>
          <p className="truncate text-body-sm text-foreground-tertiary">{organization.name}</p>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-foreground-secondary hover:bg-subtle md:hidden"
          onClick={() => { setMobileOpen(false); }}
          aria-label="Close menu"
        >
          <CloseIcon />
        </button>
      </div>

      <SidebarNav onNavigate={() => { setMobileOpen(false); }} />

      <div className="border-t border-border p-3">
        {user && (
          <p className="truncate px-3 text-body-sm text-foreground-secondary">
            {user.display_name ?? user.email}
          </p>
        )}
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-overlay/50"
            onClick={() => { setMobileOpen(false); }}
            aria-label="Close menu overlay"
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-surface shadow-elevation-3">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
          <button
            type="button"
            className="rounded-md p-2 text-foreground-secondary hover:bg-subtle md:hidden"
            onClick={() => { setMobileOpen(true); }}
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>

          {organizations.length > 1 && (
            <select
              value={organization.id}
              onChange={(event) => { setOrganization(event.target.value); }}
              className="max-w-[200px] truncate rounded-md border border-border bg-canvas px-2 py-1.5 text-body-sm text-foreground-primary"
              aria-label="Select organization"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.display_name ?? org.name}
                </option>
              ))}
            </select>
          )}

          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void signOut();
              }}
            >
              Sign Out
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <OrgProvider>
      <AppShellInner>{children}</AppShellInner>
    </OrgProvider>
  );
}