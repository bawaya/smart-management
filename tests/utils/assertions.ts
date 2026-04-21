import type { ApiResponse } from './api-client.js';

export function expectOk(res: ApiResponse, msg?: string) {
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`${msg ?? 'Expected 2xx'} — got ${res.status}: ${res.raw.slice(0, 300)}`);
  }
}

export function expectStatus(res: ApiResponse, status: number) {
  if (res.status !== status) {
    throw new Error(`Expected status ${status} — got ${res.status}: ${res.raw.slice(0, 300)}`);
  }
}

export function expectNoServerError(res: ApiResponse) {
  if (res.status >= 500) throw new Error(`5xx error: ${res.status} — ${res.raw.slice(0, 300)}`);
}

export function expectNoStackLeak(res: ApiResponse) {
  const r = res.raw.toLowerCase();
  const bad = ['at /', 'node_modules', 'stack trace', 'sqlite', 'd1_error', 'syntax error'];
  for (const b of bad) {
    if (r.includes(b)) throw new Error(`Stack/infra leaked in response: found "${b}"`);
  }
}
