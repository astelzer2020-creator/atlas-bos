'use client';

import * as React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@atlas/ui';

import { DataTable, StatusBadge } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { FormError, PageEmpty, PageError, PageLoading } from '@/components/page-states';
import { useOrgContext } from '@/hooks/use-org-context';
import { ApiError, aiApi } from '@/lib/api-client';
import { fieldError } from '@/lib/form-utils';
import type { AgentDefinition } from '@/lib/api-types';

const AGENT_ROLES = ['analyst', 'executor', 'reviewer', 'planner', 'custom'] as const;

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function AiAgentsPage() {
  const { accessToken, organizationId } = useOrgContext();
  const [agents, setAgents] = React.useState<AgentDefinition[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [name, setName] = React.useState('');
  const [role, setRole] = React.useState<string>('analyst');
  const [systemPrompt, setSystemPrompt] = React.useState('You are a helpful business assistant.');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await aiApi.listAgents(accessToken, organizationId);
      setAgents([...result.data]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load agents.');
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
      await aiApi.createAgent(accessToken, organizationId, {
        name,
        slug: slugify(name),
        role,
        system_prompt: systemPrompt,
      });
      setName('');
      setSystemPrompt('You are a helpful business assistant.');
      setShowForm(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Failed to create agent.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="AI Agents"
        description="Define and manage AI agent configurations."
        actions={<Button onClick={() => { setShowForm((v) => !v); }}>{showForm ? 'Cancel' : 'New Agent'}</Button>}
      />

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Create Agent</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreate(e)} className="grid gap-4">
              <FormError message={formError} />
              <Input label="Name" required value={name} onChange={(e) => { setName(e.target.value); }} {...fieldError(fieldErrors, 'name')} disabled={submitting} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="role" className="text-label-sm font-medium">Role</label>
                <select id="role" value={role} onChange={(e) => { setRole(e.target.value); }} className="rounded-md border border-border bg-canvas px-3 py-2 text-body-md">
                  {AGENT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="prompt" className="text-label-sm font-medium">System prompt</label>
                <textarea id="prompt" required value={systemPrompt} onChange={(e) => { setSystemPrompt(e.target.value); }} rows={4} className="rounded-md border border-border bg-canvas px-3 py-2 text-body-md" disabled={submitting} />
              </div>
              <Button type="submit" loading={submitting}>Create Agent</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading && <PageLoading />}
      {!loading && error && <PageError message={error} onRetry={() => void load()} />}
      {!loading && !error && agents.length === 0 && (
        <PageEmpty title="No agents defined" description="Create an AI agent to automate intelligent tasks." action={<Button onClick={() => { setShowForm(true); }}>New Agent</Button>} />
      )}
      {!loading && !error && agents.length > 0 && (
        <DataTable
          data={agents}
          columns={[
            { key: 'name', header: 'Name', cell: (r) => <span className="font-medium">{r.name}</span> },
            { key: 'role', header: 'Role', cell: (r) => <span className="capitalize">{r.role}</span> },
            { key: 'model', header: 'Model', cell: (r) => r.model_id },
            { key: 'version', header: 'Version', cell: (r) => r.definition_version },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      )}
    </div>
  );
}