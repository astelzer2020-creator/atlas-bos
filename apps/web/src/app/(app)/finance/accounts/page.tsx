'use client';

import * as React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@atlas/ui';

import { DataTable, StatusBadge } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { FormError, PageEmpty, PageError, PageLoading } from '@/components/page-states';
import { useOrgContext } from '@/hooks/use-org-context';
import { ApiError, financeApi } from '@/lib/api-client';
import { fieldError } from '@/lib/form-utils';
import type { ChartOfAccount } from '@/lib/api-types';

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const;
const NORMAL_BALANCES = ['debit', 'credit'] as const;

export default function FinanceAccountsPage() {
  const { accessToken, organizationId } = useOrgContext();
  const [accounts, setAccounts] = React.useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [accountType, setAccountType] = React.useState<string>('asset');
  const [normalBalance, setNormalBalance] = React.useState<string>('debit');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await financeApi.listAccounts(accessToken, organizationId);
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
      await financeApi.createAccount(accessToken, organizationId, {
        code,
        name,
        accountType,
        normalBalance,
      });
      setCode('');
      setName('');
      setShowForm(false);
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
        title="Chart of Accounts"
        description="Manage ledger accounts for your organization."
        actions={<Button onClick={() => { setShowForm((v) => !v); }}>{showForm ? 'Cancel' : 'New Account'}</Button>}
      />

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Create Account</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreate(e)} className="grid gap-4 sm:grid-cols-2">
              <FormError message={formError} />
              <Input label="Code" required value={code} onChange={(e) => { setCode(e.target.value); }} {...fieldError(fieldErrors, 'code')} disabled={submitting} placeholder="1000" />
              <Input label="Name" required value={name} onChange={(e) => { setName(e.target.value); }} {...fieldError(fieldErrors, 'name')} disabled={submitting} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="type" className="text-label-sm font-medium">Account type</label>
                <select id="type" value={accountType} onChange={(e) => { setAccountType(e.target.value); }} className="rounded-md border border-border bg-canvas px-3 py-2 text-body-md">
                  {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="balance" className="text-label-sm font-medium">Normal balance</label>
                <select id="balance" value={normalBalance} onChange={(e) => { setNormalBalance(e.target.value); }} className="rounded-md border border-border bg-canvas px-3 py-2 text-body-md">
                  {NORMAL_BALANCES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2"><Button type="submit" loading={submitting}>Create Account</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading && <PageLoading />}
      {!loading && error && <PageError message={error} onRetry={() => void load()} />}
      {!loading && !error && accounts.length === 0 && (
        <PageEmpty title="No accounts yet" description="Set up your chart of accounts." action={<Button onClick={() => { setShowForm(true); }}>New Account</Button>} />
      )}
      {!loading && !error && accounts.length > 0 && (
        <DataTable
          data={accounts}
          columns={[
            { key: 'code', header: 'Code', cell: (r) => <span className="font-mono">{r.code}</span> },
            { key: 'name', header: 'Name', cell: (r) => <span className="font-medium">{r.name}</span> },
            { key: 'type', header: 'Type', cell: (r) => <span className="capitalize">{r.accountType}</span> },
            { key: 'balance', header: 'Normal Balance', cell: (r) => <span className="capitalize">{r.normalBalance}</span> },
            { key: 'active', header: 'Active', cell: (r) => <StatusBadge status={r.isActive ? 'active' : 'inactive'} /> },
          ]}
        />
      )}
    </div>
  );
}