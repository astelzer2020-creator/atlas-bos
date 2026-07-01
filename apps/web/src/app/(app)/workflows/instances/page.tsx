'use client';

import * as React from 'react';

import { DataTable, StatusBadge } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { PageEmpty, PageError, PageLoading } from '@/components/page-states';
import { useOrgContext } from '@/hooks/use-org-context';
import { ApiError, workflowApi } from '@/lib/api-client';
import type { WorkflowInstance } from '@/lib/api-types';

export default function WorkflowInstancesPage() {
  const { accessToken, organizationId } = useOrgContext();
  const [instances, setInstances] = React.useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await workflowApi.listInstances(accessToken, organizationId);
      setInstances([...result.data]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load workflow instances.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, organizationId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader title="Workflow Instances" description="Monitor running and completed workflows." />

      {loading && <PageLoading />}
      {!loading && error && <PageError message={error} onRetry={() => void load()} />}
      {!loading && !error && instances.length === 0 && (
        <PageEmpty title="No workflow instances" description="Instances appear when workflows are started." />
      )}
      {!loading && !error && instances.length > 0 && (
        <DataTable
          data={instances}
          columns={[
            { key: 'id', header: 'Instance', cell: (r) => <span className="font-mono text-body-sm">{r.id.slice(0, 8)}…</span> },
            { key: 'definition', header: 'Definition', cell: (r) => <span className="font-mono text-body-sm">{r.definition_id.slice(0, 8)}…</span> },
            { key: 'entity', header: 'Entity', cell: (r) => (r.entity_type ?? '—') },
            { key: 'started', header: 'Started', cell: (r) => new Date(r.started_at).toLocaleString() },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      )}
    </div>
  );
}