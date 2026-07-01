'use client';

import * as React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@atlas/ui';

import { DataTable, StatusBadge } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { FormError, PageEmpty, PageError, PageLoading } from '@/components/page-states';
import { useOrgContext } from '@/hooks/use-org-context';
import { ApiError, crmApi } from '@/lib/api-client';
import { fieldError } from '@/lib/form-utils';
import type { CrmDeal, PipelineStage } from '@/lib/api-types';

export default function CrmDealsPage() {
  const { accessToken, organizationId, user } = useOrgContext();
  const [deals, setDeals] = React.useState<CrmDeal[]>([]);
  const [stages, setStages] = React.useState<PipelineStage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [pipelineStageId, setPipelineStageId] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dealsResult, stagesResult] = await Promise.all([
        crmApi.listDeals(accessToken, organizationId),
        crmApi.listPipelineStages(accessToken, organizationId),
      ]);
      setDeals([...dealsResult.data]);
      setStages([...stagesResult.data]);
      if (stagesResult.data[0] && !pipelineStageId) {
        setPipelineStageId(stagesResult.data[0].id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load deals.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, organizationId, pipelineStageId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: React.SubmitEvent) {
    event.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      await crmApi.createDeal(accessToken, organizationId, {
        name,
        pipelineStageId,
        ownerId: user.id,
        ...(amount ? { amount } : {}),
      });
      setName('');
      setAmount('');
      setShowForm(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Failed to create deal.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateStage() {
    setSubmitting(true);
    try {
      const stage = await crmApi.createPipelineStage(accessToken, organizationId, {
        name: 'Qualification',
        pipelineName: 'Default Pipeline',
        isDefault: true,
      });
      setPipelineStageId(stage.id);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create pipeline stage.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Deals"
        description="Track sales opportunities and pipeline."
        actions={<Button onClick={() => { setShowForm((v) => !v); }} disabled={stages.length === 0}>{showForm ? 'Cancel' : 'New Deal'}</Button>}
      />

      {stages.length === 0 && !loading && (
        <PageEmpty
          title="No pipeline stages"
          description="Create a default pipeline stage before adding deals."
          action={<Button onClick={() => void handleCreateStage()} loading={submitting}>Create Default Stage</Button>}
        />
      )}

      {showForm && stages.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Create Deal</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreate(e)} className="grid gap-4 sm:grid-cols-2">
              <FormError message={formError} />
              <Input label="Deal name" required value={name} onChange={(e) => { setName(e.target.value); }} {...fieldError(fieldErrors, 'name')} disabled={submitting} />
              <Input label="Amount" value={amount} onChange={(e) => { setAmount(e.target.value); }} {...fieldError(fieldErrors, 'amount')} disabled={submitting} placeholder="10000.00" />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="stage" className="text-label-sm font-medium text-foreground-primary">Pipeline stage</label>
                <select id="stage" value={pipelineStageId} onChange={(e) => { setPipelineStageId(e.target.value); }} disabled={submitting} className="rounded-md border border-border bg-canvas px-3 py-2 text-body-md">
                  {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2"><Button type="submit" loading={submitting}>Create Deal</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading && <PageLoading />}
      {!loading && error && <PageError message={error} onRetry={() => void load()} />}
      {!loading && !error && deals.length === 0 && stages.length > 0 && (
        <PageEmpty title="No deals yet" description="Create deals to track your pipeline." action={<Button onClick={() => { setShowForm(true); }}>New Deal</Button>} />
      )}
      {!loading && !error && deals.length > 0 && (
        <DataTable
          data={deals}
          columns={[
            { key: 'name', header: 'Deal', cell: (r) => <span className="font-medium">{r.name}</span> },
            { key: 'amount', header: 'Amount', cell: (r) => `${r.currencyCode} ${r.amount}` },
            { key: 'probability', header: 'Probability', cell: (r) => `${String(r.probability)}%` },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
            { key: 'close', header: 'Expected Close', cell: (r) => r.expectedCloseDate ? new Date(r.expectedCloseDate).toLocaleDateString() : '—' },
          ]}
        />
      )}
    </div>
  );
}