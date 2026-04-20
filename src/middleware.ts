import { type NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';

const EXACT_BYPASS = new Set([
  '/login',
  '/setup',
  '/api/auth/login',
  '/api/health',
  '/favicon.ico',
  '/manifest.json',
  '/offline.html',
  '/sw.js',
]);
const PREFIX_BYPASS = ['/_next', '/api/public', '/icons/', '/workbox-'];
const STATIC_EXT = /\.(png|jpg|jpeg|svg|css|js|json|html|ico|webmanifest|xml|map|woff2?|txt)$/i;

function shouldBypass(pathname: string): boolean {
  if (EXACT_BYPASS.has(pathname)) return true;
  if (PREFIX_BYPASS.some((p) => pathname.startsWith(p))) return true;
  return STATIC_EXT.test(pathname);
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (shouldBypass(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth-token')?.value;
  const payload = token ? await verifyToken(token) : null;

  if (!payload) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const headers = new Headers(request.headers);
  headers.set('x-user-id', payload.userId);
  headers.set('x-user-role', payload.role);
  headers.set('x-user-username', payload.username);
  headers.set('x-tenant-id', payload.tenantId);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
