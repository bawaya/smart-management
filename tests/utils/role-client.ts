import { ApiClient } from './api-client.js';
import { apiLogin } from './auth-helpers.js';
import { Role } from './config.js';

const cache = new Map<Role, ApiClient>();

/** يرجع ApiClient مسجّل دخول بهذا الدور (cached) */
export async function getClient(role: Role): Promise<ApiClient> {
  if (cache.has(role)) return cache.get(role)!;
  const token = await apiLogin(role);
  const client = new ApiClient(token);
  cache.set(role, client);
  return client;
}

export function clearClientCache() { cache.clear(); }
