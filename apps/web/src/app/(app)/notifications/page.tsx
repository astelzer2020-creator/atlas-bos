'use client';

import * as React from 'react';
import { Button } from '@atlas/ui';

import { DataTable, StatusBadge } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { PageEmpty, PageError, PageLoading } from '@/components/page-states';
import { useOrgContext } from '@/hooks/use-org-context';
import { ApiError, notificationsApi } from '@/lib/api-client';
import type { Notification } from '@/lib/api-types';

export default function NotificationsPage() {
  const { accessToken, organizationId } = useOrgContext();
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [markingId, setMarkingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await notificationsApi.listInbox(accessToken, organizationId);
      setNotifications([...result.data]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, organizationId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleMarkRead(notificationId: string) {
    setMarkingId(notificationId);
    try {
      await notificationsApi.markRead(accessToken, organizationId, notificationId);
      await load();
    } catch {
      // Silently refresh on failure
      await load();
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader title="Notifications" description="Your in-app notification inbox." />

      {loading && <PageLoading />}
      {!loading && error && <PageError message={error} onRetry={() => void load()} />}
      {!loading && !error && notifications.length === 0 && (
        <PageEmpty title="Inbox is empty" description="Notifications will appear here when events occur." />
      )}
      {!loading && !error && notifications.length > 0 && (
        <DataTable
          data={notifications}
          columns={[
            { key: 'title', header: 'Title', cell: (r) => <span className={`font-medium ${!r.read_at ? 'text-foreground-primary' : 'text-foreground-secondary'}`}>{r.title}</span> },
            { key: 'category', header: 'Category', cell: (r) => <span className="capitalize">{r.category}</span> },
            { key: 'created', header: 'Received', cell: (r) => new Date(r.created_at).toLocaleString() },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.read_at ? 'read' : 'pending'} /> },
            {
              key: 'actions',
              header: '',
              cell: (r) =>
                !r.read_at ? (
                  <Button variant="ghost" size="sm" loading={markingId === r.id} onClick={() => void handleMarkRead(r.id)}>
                    Mark read
                  </Button>
                ) : null,
            },
          ]}
        />
      )}
    </div>
  );
}