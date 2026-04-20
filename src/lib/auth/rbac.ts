export type Role = 'owner' | 'manager' | 'accountant' | 'operator' | 'viewer';

export const PERMISSIONS = {
  settings: ['owner'],
  'settings.users': ['owner'],
  finance: ['owner', 'accountant'],
  'daily_log.write': ['owner', 'manager', 'operator'],
  'daily_log.read': ['owner', 'manager', 'accountant', 'operator', 'viewer'],
  reports: ['owner', 'manager', 'accountant'],
  invoices: ['owner', 'accountant'],
  budget: ['owner', 'accountant'],
  equipment: ['owner', 'manager'],
  workers: ['owner', 'manager'],
  help: ['owner', 'manager', 'accountant', 'operator', 'viewer'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role, permission: string): boolean {
  const allowed = PERMISSIONS[permission as Permission];
  if (!allowed) return false;
  return (allowed as readonly Role[]).includes(role);
}

export function requirePermission(role: Role, permission: string): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Role '${role}' lacks permission '${permission}'`);
  }
}
