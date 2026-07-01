'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, useToast } from '@atlas/ui';

import { StatusBadge } from '@/components/data-table';
import { SearchableDataTable } from '@/components/searchable-data-table';
import { PageHeader } from '@/components/page-header';
import { FormError, PageEmpty, PageError, PageLoading } from '@/components/page-states';
import { useOrgContext } from '@/hooks/use-org-context';
import { ApiError, crmApi } from '@/lib/api-client';
import { fieldError } from '@/lib/form-utils';
import type { CrmAccount } from '@/lib/api-types';

export default function CrmAccountsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { accessToken, organizationId } = useOrgContext();
  const [accounts, setAccounts] = React.useState<CrmAccount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [industry, setIndustry] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await crmApi.listAccounts(accessToken, organizationId);
      setAccounts([...result.data]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load accounts.');
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
      await crmApi.createAccount(accessToken, organizationId, {
        name,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        ...(industry ? { industry } : {}),
      });
      setName('');
      setEmail('');
      setPhone('');
      setIndustry('');
      setShowForm(false);
      addToast({ title: 'Account created', variant: 'success' });
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Failed to create account.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Accounts"
        description="Manage customer and partner accounts."
        actions={
          <Button onClick={() => { setShowForm((v) => !v); }}>
            {showForm ? 'Cancel' : 'New Account'}
          </Button>
        }
      />

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreate(e)} className="grid gap-4 sm:grid-cols-2">
              <FormError message={formError} />
              <Input label="Name" required value={name} onChange={(e) => { setName(e.target.value); }} {...fieldError(fieldErrors, 'name')} disabled={submitting} />
              <Input label="Email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); }} {...fieldError(fieldErrors, 'email')} disabled={submitting} />
              <Input label="Phone" value={phone} onChange={(e) => { setPhone(e.target.value); }} {...fieldError(fieldErrors, 'phone')} disabled={submitting} />
              <Input label="Industry" value={industry} onChange={(e) => { setIndustry(e.target.value); }} {...fieldError(fieldErrors, 'industry')} disabled={submitting} />
              <div className="sm:col-span-2">
                <Button type="submit" loading={submitting}>Create Account</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading && <PageLoading />}
      {!loading && error && <PageError message={error} onRetry={() => void load()} />}
      {!loading && !error && accounts.length === 0 && (
        <PageEmpty title="No accounts yet" description="Create your first account to get started." action={<Button onClick={() => { setShowForm(true); }}>New Account</Button>} />
      )}
      {!loading && !error && accounts.length > 0 && (
        <SearchableDataTable
          data={accounts}
          searchPlaceholder="Search accounts..."
          searchKeys={[(r) => r.name, (r) => r.email ?? '', (r) => r.industry ?? '']}
          onRowClick={(r) => { router.push(`/crm/accounts/${r.id}`); }}
          columns={[
            { key: 'name', header: 'Name', cell: (r) => <span className="font-medium">{r.name}</span> },
            { key: 'type', header: 'Type', cell: (r) => <span className="capitalize">{r.accountType}</span> },
            { key: 'email', header: 'Email', cell: (r) => r.email ?? '—' },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
            { key: 'updated', header: 'Updated', cell: (r) => new Date(r.updatedAt).toLocaleDateString() },
          ]}
        />
      )}
    </div>
  );
}