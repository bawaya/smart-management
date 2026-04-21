import { BASE_URL } from './config.js';

export type ApiResponse<T = any> = {
  status: number;
  headers: Record<string, string>;
  body: T;
  raw: string;
};

export class ApiClient {
  constructor(private token?: string) {}

  private async req<T = any>(method: string, path: string, body?: any): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Cookie'] = `auth-token=${this.token}`;

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const raw = await res.text();
    let parsed: any = raw;
    try { parsed = JSON.parse(raw); } catch { /* non-json */ }

    const hdrs: Record<string, string> = {};
    res.headers.forEach((v, k) => { hdrs[k] = v; });

    return { status: res.status, headers: hdrs, body: parsed, raw };
  }

  get<T = any>(path: string)                 { return this.req<T>('GET', path); }
  post<T = any>(path: string, body?: any)    { return this.req<T>('POST', path, body); }
  patch<T = any>(path: string, body?: any)   { return this.req<T>('PATCH', path, body); }
  put<T = any>(path: string, body?: any)     { return this.req<T>('PUT', path, body); }
  delete<T = any>(path: string)              { return this.req<T>('DELETE', path); }

  setToken(token: string) { this.token = token; }
}
