'use client';

import * as React from 'react';
import { Badge } from '@atlas/ui';

import { SearchableDataTable } from '@/components/searchable-data-table';
import { PageHeader } from '@/components/page-header';
import { PageEmpty, PageError, PageLoading } from '@/components/page-states';
import { useOrgContext } from '@/hooks/use-org-context';
import { ApiError, auditApi } from '@/lib/api-client';
import type { AuditLogEntry } from '@/lib/api-types';

export default function AuditLogPage() {
  const { accessToken, organizationId } = useOrgContext();
  const [entries, setEntries] = React.useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await auditApi.list(accessToken, organizationId, { limit: 100 });
      setEntries([...result.data]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load audit log.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, organizationId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Audit Log"
        description="Immutable record of actions taken in this organization."
      />

      {loading && <PageLoading />}
      {!loading && error && <PageError message={error} onRetry={() => void load()} />}
      {!loading && !error && entries.length === 0 && (
        <PageEmpty title="No audit events" description="Activity will be recorded here as users work in Atlas." />
      )}
      {!loading && !error && entries.length > 0 && (
        <SearchableDataTable
          data={entries}
          searchPlaceholder="Search by action, entity, or actor..."
          searchKeys={[
            (e) => e.action,
            (e) => e.entity_type,
            (e) => e.entity_id,
            (e) => e.actor_id ?? '',
          ]}
          columns={[
            {
              key: 'action',
              header: 'Action',
              cell: (e) => <Badge variant="neutral">{e.action}</Badge>,
            },
            { key: 'entity', header: 'Entity', cell: (e) => e.entity_type },
            {
              key: 'entityId',
              header: 'Entity ID',
              cell: (e) => <span className="font-mono text-body-sm">{e.entity_id.slice(0, 8)}…</span>,
            },
            {
              key: 'actor',
              header: 'Actor',
              cell: (e) => e.actor_id ? <span className="font-mono text-body-sm">{e.actor_id.slice(0, 8)}…</span> : 'System',
            },
            {
              key: 'occurred',
              header: 'Occurred',
              cell: (e) => new Date(e.occurred_at).toLocaleString(),
            },
          ]}
        />
      )}
    </div>
  );
}