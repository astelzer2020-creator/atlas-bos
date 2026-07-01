'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@atlas/ui';

import { DataTable, StatusBadge } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { FormError, PageEmpty, PageError, PageLoading } from '@/components/page-states';
import { useOrgContext } from '@/hooks/use-org-context';
import { ApiError, projectsApi } from '@/lib/api-client';
import { fieldError } from '@/lib/form-utils';
import type { Project } from '@/lib/api-types';

export default function ProjectsPage() {
  const router = useRouter();
  const { accessToken, organizationId } = useOrgContext();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await projectsApi.list(accessToken, organizationId);
      setProjects([...result.data]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load projects.');
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
      const project = await projectsApi.create(accessToken, organizationId, {
        code,
        name,
        ...(description ? { description } : {}),
        status: 'planning',
        priority: 'medium',
      });
      setCode('');
      setName('');
      setDescription('');
      setShowForm(false);
      router.push(`/projects/${project.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Failed to create project.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Projects"
        description="Track deliverables and team workload."
        actions={<Button onClick={() => { setShowForm((v) => !v); }}>{showForm ? 'Cancel' : 'New Project'}</Button>}
      />

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Create Project</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreate(e)} className="grid gap-4 sm:grid-cols-2">
              <FormError message={formError} />
              <Input label="Code" required value={code} onChange={(e) => { setCode(e.target.value); }} {...fieldError(fieldErrors, 'code')} disabled={submitting} placeholder="PRJ-001" />
              <Input label="Name" required value={name} onChange={(e) => { setName(e.target.value); }} {...fieldError(fieldErrors, 'name')} disabled={submitting} />
              <div className="sm:col-span-2">
                <Input label="Description" value={description} onChange={(e) => { setDescription(e.target.value); }} {...fieldError(fieldErrors, 'description')} disabled={submitting} />
              </div>
              <div className="sm:col-span-2"><Button type="submit" loading={submitting}>Create Project</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading && <PageLoading />}
      {!loading && error && <PageError message={error} onRetry={() => void load()} />}
      {!loading && !error && projects.length === 0 && (
        <PageEmpty title="No projects yet" description="Create a project to start tracking tasks." action={<Button onClick={() => { setShowForm(true); }}>New Project</Button>} />
      )}
      {!loading && !error && projects.length > 0 && (
        <DataTable
          data={projects}
          onRowClick={(row) => { router.push(`/projects/${row.id}`); }}
          columns={[
            { key: 'code', header: 'Code', cell: (r) => <span className="font-mono text-body-sm">{r.code}</span> },
            { key: 'name', header: 'Name', cell: (r) => <span className="font-medium">{r.name}</span> },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
            { key: 'priority', header: 'Priority', cell: (r) => <span className="capitalize">{r.priority}</span> },
            { key: 'progress', header: 'Progress', cell: (r) => `${r.progressPercent}%` },
          ]}
        />
      )}
    </div>
  );
}