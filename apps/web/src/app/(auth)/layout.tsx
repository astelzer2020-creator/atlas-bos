import Link from 'next/link';

import { ThemeToggle } from '@/components/theme-toggle';

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-brand-600 text-foreground-inverse">
            <span className="text-label-sm font-bold">A</span>
          </div>
          <span className="text-heading-sm font-semibold">Atlas</span>
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12">{children}</main>
    </div>
  );
}