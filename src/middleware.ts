import {
  type NextFetchEvent,
  type NextRequest,
  NextResponse,
} from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';

const EXACT_BYPASS = new Set([
  '/login',
  '/setup',
  '/maintenance',
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

/**
 * Maintenance bypass: paths that remain accessible when MAINTENANCE_MODE=1.
 * - The maintenance page itself must be reachable.
 * - Static Next.js assets must load for the page to render correctly.
 * - /api/health stays up so uptime monitors keep working.
 */
const MAINTENANCE_BYPASS_PREFIXES = ['/_next', '/icons/', '/workbox-'];
const MAINTENANCE_BYPASS_EXACT = new Set([
  '/maintenance',
  '/api/health',
  '/favicon.ico',
  '/manifest.json',
  '/offline.html',
  '/sw.js',
]);

/**
 * True when maintenance mode is on. Checks both:
 *  1. Cloudflare runtime env var `MAINTENANCE_MODE` (production).
 *  2. `process.env.MAINTENANCE_MODE` (local dev via `.env.local`).
 * Set the value to `"1"` to enable.
 */
async function isMaintenanceEnabled(): Promise<boolean> {
  if (typeof process !== 'undefined' && process.env?.MAINTENANCE_MODE === '1') {
    return true;
  }
  try {
    const { getOptionalRequestContext } = await import(
      '@cloudflare/next-on-pages'
    );
    const ctx = getOptionalRequestContext();
    return ctx?.env?.MAINTENANCE_MODE === '1';
  } catch {
    return false;
  }
}

function shouldBypassMaintenance(pathname: string): boolean {
  if (MAINTENANCE_BYPASS_EXACT.has(pathname)) return true;
  if (MAINTENANCE_BYPASS_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return STATIC_EXT.test(pathname);
}

/**
 * Minimal payload we collect per request. Pass-through to `logRequest`.
 */
interface RequestLogData {
  url: string;
  method: string;
  outcome: string;
  durationMs: number;
  userId: string | null;
  tenantId: string | null;
  userAgent: string | null;
  cfRay: string | null;
  cfCountry: string | null;
  ip: string | null;
}

/**
 * Write one row to `request_log` via the D1 binding. Fails silently —
 * observability must never impact the user's request.
 *
 * Dynamic-imports `@cloudflare/next-on-pages` so this code doesn't break
 * `npm run dev` (local SQLite path has no CF runtime).
 */
async function logRequest(data: RequestLogData): Promise<void> {
  try {
    const { getOptionalRequestContext } = await import(
      '@cloudflare/next-on-pages'
    );
    const ctx = getOptionalRequestContext();
    if (!ctx) return; // local dev — no CF runtime, skip silently

    await ctx.env.DB.prepare(
      `INSERT INTO request_log
         (url, method, outcome, duration_ms, user_id, tenant_id,
          user_agent, cf_ray, cf_country, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        data.url.length > 2_000 ? data.url.slice(0, 2_000) : data.url,
        data.method,
        data.outcome,
        data.durationMs,
        data.userId,
        data.tenantId,
        data.userAgent
          ? data.userAgent.length > 500
            ? data.userAgent.slice(0, 500)
            : data.userAgent
          : null,
        data.cfRay,
        data.cfCountry,
        data.ip,
      )
      .run();
  } catch {
    // Swallow — observability failure must not affect the request.
  }
}

export async function middleware(
  request: NextRequest,
  event: NextFetchEvent,
): Promise<NextResponse> {
  const start = Date.now();
  const { pathname } = request.nextUrl;

  if (!shouldBypassMaintenance(pathname) && (await isMaintenanceEnabled())) {
    const maintenanceUrl = new URL('/maintenance', request.url);
    return NextResponse.rewrite(maintenanceUrl, {
      status: 503,
      headers: { 'Retry-After': '3600' },
    });
  }

  if (shouldBypass(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth-token')?.value;
  const payload = token ? await verifyToken(token) : null;

  const h = request.headers;
  const baseLog: Omit<RequestLogData, 'outcome' | 'durationMs' | 'userId' | 'tenantId'> = {
    url: request.nextUrl.toString(),
    method: request.method,
    userAgent: h.get('user-agent'),
    cfRay: h.get('cf-ray'),
    cfCountry: h.get('cf-ipcountry'),
    ip: h.get('cf-connecting-ip'),
  };

  if (!payload) {
    event.waitUntil(
      logRequest({
        ...baseLog,
        outcome: 'auth_redirect',
        durationMs: Date.now() - start,
        userId: null,
        tenantId: null,
      }),
    );
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const headers = new Headers(request.headers);
  headers.set('x-user-id', payload.userId);
  headers.set('x-user-role', payload.role);
  headers.set('x-user-username', payload.username);
  headers.set('x-tenant-id', payload.tenantId);

  event.waitUntil(
    logRequest({
      ...baseLog,
      outcome: 'auth_ok',
      durationMs: Date.now() - start,
      userId: payload.userId,
      tenantId: payload.tenantId,
    }),
  );

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
