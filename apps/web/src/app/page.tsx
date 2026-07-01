import Link from 'next/link';
import { Button } from '@atlas/ui';

import { ThemeToggle } from '@/components/theme-toggle';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-foreground-inverse">
            <span className="text-label-md font-bold">A</span>
          </div>
          <span className="text-heading-sm font-semibold">Atlas</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">Sign Up</Link>
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="mb-4 text-label-md font-medium text-brand-600">Business Operating System</p>
        <h1 className="max-w-3xl text-display-md font-bold tracking-tight text-foreground-primary">
          Run your entire business from one platform
        </h1>
        <p className="mt-4 max-w-xl text-body-lg text-foreground-secondary">
          CRM, finance, HR, projects, and more — unified with enterprise-grade security and
          multi-tenant architecture.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/register">Get Started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-body-sm text-foreground-tertiary">
        © {new Date().getFullYear()} Atlas. All rights reserved.
      </footer>
    </div>
  );
}