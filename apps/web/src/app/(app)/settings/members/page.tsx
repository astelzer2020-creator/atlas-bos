'use client';

import * as React from 'react';
import { Badge } from '@atlas/ui';

import { SearchableDataTable } from '@/components/searchable-data-table';
import { PageHeader } from '@/components/page-header';
import { PageEmpty, PageError, PageLoading } from '@/components/page-states';
import { useOrgContext } from '@/hooks/use-org-context';
import { ApiError, organizationApi } from '@/lib/api-client';
import type { OrganizationMember } from '@/lib/api-types';

export default function MembersSettingsPage() {
  const { accessToken, organizationId } = useOrgContext();
  const [members, setMembers] = React.useState<OrganizationMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await organizationApi.listMembers(accessToken, organizationId);
      setMembers([...result.data]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load members.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, organizationId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Members"
        description="People with access to this organization."
      />

      {loading && <PageLoading />}
      {!loading && error && <PageError message={error} onRetry={() => void load()} />}
      {!loading && !error && members.length === 0 && (
        <PageEmpty title="No members" description="Organization members will appear here." />
      )}
      {!loading && !error && members.length > 0 && (
        <SearchableDataTable
          data={members}
          searchPlaceholder="Search by name or email..."
          searchKeys={[
            (m) => m.user.display_name ?? '',
            (m) => m.user.email,
            (m) => m.title ?? '',
            (m) => m.department ?? '',
          ]}
          columns={[
            {
              key: 'name',
              header: 'Name',
              cell: (m) => (
                <span className="font-medium">{m.user.display_name ?? m.user.email}</span>
              ),
            },
            { key: 'email', header: 'Email', cell: (m) => m.user.email },
            {
              key: 'role',
              header: 'Role',
              cell: (m) => (
                <Badge variant={m.is_owner ? 'info' : 'neutral'}>
                  {m.is_owner ? 'Owner' : 'Member'}
                </Badge>
              ),
            },
            { key: 'title', header: 'Title', cell: (m) => m.title ?? '—' },
            {
              key: 'joined',
              header: 'Joined',
              cell: (m) => new Date(m.joined_at).toLocaleDateString(),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (m) => <span className="capitalize">{m.status.toLowerCase()}</span>,
            },
          ]}
        />
      )}
    </div>
  );
}