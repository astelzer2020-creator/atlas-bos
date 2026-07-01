'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, useToast } from '@atlas/ui';

import { StatusBadge } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { FormError, PageError, PageLoading } from '@/components/page-states';
import { useOrgContext } from '@/hooks/use-org-context';
import { ApiError, crmApi } from '@/lib/api-client';
import { fieldError } from '@/lib/form-utils';
import type { CrmAccount } from '@/lib/api-types';

export default function CrmAccountDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();
  const { accessToken, organizationId } = useOrgContext();
  const [account, setAccount] = React.useState<CrmAccount | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
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
      const result = await crmApi.getAccount(accessToken, organizationId, params.id);
      setAccount(result);
      setName(result.name);
      setEmail(result.email ?? '');
      setPhone(result.phone ?? '');
      setIndustry(result.industry ?? '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load account.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, organizationId, params.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(event: React.SubmitEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const updated = await crmApi.updateAccount(accessToken, organizationId, params.id, {
        name,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        ...(industry ? { industry } : {}),
      });
      setAccount(updated);
      setEditing(false);
      addToast({ title: 'Account updated', variant: 'success' });
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Failed to update account.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <PageLoading label="Loading account..." />;
  }

  if (error || !account) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageError message={error ?? 'Account not found.'} onRetry={() => void load()} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title={account.name}
        description="Account details"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { router.push('/crm/accounts'); }}>
              Back
            </Button>
            <Button onClick={() => { setEditing((v) => !v); }}>
              {editing ? 'Cancel' : 'Edit'}
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Overview
            <StatusBadge status={account.status} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <form onSubmit={(e) => void handleSave(e)} className="grid gap-4 sm:grid-cols-2">
              <FormError message={formError} />
              <Input label="Name" required value={name} onChange={(e) => { setName(e.target.value); }} {...fieldError(fieldErrors, 'name')} disabled={submitting} />
              <Input label="Email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); }} {...fieldError(fieldErrors, 'email')} disabled={submitting} />
              <Input label="Phone" value={phone} onChange={(e) => { setPhone(e.target.value); }} {...fieldError(fieldErrors, 'phone')} disabled={submitting} />
              <Input label="Industry" value={industry} onChange={(e) => { setIndustry(e.target.value); }} {...fieldError(fieldErrors, 'industry')} disabled={submitting} />
              <div className="sm:col-span-2">
                <Button type="submit" loading={submitting}>Save changes</Button>
              </div>
            </form>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-label-sm text-foreground-tertiary">Type</dt>
                <dd className="capitalize text-foreground-primary">{account.accountType}</dd>
              </div>
              <div>
                <dt className="text-label-sm text-foreground-tertiary">Email</dt>
                <dd>{account.email ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-label-sm text-foreground-tertiary">Phone</dt>
                <dd>{account.phone ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-label-sm text-foreground-tertiary">Industry</dt>
                <dd>{account.industry ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-label-sm text-foreground-tertiary">Updated</dt>
                <dd>{new Date(account.updatedAt).toLocaleString()}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <p className="text-body-sm text-foreground-tertiary">
        <Link href="/crm/contacts" className="text-foreground-link hover:underline">
          View contacts
        </Link>
        {' · '}
        <Link href="/crm/deals" className="text-foreground-link hover:underline">
          View deals
        </Link>
      </p>
    </div>
  );
}