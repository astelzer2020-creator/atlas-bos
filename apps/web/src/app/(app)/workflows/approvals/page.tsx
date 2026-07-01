'use client';

import * as React from 'react';
import { Button, Input, useToast } from '@atlas/ui';

import { DataTable, StatusBadge } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { PageEmpty, PageError, PageLoading } from '@/components/page-states';
import { useOrgContext } from '@/hooks/use-org-context';
import { ApiError, workflowApi } from '@/lib/api-client';
import type { WorkflowApproval } from '@/lib/api-types';

export default function WorkflowApprovalsPage() {
  const { accessToken, organizationId } = useOrgContext();
  const { addToast } = useToast();
  const [approvals, setApprovals] = React.useState<WorkflowApproval[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actingId, setActingId] = React.useState<string | null>(null);
  const [rejectingId, setRejectingId] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await workflowApi.listApprovals(accessToken, organizationId);
      setApprovals([...result.data]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load approvals.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, organizationId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleApprove(approvalId: string) {
    setActingId(approvalId);
    try {
      await workflowApi.approve(accessToken, organizationId, approvalId);
      addToast({ title: 'Approval granted', variant: 'success' });
      await load();
    } catch (err) {
      addToast({
        title: 'Approval failed',
        description: err instanceof ApiError ? err.message : 'Unable to approve.',
        variant: 'error',
      });
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(approvalId: string) {
    if (!rejectReason.trim()) {
      return;
    }
    setActingId(approvalId);
    try {
      await workflowApi.reject(accessToken, organizationId, approvalId, {
        reason: rejectReason.trim(),
      });
      addToast({ title: 'Approval rejected', variant: 'success' });
      setRejectingId(null);
      setRejectReason('');
      await load();
    } catch (err) {
      addToast({
        title: 'Rejection failed',
        description: err instanceof ApiError ? err.message : 'Unable to reject.',
        variant: 'error',
      });
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader title="Approvals" description="Review pending workflow approval requests." />

      {loading && <PageLoading />}
      {!loading && error && <PageError message={error} onRetry={() => void load()} />}
      {!loading && !error && approvals.length === 0 && (
        <PageEmpty title="No approvals" description="Approval requests will appear here when workflows require sign-off." />
      )}
      {!loading && !error && approvals.length > 0 && (
        <DataTable
          data={approvals}
          columns={[
            { key: 'title', header: 'Title', cell: (r) => <span className="font-medium">{r.title}</span> },
            { key: 'type', header: 'Type', cell: (r) => r.approval_type },
            { key: 'requested', header: 'Requested', cell: (r) => new Date(r.requested_at).toLocaleString() },
            { key: 'expires', header: 'Expires', cell: (r) => r.expires_at ? new Date(r.expires_at).toLocaleString() : '—' },
            { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
            {
              key: 'actions',
              header: '',
              cell: (r) =>
                r.status.toLowerCase() === 'pending' ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      loading={actingId === r.id && rejectingId !== r.id}
                      onClick={() => void handleApprove(r.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setRejectingId(r.id);
                        setRejectReason('');
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                ) : null,
            },
          ]}
        />
      )}

      {rejectingId && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-3 text-body-sm font-medium">Rejection reason</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              label="Reason"
              value={rejectReason}
              onChange={(e) => { setRejectReason(e.target.value); }}
              className="flex-1"
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => { setRejectingId(null); }}
              >
                Cancel
              </Button>
              <Button
                loading={actingId === rejectingId}
                onClick={() => void handleReject(rejectingId)}
                disabled={!rejectReason.trim()}
              >
                Confirm reject
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}