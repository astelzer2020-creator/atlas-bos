'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@atlas/ui';

export interface NavItem {
  readonly label: string;
  readonly href?: string;
  readonly children?: readonly NavItem[];
}

export const NAV_SECTIONS: readonly { title: string; items: readonly NavItem[] }[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', href: '/dashboard' }],
  },
  {
    title: 'CRM',
    items: [
      { label: 'Accounts', href: '/crm/accounts' },
      { label: 'Contacts', href: '/crm/contacts' },
      { label: 'Deals', href: '/crm/deals' },
    ],
  },
  {
    title: 'Projects',
    items: [{ label: 'All Projects', href: '/projects' }],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Chart of Accounts', href: '/finance/accounts' },
      { label: 'Journal Entries', href: '/finance/journal' },
    ],
  },
  {
    title: 'Workflows',
    items: [
      { label: 'Definitions', href: '/workflows/definitions' },
      { label: 'Instances', href: '/workflows/instances' },
      { label: 'Approvals', href: '/workflows/approvals' },
    ],
  },
  {
    title: 'Automation',
    items: [{ label: 'Rules', href: '/automation/rules' }],
  },
  {
    title: 'AI',
    items: [
      { label: 'Agents', href: '/ai/agents' },
      { label: 'Runs', href: '/ai/runs' },
      { label: 'Knowledge Base', href: '/ai/knowledge' },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Notifications', href: '/notifications' },
      { label: 'Profile', href: '/settings/profile' },
      { label: 'Organization', href: '/settings/organization' },
      { label: 'Members', href: '/settings/members' },
      { label: 'Audit Log', href: '/settings/audit' },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="mb-1 px-3 text-label-sm font-medium uppercase tracking-wide text-foreground-tertiary">
            {section.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              if (!item.href) {
                return null;
              }
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  {...(onNavigate ? { onClick: onNavigate } : {})}
                  className={cn(
                    'rounded-md px-3 py-2 text-label-md transition-colors',
                    active
                      ? 'bg-brand-600/10 font-medium text-brand-700 dark:text-brand-400'
                      : 'text-foreground-secondary hover:bg-subtle hover:text-foreground-primary',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}