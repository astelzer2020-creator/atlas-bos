'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@atlas/ui';

import { DataTable, StatusBadge } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { FormError, PageEmpty, PageError, PageLoading } from '@/components/page-states';
import { useOrgContext } from '@/hooks/use-org-context';
import { ApiError, projectsApi } from '@/lib/api-client';
import { fieldError } from '@/lib/form-utils';
import type { Project, Task } from '@/lib/api-types';

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { accessToken, organizationId } = useOrgContext();
  const [project, setProject] = React.useState<Project | null>(null);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectResult, tasksResult] = await Promise.all([
        projectsApi.get(accessToken, organizationId, projectId),
        projectsApi.listTasks(accessToken, organizationId, projectId),
      ]);
      setProject(projectResult);
      setTasks([...tasksResult.data]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load project.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, organizationId, projectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleCreateTask(event: React.SubmitEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      await projectsApi.createTask(accessToken, organizationId, projectId, {
        title,
        ...(description ? { description } : {}),
        status: 'todo',
        priority: 'medium',
      });
      setTitle('');
      setDescription('');
      setShowForm(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Failed to create task.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoading label="Loading project..." />;
  if (error) return <PageError message={error} onRetry={() => void load()} />;
  if (!project) return <PageError message="Project not found." />;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="text-body-sm">
        <Link href="/projects" className="text-foreground-link hover:underline">← Back to projects</Link>
      </div>

      <PageHeader
        title={`${project.code} — ${project.name}`}
        description={project.description ?? 'No description'}
        actions={<Button onClick={() => { setShowForm((v) => !v); }}>{showForm ? 'Cancel' : 'New Task'}</Button>}
      />

      <div className="flex flex-wrap gap-3">
        <StatusBadge status={project.status} />
        <span className="rounded-md bg-subtle px-2 py-1 text-body-sm capitalize text-foreground-secondary">{project.priority} priority</span>
        <span className="rounded-md bg-subtle px-2 py-1 text-body-sm text-foreground-secondary">{project.progressPercent}% complete</span>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Create Task</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreateTask(e)} className="grid gap-4">
              <FormError message={formError} />
              <Input label="Title" required value={title} onChange={(e) => { setTitle(e.target.value); }} {...fieldError(fieldErrors, 'title')} disabled={submitting} />
              <Input label="Description" value={description} onChange={(e) => { setDescription(e.target.value); }} {...fieldError(fieldErrors, 'description')} disabled={submitting} />
              <Button type="submit" loading={submitting}>Create Task</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {tasks.length === 0 ? (
        <PageEmpty title="No tasks yet" description="Add tasks to track project work." action={<Button onClick={() => { setShowForm(true); }}>New Task</Button>} />
      ) : (
        <DataTable
          data={tasks}
          columns={[
            { key: 'title', header: 'Task', cell: (r) => <span className="font-medium">{r.title}</span> },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
            { key: 'priority', header: 'Priority', cell: (r) => <span className="capitalize">{r.priority}</span> },
            { key: 'due', header: 'Due', cell: (r) => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—' },
          ]}
        />
      )}
    </div>
  );
}