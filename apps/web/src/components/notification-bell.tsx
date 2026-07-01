'use client';

import Link from 'next/link';
import * as React from 'react';
import { Badge } from '@atlas/ui';

import { ApiError, notificationsApi } from '@/lib/api-client';
import { useOrgContext } from '@/hooks/use-org-context';

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 2a5 5 0 00-5 5v2.5l-1.5 2.5h13L15 9.5V7a5 5 0 00-5-5zM8.5 16a1.5 1.5 0 003 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NotificationBell() {
  const { accessToken, organizationId } = useOrgContext();
  const [unreadCount, setUnreadCount] = React.useState(0);

  const loadCount = React.useCallback(async () => {
    if (!accessToken || !organizationId) {
      return;
    }
    try {
      const result = await notificationsApi.listInbox(accessToken, organizationId, { limit: 50 });
      const unread = result.data.filter((n) => !n.read_at).length;
      setUnreadCount(unread);
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setUnreadCount(0);
      }
    }
  }, [accessToken, organizationId]);

  React.useEffect(() => {
    void loadCount();
    const interval = setInterval(() => {
      void loadCount();
    }, 60_000);
    return () => { clearInterval(interval); };
  }, [loadCount]);

  return (
    <Link
      href="/notifications"
      className="focus-ring relative rounded-md p-2 text-foreground-secondary hover:bg-subtle hover:text-foreground-primary"
      aria-label={unreadCount > 0 ? `${String(unreadCount)} unread notifications` : 'Notifications'}
    >
      <BellIcon />
      {unreadCount > 0 && (
        <Badge
          variant="error"
          className="absolute -right-1 -top-1 min-w-5 justify-center px-1 py-0 text-[10px]"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </Link>
  );
}