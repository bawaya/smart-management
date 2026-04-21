import 'dotenv/config';

export const BASE_URL = process.env.BASE_URL ?? 'https://smart-management.pages.dev';
export const TENANT_PREFIX = process.env.TEST_TENANT_PREFIX ?? 'test_ci_';

export type Role = 'owner' | 'manager' | 'accountant' | 'operator' | 'viewer';

export const CREDS: Record<Role, { username: string; password: string }> = {
  owner:      { username: process.env.OWNER_USERNAME      ?? '', password: process.env.OWNER_PASSWORD      ?? '' },
  manager:    { username: process.env.MANAGER_USERNAME    ?? '', password: process.env.MANAGER_PASSWORD    ?? '' },
  accountant: { username: process.env.ACCOUNTANT_USERNAME ?? '', password: process.env.ACCOUNTANT_PASSWORD ?? '' },
  operator:   { username: process.env.OPERATOR_USERNAME   ?? '', password: process.env.OPERATOR_PASSWORD   ?? '' },
  viewer:     { username: process.env.VIEWER_USERNAME     ?? '', password: process.env.VIEWER_PASSWORD     ?? '' },
};

export function assertCreds(role: Role) {
  if (!CREDS[role].username || !CREDS[role].password) {
    throw new Error(`Missing credentials for role "${role}". Update tests/.env`);
  }
}
