'use client';

import * as React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@atlas/ui';

import { DataTable, StatusBadge } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { FormError, PageEmpty, PageError, PageLoading } from '@/components/page-states';
import { useOrgContext } from '@/hooks/use-org-context';
import { ApiError, automationApi } from '@/lib/api-client';
import { fieldError } from '@/lib/form-utils';
import type { AutomationRule } from '@/lib/api-types';

export default function AutomationRulesPage() {
  const { accessToken, organizationId } = useOrgContext();
  const [rules, setRules] = React.useState<AutomationRule[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await automationApi.listRules(accessToken, organizationId);
      setRules([...result.data]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load automation rules.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, organizationId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: React.SubmitEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      await automationApi.createRule(accessToken, organizationId, {
        name,
        ...(description ? { description } : {}),
      });
      setName('');
      setDescription('');
      setShowForm(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Failed to create automation rule.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Automation Rules"
        description="Configure event-driven automation."
        actions={<Button onClick={() => { setShowForm((v) => !v); }}>{showForm ? 'Cancel' : 'New Rule'}</Button>}
      />

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Create Automation Rule</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreate(e)} className="grid gap-4">
              <FormError message={formError} />
              <Input label="Name" required value={name} onChange={(e) => { setName(e.target.value); }} {...fieldError(fieldErrors, 'name')} disabled={submitting} />
              <Input label="Description" value={description} onChange={(e) => { setDescription(e.target.value); }} {...fieldError(fieldErrors, 'description')} disabled={submitting} />
              <Button type="submit" loading={submitting}>Create Rule</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading && <PageLoading />}
      {!loading && error && <PageError message={error} onRetry={() => void load()} />}
      {!loading && !error && rules.length === 0 && (
        <PageEmpty title="No automation rules" description="Create rules to automate repetitive tasks." action={<Button onClick={() => { setShowForm(true); }}>New Rule</Button>} />
      )}
      {!loading && !error && rules.length > 0 && (
        <DataTable
          data={rules}
          columns={[
            { key: 'name', header: 'Name', cell: (r) => <span className="font-medium">{r.name}</span> },
            { key: 'executions', header: 'Executions', cell: (r) => r.execution_count },
            { key: 'last', header: 'Last Run', cell: (r) => r.last_executed_at ? new Date(r.last_executed_at).toLocaleString() : 'Never' },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      )}
    </div>
  );
}