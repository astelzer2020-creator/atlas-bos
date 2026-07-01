'use client';

import * as React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@atlas/ui';

import { PageHeader } from '@/components/page-header';
import { FormError, PageLoading } from '@/components/page-states';
import { useOrgContext } from '@/hooks/use-org-context';
import { ApiError, organizationApi } from '@/lib/api-client';
import { fieldError } from '@/lib/form-utils';

export default function OrganizationSettingsPage() {
  const { accessToken, organizationId, organization, refresh } = useOrgContext();
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [name, setName] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [timezone, setTimezone] = React.useState('');
  const [locale, setLocale] = React.useState('');
  const [currencyCode, setCurrencyCode] = React.useState('');

  React.useEffect(() => {
    if (organization) {
      setName(organization.name);
      setDisplayName(organization.display_name ?? '');
      setTimezone(organization.timezone);
      setLocale(organization.locale);
      setCurrencyCode(organization.currency_code);
    }
  }, [organization]);

  async function handleSubmit(event: React.SubmitEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      await organizationApi.update(accessToken, organizationId, {
        name,
        display_name: displayName || null,
        timezone,
        locale,
        currency_code: currencyCode,
      });
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Failed to update organization.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!organization) return <PageLoading label="Loading organization..." />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader title="Organization Settings" description="Manage workspace organization details." />

      <Card>
        <CardHeader><CardTitle>{organization.display_name ?? organization.name}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4">
            <FormError message={formError} />
            <Input label="Slug" value={organization.slug} disabled />
            <Input label="Name" required value={name} onChange={(e) => { setName(e.target.value); }} {...fieldError(fieldErrors, 'name')} disabled={submitting} />
            <Input label="Display name" value={displayName} onChange={(e) => { setDisplayName(e.target.value); }} {...fieldError(fieldErrors, 'display_name')} disabled={submitting} />
            <Input label="Timezone" value={timezone} onChange={(e) => { setTimezone(e.target.value); }} {...fieldError(fieldErrors, 'timezone')} disabled={submitting} />
            <Input label="Locale" value={locale} onChange={(e) => { setLocale(e.target.value); }} {...fieldError(fieldErrors, 'locale')} disabled={submitting} />
            <Input label="Currency code" value={currencyCode} onChange={(e) => { setCurrencyCode(e.target.value); }} {...fieldError(fieldErrors, 'currency_code')} disabled={submitting} maxLength={3} />
            <div className="text-body-sm text-foreground-secondary">
              Status: <span className="capitalize">{organization.status.toLowerCase()}</span>
            </div>
            <Button type="submit" loading={submitting}>Save Changes</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}