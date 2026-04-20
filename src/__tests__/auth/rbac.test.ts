import { describe, expect, it } from 'vitest';
import {
  PERMISSIONS,
  type Role,
  hasPermission,
  requirePermission,
} from '@/lib/auth/rbac';

type PermissionName = keyof typeof PERMISSIONS;

// Full 11 permissions × 5 roles matrix — single source of truth for expected access.
const MATRIX: Record<PermissionName, Record<Role, boolean>> = {
  settings: {
    owner: true,
    manager: false,
    accountant: false,
    operator: false,
    viewer: false,
  },
  'settings.users': {
    owner: true,
    manager: false,
    accountant: false,
    operator: false,
    viewer: false,
  },
  finance: {
    owner: true,
    manager: false,
    accountant: true,
    operator: false,
    viewer: false,
  },
  'daily_log.write': {
    owner: true,
    manager: true,
    accountant: false,
    operator: true,
    viewer: false,
  },
  'daily_log.read': {
    owner: true,
    manager: true,
    accountant: true,
    operator: true,
    viewer: true,
  },
  reports: {
    owner: true,
    manager: true,
    accountant: true,
    operator: false,
    viewer: false,
  },
  invoices: {
    owner: true,
    manager: false,
    accountant: true,
    operator: false,
    viewer: false,
  },
  budget: {
    owner: true,
    manager: false,
    accountant: true,
    operator: false,
    viewer: false,
  },
  equipment: {
    owner: true,
    manager: true,
    accountant: false,
    operator: false,
    viewer: false,
  },
  workers: {
    owner: true,
    manager: true,
    accountant: false,
    operator: false,
    viewer: false,
  },
  help: {
    owner: true,
    manager: true,
    accountant: true,
    operator: true,
    viewer: true,
  },
};

describe('rbac', () => {
  it('defines exactly 11 permissions', () => {
    expect(Object.keys(PERMISSIONS)).toHaveLength(11);
  });

  describe('full permission matrix (11 × 5 = 55 assertions)', () => {
    const perms = Object.keys(MATRIX) as PermissionName[];
    const roles: Role[] = [
      'owner',
      'manager',
      'accountant',
      'operator',
      'viewer',
    ];

    for (const perm of perms) {
      for (const role of roles) {
        const expected = MATRIX[perm][role];
        it(`${role} × ${perm} → ${expected}`, () => {
          expect(hasPermission(role, perm)).toBe(expected);
        });
      }
    }
  });

  it('owner has every defined permission', () => {
    for (const perm of Object.keys(PERMISSIONS)) {
      expect(hasPermission('owner', perm)).toBe(true);
    }
  });

  it('hasPermission returns false for unknown permission name', () => {
    expect(hasPermission('owner', 'nonexistent.permission')).toBe(false);
  });

  it('requirePermission passes silently when the role has the permission', () => {
    expect(() => requirePermission('owner', 'settings')).not.toThrow();
    expect(() => requirePermission('viewer', 'daily_log.read')).not.toThrow();
    expect(() => requirePermission('accountant', 'finance')).not.toThrow();
  });

  it('requirePermission throws with the exact error message format', () => {
    expect(() => requirePermission('viewer', 'settings')).toThrow(
      "Role 'viewer' lacks permission 'settings'",
    );
    expect(() => requirePermission('operator', 'finance')).toThrow(
      "Role 'operator' lacks permission 'finance'",
    );
    expect(() => requirePermission('manager', 'invoices')).toThrow(
      "Role 'manager' lacks permission 'invoices'",
    );
  });

  it('requirePermission throws for unknown permissions too', () => {
    expect(() => requirePermission('owner', 'bogus')).toThrow(
      "Role 'owner' lacks permission 'bogus'",
    );
  });
});
