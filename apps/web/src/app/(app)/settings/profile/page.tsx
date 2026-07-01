'use client';

import * as React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@atlas/ui';

import { PageHeader } from '@/components/page-header';
import { FormError, PageLoading } from '@/components/page-states';
import { useOrgContext } from '@/hooks/use-org-context';
import { ApiError, userApi } from '@/lib/api-client';
import { fieldError } from '@/lib/form-utils';

export default function ProfileSettingsPage() {
  const { accessToken, user, refresh } = useOrgContext();
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [displayName, setDisplayName] = React.useState('');
  const [locale, setLocale] = React.useState('');
  const [timezone, setTimezone] = React.useState('');

  React.useEffect(() => {
    if (user) {
      setDisplayName(user.display_name ?? '');
      setLocale(user.locale);
      setTimezone(user.timezone);
    }
  }, [user]);

  async function handleSubmit(event: React.SubmitEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      await userApi.updateProfile(accessToken, {
        display_name: displayName,
        locale,
        timezone,
      });
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Failed to update profile.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return <PageLoading label="Loading profile..." />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader title="Profile Settings" description="Manage your personal account details." />

      <Card>
        <CardHeader><CardTitle>Your Profile</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4">
            <FormError message={formError} />
            <Input label="Email" value={user.email} disabled />
            <Input label="Display name" value={displayName} onChange={(e) => { setDisplayName(e.target.value); }} {...fieldError(fieldErrors, 'display_name')} disabled={submitting} />
            <Input label="Locale" value={locale} onChange={(e) => { setLocale(e.target.value); }} {...fieldError(fieldErrors, 'locale')} disabled={submitting} placeholder="en-US" />
            <Input label="Timezone" value={timezone} onChange={(e) => { setTimezone(e.target.value); }} {...fieldError(fieldErrors, 'timezone')} disabled={submitting} placeholder="America/New_York" />
            <Button type="submit" loading={submitting}>Save Changes</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}