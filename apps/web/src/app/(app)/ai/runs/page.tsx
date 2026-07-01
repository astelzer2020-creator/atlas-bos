'use client';

import * as React from 'react';

import { DataTable, StatusBadge } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { PageEmpty, PageError, PageLoading } from '@/components/page-states';
import { useOrgContext } from '@/hooks/use-org-context';
import { ApiError, aiApi } from '@/lib/api-client';
import type { AgentRun } from '@/lib/api-types';

export default function AiRunsPage() {
  const { accessToken, organizationId } = useOrgContext();
  const [runs, setRuns] = React.useState<AgentRun[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await aiApi.listRuns(accessToken, organizationId);
      setRuns([...result.data]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load agent runs.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, organizationId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader title="Agent Runs" description="Monitor AI agent execution history." />

      {loading && <PageLoading />}
      {!loading && error && <PageError message={error} onRetry={() => void load()} />}
      {!loading && !error && runs.length === 0 && (
        <PageEmpty title="No agent runs" description="Runs appear when agents are invoked." />
      )}
      {!loading && !error && runs.length > 0 && (
        <DataTable
          data={runs}
          columns={[
            { key: 'goal', header: 'Goal', cell: (r) => <span className="line-clamp-2 max-w-xs">{r.goal}</span> },
            { key: 'pattern', header: 'Pattern', cell: (r) => <span className="capitalize">{r.orchestration_pattern}</span> },
            { key: 'iterations', header: 'Iterations', cell: (r) => `${String(r.iteration_count)}/${String(r.max_iterations)}` },
            { key: 'started', header: 'Started', cell: (r) => new Date(r.started_at).toLocaleString() },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      )}
    </div>
  );
}