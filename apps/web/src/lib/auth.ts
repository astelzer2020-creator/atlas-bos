const ACCESS_TOKEN_KEY = 'atlas_access_token';
const ORGANIZATION_ID_KEY = 'atlas_organization_id';
const AUTH_COOKIE = 'atlas_auth';
const MFA_SESSION_KEY = 'atlas_mfa_session';

function setAuthCookie(present: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (present) {
    document.cookie = `${AUTH_COOKIE}=1; path=/; SameSite=Lax; max-age=86400`;
  } else {
    document.cookie = `${AUTH_COOKIE}=; path=/; SameSite=Lax; max-age=0`;
  }
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  setAuthCookie(true);
}

export function clearAccessToken(): void {
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  setAuthCookie(false);
}

export function setMfaSession(sessionId: string): void {
  window.sessionStorage.setItem(MFA_SESSION_KEY, sessionId);
}

export function getMfaSession(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.sessionStorage.getItem(MFA_SESSION_KEY);
}

export function clearMfaSession(): void {
  window.sessionStorage.removeItem(MFA_SESSION_KEY);
}

export function getOrganizationId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(ORGANIZATION_ID_KEY);
}

export function setOrganizationId(organizationId: string): void {
  window.localStorage.setItem(ORGANIZATION_ID_KEY, organizationId);
}

export function clearOrganizationId(): void {
  window.localStorage.removeItem(ORGANIZATION_ID_KEY);
}

export function clearSession(): void {
  clearAccessToken();
  clearOrganizationId();
  clearMfaSession();
}