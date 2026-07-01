'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, useToast } from '@atlas/ui';

import { FormError } from '@/components/page-states';
import { ApiError, organizationApi, workspaceApi } from '@/lib/api-client';
import { fieldError } from '@/lib/form-utils';
import { slugify } from '@/lib/slug';
import { setOrganizationId } from '@/lib/auth';

export function OnboardingWizard({
  accessToken,
  onComplete,
}: {
  accessToken: string;
  onComplete: () => Promise<void>;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [step, setStep] = React.useState<1 | 2>(1);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const [workspaceName, setWorkspaceName] = React.useState('');
  const [workspaceId, setWorkspaceId] = React.useState<string | null>(null);

  const [orgName, setOrgName] = React.useState('');
  const [orgSlug, setOrgSlug] = React.useState('');
  const [timezone, setTimezone] = React.useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  );

  React.useEffect(() => {
    if (orgName && !orgSlug) {
      setOrgSlug(slugify(orgName));
    }
  }, [orgName, orgSlug]);

  async function handleCreateWorkspace(event: React.SubmitEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const slug = slugify(workspaceName);
      const result = await workspaceApi.create(accessToken, {
        name: workspaceName.trim(),
        slug,
        display_name: workspaceName.trim(),
      });
      setWorkspaceId(result.id);
      setStep(2);
      addToast({ title: 'Workspace created', variant: 'success' });
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Failed to create workspace.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateOrganization(event: React.SubmitEvent) {
    event.preventDefault();
    if (!workspaceId) {
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const org = await organizationApi.create(accessToken, {
        workspace_id: workspaceId,
        name: orgName.trim(),
        slug: orgSlug.trim() || slugify(orgName),
        display_name: orgName.trim(),
        timezone,
        locale: 'en-US',
        currency_code: 'USD',
      });

      setOrganizationId(org.id);
      addToast({ title: 'Organization ready', description: 'Welcome to Atlas.', variant: 'success' });
      await onComplete();
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Failed to create organization.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-lg shadow-elevation-2">
      <CardHeader>
        <CardTitle>Set up your workspace</CardTitle>
        <CardDescription>
          {step === 1
            ? 'Create a workspace to group your organizations.'
            : 'Create your first organization to start using Atlas.'}
        </CardDescription>
        <div className="mt-4 flex gap-2" aria-label="Onboarding progress">
          <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-brand-600' : 'bg-border'}`} />
          <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-brand-600' : 'bg-border'}`} />
        </div>
      </CardHeader>

      <CardContent>
        {step === 1 && (
          <form onSubmit={(e) => void handleCreateWorkspace(e)} className="flex flex-col gap-4">
            <FormError message={formError} />
            <Input
              label="Workspace name"
              required
              value={workspaceName}
              onChange={(e) => { setWorkspaceName(e.target.value); }}
              {...fieldError(fieldErrors, 'name')}
              disabled={submitting}
              helperText="Usually your company or team name."
            />
            <Button type="submit" loading={submitting}>
              Continue
            </Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={(e) => void handleCreateOrganization(e)} className="flex flex-col gap-4">
            <FormError message={formError} />
            <Input
              label="Organization name"
              required
              value={orgName}
              onChange={(e) => { setOrgName(e.target.value); }}
              {...fieldError(fieldErrors, 'name')}
              disabled={submitting}
            />
            <Input
              label="URL slug"
              required
              value={orgSlug}
              onChange={(e) => { setOrgSlug(e.target.value); }}
              {...fieldError(fieldErrors, 'slug')}
              disabled={submitting}
              helperText="Used in URLs and API identifiers."
            />
            <Input
              label="Timezone"
              value={timezone}
              onChange={(e) => { setTimezone(e.target.value); }}
              {...fieldError(fieldErrors, 'timezone')}
              disabled={submitting}
            />
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => { setStep(1); }} disabled={submitting}>
                Back
              </Button>
              <Button type="submit" loading={submitting}>
                Launch Atlas
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}