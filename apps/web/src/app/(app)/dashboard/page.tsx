'use client';

import Link from 'next/link';
import * as React from 'react';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@atlas/ui';

import { PageError, PageLoading } from '@/components/page-states';
import {
  aiApi,
  automationApi,
  crmApi,
  financeApi,
  notificationsApi,
  projectsApi,
  workflowApi,
} from '@/lib/api-client';
import { ApiError } from '@/lib/api-client';
import { useOrgContext } from '@/hooks/use-org-context';

interface DashboardStats {
  accounts: number;
  contacts: number;
  deals: number;
  projects: number;
  journalEntries: number;
  workflows: number;
  automationRules: number;
  agents: number;
  unreadNotifications: number;
}

const MODULE_LINKS = [
  { label: 'CRM Accounts', href: '/crm/accounts', key: 'accounts' as const },
  { label: 'Contacts', href: '/crm/contacts', key: 'contacts' as const },
  { label: 'Deals', href: '/crm/deals', key: 'deals' as const },
  { label: 'Projects', href: '/projects', key: 'projects' as const },
  { label: 'Journal Entries', href: '/finance/journal', key: 'journalEntries' as const },
  { label: 'Workflows', href: '/workflows/definitions', key: 'workflows' as const },
  { label: 'Automation Rules', href: '/automation/rules', key: 'automationRules' as const },
  { label: 'AI Agents', href: '/ai/agents', key: 'agents' as const },
  { label: 'Notifications', href: '/notifications', key: 'unreadNotifications' as const },
];

export default function DashboardPage() {
  const { accessToken, organizationId, organization, user, loading: contextLoading } = useOrgContext();
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadStats = React.useCallback(async () => {
    if (!accessToken || !organizationId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [
        accounts,
        contacts,
        deals,
        projects,
        journal,
        workflows,
        rules,
        agents,
        notifications,
      ] = await Promise.all([
        crmApi.listAccounts(accessToken, organizationId),
        crmApi.listContacts(accessToken, organizationId),
        crmApi.listDeals(accessToken, organizationId),
        projectsApi.list(accessToken, organizationId),
        financeApi.listJournalEntries(accessToken, organizationId),
        workflowApi.listDefinitions(accessToken, organizationId),
        automationApi.listRules(accessToken, organizationId),
        aiApi.listAgents(accessToken, organizationId),
        notificationsApi.listInbox(accessToken, organizationId),
      ]);

      const unread = notifications.data.filter((n) => !n.read_at).length;

      setStats({
        accounts: accounts.data.length,
        contacts: contacts.data.length,
        deals: deals.data.length,
        projects: projects.data.length,
        journalEntries: journal.data.length,
        workflows: workflows.data.length,
        automationRules: rules.data.length,
        agents: agents.data.length,
        unreadNotifications: unread,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load dashboard stats.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, organizationId]);

  React.useEffect(() => {
    if (!contextLoading && accessToken && organizationId) {
      void loadStats();
    }
  }, [contextLoading, accessToken, organizationId, loadStats]);

  if (contextLoading || loading) {
    return <PageLoading label="Loading dashboard..." />;
  }

  if (error) {
    return <PageError message={error} onRetry={() => void loadStats()} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-heading-lg font-semibold">Dashboard</h1>
        <p className="mt-1 text-body-md text-foreground-secondary">
          Welcome back{user?.display_name ? `, ${user.display_name}` : ''}. Overview for{' '}
          {organization?.display_name ?? organization?.name ?? 'your organization'}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULE_LINKS.map((module) => (
          <Link key={module.href} href={module.href}>
            <Card className="h-full transition-shadow hover:shadow-elevation-1">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-heading-sm">
                  {module.label}
                  <Badge variant="neutral">{stats?.[module.key] ?? 0}</Badge>
                </CardTitle>
                <CardDescription>View and manage {module.label.toLowerCase()}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-body-sm text-foreground-tertiary">Open module →</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}