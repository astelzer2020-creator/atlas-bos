'use client';

import * as React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@atlas/ui';

import { DataTable, StatusBadge } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { FormError, PageEmpty, PageError, PageLoading } from '@/components/page-states';
import { useOrgContext } from '@/hooks/use-org-context';
import { ApiError, workflowApi } from '@/lib/api-client';
import { fieldError } from '@/lib/form-utils';
import type { WorkflowDefinition } from '@/lib/api-types';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function WorkflowDefinitionsPage() {
  const { accessToken, organizationId } = useOrgContext();
  const [definitions, setDefinitions] = React.useState<WorkflowDefinition[]>([]);
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
      const result = await workflowApi.listDefinitions(accessToken, organizationId);
      setDefinitions([...result.data]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load workflow definitions.');
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
      await workflowApi.createDefinition(accessToken, organizationId, {
        name,
        slug: slugify(name),
        ...(description ? { description } : {}),
        category: 'general',
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
        setFormError('Failed to create workflow definition.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Workflow Definitions"
        description="Design and manage workflow templates."
        actions={<Button onClick={() => { setShowForm((v) => !v); }}>{showForm ? 'Cancel' : 'New Definition'}</Button>}
      />

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Create Workflow Definition</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreate(e)} className="grid gap-4">
              <FormError message={formError} />
              <Input label="Name" required value={name} onChange={(e) => { setName(e.target.value); }} {...fieldError(fieldErrors, 'name')} disabled={submitting} />
              <Input label="Description" value={description} onChange={(e) => { setDescription(e.target.value); }} {...fieldError(fieldErrors, 'description')} disabled={submitting} />
              <Button type="submit" loading={submitting}>Create Definition</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading && <PageLoading />}
      {!loading && error && <PageError message={error} onRetry={() => void load()} />}
      {!loading && !error && definitions.length === 0 && (
        <PageEmpty title="No workflow definitions" description="Create a workflow definition to automate processes." action={<Button onClick={() => { setShowForm(true); }}>New Definition</Button>} />
      )}
      {!loading && !error && definitions.length > 0 && (
        <DataTable
          data={definitions}
          columns={[
            { key: 'name', header: 'Name', cell: (r) => <span className="font-medium">{r.name}</span> },
            { key: 'slug', header: 'Slug', cell: (r) => <span className="font-mono text-body-sm">{r.slug}</span> },
            { key: 'category', header: 'Category', cell: (r) => r.category },
            { key: 'version', header: 'Version', cell: (r) => r.definition_version },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      )}
    </div>
  );
}