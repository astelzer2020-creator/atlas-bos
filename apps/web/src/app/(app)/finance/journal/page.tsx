'use client';

import * as React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@atlas/ui';

import { DataTable, StatusBadge } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { FormError, PageEmpty, PageError, PageLoading } from '@/components/page-states';
import { useOrgContext } from '@/hooks/use-org-context';
import { ApiError, financeApi } from '@/lib/api-client';
import { fieldError } from '@/lib/form-utils';
import type { ChartOfAccount, JournalEntry } from '@/lib/api-types';

export default function FinanceJournalPage() {
  const { accessToken, organizationId } = useOrgContext();
  const [entries, setEntries] = React.useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = React.useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [description, setDescription] = React.useState('');
  const [debitAccountId, setDebitAccountId] = React.useState('');
  const [creditAccountId, setCreditAccountId] = React.useState('');
  const [amount, setAmount] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [entriesResult, accountsResult] = await Promise.all([
        financeApi.listJournalEntries(accessToken, organizationId),
        financeApi.listAccounts(accessToken, organizationId),
      ]);
      setEntries([...entriesResult.data]);
      setAccounts([...accountsResult.data]);
      if (accountsResult.data[0] && !debitAccountId) {
        setDebitAccountId(accountsResult.data[0].id);
        setCreditAccountId(accountsResult.data[1]?.id ?? accountsResult.data[0].id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load journal entries.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, organizationId, debitAccountId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: React.SubmitEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      await financeApi.createJournalEntry(accessToken, organizationId, {
        description,
        lines: [
          { accountId: debitAccountId, debitAmount: amount, description: 'Debit line' },
          { accountId: creditAccountId, creditAmount: amount, description: 'Credit line' },
        ],
      });
      setDescription('');
      setAmount('');
      setShowForm(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Failed to create journal entry.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Journal Entries"
        description="Record financial transactions."
        actions={<Button onClick={() => { setShowForm((v) => !v); }} disabled={accounts.length < 2}>{showForm ? 'Cancel' : 'New Entry'}</Button>}
      />

      {accounts.length < 2 && !loading && (
        <PageEmpty title="Need at least 2 accounts" description="Create chart of accounts before posting journal entries." />
      )}

      {showForm && accounts.length >= 2 && (
        <Card>
          <CardHeader><CardTitle>Create Journal Entry</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreate(e)} className="grid gap-4 sm:grid-cols-2">
              <FormError message={formError} />
              <div className="sm:col-span-2">
                <Input label="Description" required value={description} onChange={(e) => { setDescription(e.target.value); }} {...fieldError(fieldErrors, 'description')} disabled={submitting} />
              </div>
              <Input label="Amount" required value={amount} onChange={(e) => { setAmount(e.target.value); }} {...fieldError(fieldErrors, 'amount')} disabled={submitting} placeholder="100.00" />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="debit" className="text-label-sm font-medium">Debit account</label>
                <select id="debit" value={debitAccountId} onChange={(e) => { setDebitAccountId(e.target.value); }} className="rounded-md border border-border bg-canvas px-3 py-2 text-body-md">
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="credit" className="text-label-sm font-medium">Credit account</label>
                <select id="credit" value={creditAccountId} onChange={(e) => { setCreditAccountId(e.target.value); }} className="rounded-md border border-border bg-canvas px-3 py-2 text-body-md">
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2"><Button type="submit" loading={submitting}>Create Entry</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading && <PageLoading />}
      {!loading && error && <PageError message={error} onRetry={() => void load()} />}
      {!loading && !error && entries.length === 0 && accounts.length >= 2 && (
        <PageEmpty title="No journal entries yet" description="Post your first journal entry." action={<Button onClick={() => { setShowForm(true); }}>New Entry</Button>} />
      )}
      {!loading && !error && entries.length > 0 && (
        <DataTable
          data={entries}
          columns={[
            { key: 'number', header: 'Entry #', cell: (r) => <span className="font-mono">{r.entryNumber}</span> },
            { key: 'date', header: 'Date', cell: (r) => new Date(r.entryDate).toLocaleDateString() },
            { key: 'desc', header: 'Description', cell: (r) => r.description },
            { key: 'debit', header: 'Debit', cell: (r) => r.totalDebit },
            { key: 'credit', header: 'Credit', cell: (r) => r.totalCredit },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      )}
    </div>
  );
}