'use client';

import * as React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@atlas/ui';

import { DataTable, StatusBadge } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { FormError, PageEmpty, PageError, PageLoading } from '@/components/page-states';
import { useOrgContext } from '@/hooks/use-org-context';
import { ApiError, crmApi } from '@/lib/api-client';
import { fieldError } from '@/lib/form-utils';
import type { CrmContact } from '@/lib/api-types';

export default function CrmContactsPage() {
  const { accessToken, organizationId } = useOrgContext();
  const [contacts, setContacts] = React.useState<CrmContact[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [displayName, setDisplayName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [jobTitle, setJobTitle] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await crmApi.listContacts(accessToken, organizationId);
      setContacts([...result.data]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load contacts.');
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
      await crmApi.createContact(accessToken, organizationId, {
        displayName,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        ...(jobTitle ? { jobTitle } : {}),
      });
      setDisplayName('');
      setEmail('');
      setPhone('');
      setJobTitle('');
      setShowForm(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Failed to create contact.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Contacts"
        description="Manage people and relationships."
        actions={<Button onClick={() => { setShowForm((v) => !v); }}>{showForm ? 'Cancel' : 'New Contact'}</Button>}
      />

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Create Contact</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreate(e)} className="grid gap-4 sm:grid-cols-2">
              <FormError message={formError} />
              <Input label="Display name" required value={displayName} onChange={(e) => { setDisplayName(e.target.value); }} {...fieldError(fieldErrors, 'displayName')} disabled={submitting} />
              <Input label="Email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); }} {...fieldError(fieldErrors, 'email')} disabled={submitting} />
              <Input label="Phone" value={phone} onChange={(e) => { setPhone(e.target.value); }} {...fieldError(fieldErrors, 'phone')} disabled={submitting} />
              <Input label="Job title" value={jobTitle} onChange={(e) => { setJobTitle(e.target.value); }} {...fieldError(fieldErrors, 'jobTitle')} disabled={submitting} />
              <div className="sm:col-span-2"><Button type="submit" loading={submitting}>Create Contact</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading && <PageLoading />}
      {!loading && error && <PageError message={error} onRetry={() => void load()} />}
      {!loading && !error && contacts.length === 0 && (
        <PageEmpty title="No contacts yet" description="Add contacts to track relationships." action={<Button onClick={() => { setShowForm(true); }}>New Contact</Button>} />
      )}
      {!loading && !error && contacts.length > 0 && (
        <DataTable
          data={contacts}
          columns={[
            { key: 'name', header: 'Name', cell: (r) => <span className="font-medium">{r.displayName}</span> },
            { key: 'email', header: 'Email', cell: (r) => r.email ?? '—' },
            { key: 'phone', header: 'Phone', cell: (r) => r.phone ?? '—' },
            { key: 'title', header: 'Title', cell: (r) => r.jobTitle ?? '—' },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      )}
    </div>
  );
}