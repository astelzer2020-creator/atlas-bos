'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { ApiError, authApi, organizationApi } from '@/lib/api-client';
import type { CurrentUser, Organization } from '@/lib/api-types';
import {
  clearSession,
  getAccessToken,
  getOrganizationId,
  setOrganizationId,
} from '@/lib/auth';

export interface OrgContextValue {
  readonly accessToken: string;
  readonly organizationId: string;
  readonly organization: Organization | null;
  readonly user: CurrentUser | null;
  readonly organizations: readonly Organization[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly setOrganization: (organizationId: string) => void;
  readonly refresh: () => Promise<void>;
  readonly signOut: () => Promise<void>;
}

const OrgContext = React.createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [accessToken, setAccessTokenState] = React.useState<string | null>(null);
  const [organizationId, setOrganizationIdState] = React.useState<string | null>(null);
  const [organization, setOrganizationState] = React.useState<Organization | null>(null);
  const [organizations, setOrganizations] = React.useState<Organization[]>([]);
  const [user, setUser] = React.useState<CurrentUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadContext = React.useCallback(async () => {
    const token = getAccessToken();

    if (!token) {
      router.replace('/login');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [userResult, orgsResult] = await Promise.all([
        authApi.me(token),
        organizationApi.list(token),
      ]);

      setAccessTokenState(token);
      setUser(userResult);
      setOrganizations([...orgsResult.data]);

      const storedOrgId = getOrganizationId();
      const selectedOrg =
        orgsResult.data.find((org) => org.id === storedOrgId) ?? orgsResult.data[0] ?? null;

      if (selectedOrg) {
        setOrganizationId(selectedOrg.id);
        setOrganizationIdState(selectedOrg.id);
        setOrganizationState(selectedOrg);
      } else {
        setOrganizationIdState(null);
        setOrganizationState(null);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession();
        router.replace('/login');
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Failed to load workspace context.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  React.useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const handleSetOrganization = React.useCallback((nextOrgId: string) => {
    setOrganizationId(nextOrgId);
    setOrganizationIdState(nextOrgId);
    const nextOrg = organizations.find((org) => org.id === nextOrgId) ?? null;
    setOrganizationState(nextOrg);
  }, [organizations]);

  const signOut = React.useCallback(async () => {
    const token = getAccessToken();
    try {
      if (token) {
        await authApi.logout(token);
      }
    } catch {
      // Ignore logout errors and clear local session anyway.
    } finally {
      clearSession();
      router.replace('/login');
    }
  }, [router]);

  if (loading || !accessToken || !organizationId) {
    return (
      <OrgContext.Provider
        value={{
          accessToken: accessToken ?? '',
          organizationId: organizationId ?? '',
          organization,
          user,
          organizations,
          loading,
          error,
          setOrganization: handleSetOrganization,
          refresh: loadContext,
          signOut,
        }}
      >
        {children}
      </OrgContext.Provider>
    );
  }

  return (
    <OrgContext.Provider
      value={{
        accessToken,
        organizationId,
        organization,
        user,
        organizations,
        loading,
        error,
        setOrganization: handleSetOrganization,
        refresh: loadContext,
        signOut,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrgContext(): OrgContextValue {
  const context = React.useContext(OrgContext);
  if (!context) {
    throw new Error('useOrgContext must be used within OrgProvider');
  }
  return context;
}