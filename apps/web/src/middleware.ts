import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE = 'atlas_auth';
const PUBLIC_PATHS = new Set(['/', '/login', '/register', '/terms', '/privacy']);
function isPublicAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicAsset(pathname)) {
    return NextResponse.next();
  }

  const hasAuth = request.cookies.has(AUTH_COOKIE);

  const isAuthRoute = pathname === '/login' || pathname.startsWith('/login/') || pathname === '/register';

  if (isAuthRoute && hasAuth) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  const isPublic = PUBLIC_PATHS.has(pathname) || isAuthRoute;

  if (!isPublic && !hasAuth) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};