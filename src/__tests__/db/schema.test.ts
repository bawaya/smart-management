import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../helpers/test-db';

const EXPECTED_TABLES = [
  'tenants',
  'users',
  'clients',
  'equipment_types',
  'equipment',
  'vehicles',
  'workers',
  'daily_logs',
  'worker_assignments',
  'fuel_records',
  'expenses',
  'invoices',
  'invoice_items',
  'budgets',
  'budget_alerts',
  'bank_accounts',
  'credit_cards',
  'standing_orders',
  'checks',
  'financial_transactions',
  'debts',
  'debt_payments',
  'bank_reconciliations',
  'reconciliation_items',
  'settings',
  'audit_log',
  'notifications',
];

describe('schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it('creates all 27 tables', () => {
    const rows = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as Array<{ name: string }>;
    const names = rows.map((r) => r.name).sort();
    expect(names).toHaveLength(27);
    expect(names).toEqual([...EXPECTED_TABLES].sort());
  });

  it('creates the daily_equipment_cost VIEW', () => {
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type='view'")
      .all() as Array<{ name: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('daily_equipment_cost');
  });

  it('seeds the default tenant', () => {
    const tenant = db
      .prepare('SELECT id, is_setup_complete FROM tenants WHERE id = ?')
      .get('default') as { id: string; is_setup_complete: number } | undefined;
    expect(tenant).toBeDefined();
    expect(tenant?.is_setup_complete).toBe(0);
  });

  it('seeds the admin user with owner role and must_change_password=1', () => {
    const user = db
      .prepare(
        'SELECT username, role, must_change_password FROM users WHERE tenant_id = ? AND username = ?',
      )
      .get('default', 'admin') as
      | { username: string; role: string; must_change_password: number }
      | undefined;
    expect(user).toBeDefined();
    expect(user?.role).toBe('owner');
    expect(user?.must_change_password).toBe(1);
  });

  it('seeds 18 settings rows for the default tenant', () => {
    const row = db
      .prepare('SELECT COUNT(*) AS c FROM settings WHERE tenant_id = ?')
      .get('default') as { c: number };
    expect(row.c).toBe(18);
  });

  it('tenant_id column exists on every table except tenants', () => {
    for (const table of EXPECTED_TABLES) {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
        name: string;
      }>;
      const names = cols.map((c) => c.name);
      if (table === 'tenants') {
        expect(names).not.toContain('tenant_id');
      } else {
        expect(names, `table ${table} is missing tenant_id`).toContain(
          'tenant_id',
        );
      }
    }
  });

  it('enforces UNIQUE(tenant_id, username) on users', () => {
    // The seed already inserted (default, admin). A second insert with same
    // (tenant_id, username) must fail.
    const insert = db.prepare(
      "INSERT INTO users (id, tenant_id, username, password_hash, role) VALUES (?, 'default', 'admin', 'hash', 'viewer')",
    );
    expect(() => insert.run('duplicate-user-id')).toThrow(/UNIQUE/i);
  });

  it('allows same username under a different tenant (multi-tenant)', () => {
    db.prepare(
      "INSERT INTO tenants (id, name) VALUES ('other-tenant', 'Other')",
    ).run();
    expect(() =>
      db
        .prepare(
          "INSERT INTO users (id, tenant_id, username, password_hash, role) VALUES ('other-admin', 'other-tenant', 'admin', 'hash', 'owner')",
        )
        .run(),
    ).not.toThrow();
  });

  it('enforces FK constraints on equipment.equipment_type_id', () => {
    db.prepare(
      "INSERT INTO tenants (id, name) VALUES ('fk-tenant', 'FK')",
    ).run();
    const insert = db.prepare(
      "INSERT INTO equipment (id, tenant_id, name, equipment_type_id) VALUES ('eq-x', 'fk-tenant', 'x', 'missing-type-id')",
    );
    expect(() => insert.run()).toThrow(/FOREIGN KEY/i);
  });

  it('enforces FK constraints on users.tenant_id', () => {
    const insert = db.prepare(
      "INSERT INTO users (id, tenant_id, username, password_hash, role) VALUES ('orphan', 'nonexistent-tenant', 'x', 'hash', 'owner')",
    );
    expect(() => insert.run()).toThrow(/FOREIGN KEY/i);
  });

  it('enforces CHECK constraint on users.role (valid values only)', () => {
    db.prepare(
      "INSERT INTO tenants (id, name) VALUES ('check-tenant', 'CHK')",
    ).run();
    const insert = db.prepare(
      "INSERT INTO users (id, tenant_id, username, password_hash, role) VALUES ('bad-role', 'check-tenant', 'bad', 'hash', ?)",
    );
    expect(() => insert.run('superuser')).toThrow(/CHECK/i);
    expect(() => insert.run('owner')).not.toThrow();
  });

  it('enforces CHECK constraint on daily_logs.status', () => {
    db.prepare(
      "INSERT INTO tenants (id, name) VALUES ('st-tenant', 'ST')",
    ).run();
    db.prepare(
      "INSERT INTO users (id, tenant_id, username, password_hash, role) VALUES ('st-user', 'st-tenant', 'u', 'h', 'owner')",
    ).run();
    db.prepare(
      "INSERT INTO clients (id, tenant_id, name) VALUES ('st-client', 'st-tenant', 'x')",
    ).run();
    db.prepare(
      "INSERT INTO equipment_types (id, tenant_id, name_ar) VALUES ('st-eqt', 'st-tenant', 'x')",
    ).run();
    db.prepare(
      "INSERT INTO equipment (id, tenant_id, name, equipment_type_id) VALUES ('st-eq', 'st-tenant', 'x', 'st-eqt')",
    ).run();

    const insert = db.prepare(
      "INSERT INTO daily_logs (id, tenant_id, log_date, client_id, equipment_id, created_by, status) VALUES ('dl-x', 'st-tenant', '2026-01-01', 'st-client', 'st-eq', 'st-user', ?)",
    );
    expect(() => insert.run('approved')).toThrow(/CHECK/i);
    expect(() => insert.run('confirmed')).not.toThrow();
  });

  it('enforces CHECK constraint on checks.direction', () => {
    db.prepare(
      "INSERT INTO tenants (id, name) VALUES ('ch-tenant', 'CH')",
    ).run();
    db.prepare(
      "INSERT INTO users (id, tenant_id, username, password_hash, role) VALUES ('ch-user', 'ch-tenant', 'u', 'h', 'owner')",
    ).run();
    db.prepare(
      "INSERT INTO bank_accounts (id, tenant_id, bank_name, account_number) VALUES ('ch-ba', 'ch-tenant', 'X', '1')",
    ).run();

    const insert = db.prepare(
      "INSERT INTO checks (id, tenant_id, check_number, bank_account_id, direction, amount, payee_or_payer, issue_date, due_date, created_by) VALUES ('ck', 'ch-tenant', '001', 'ch-ba', ?, 100, 'X', '2026-01-01', '2026-02-01', 'ch-user')",
    );
    expect(() => insert.run('sideways')).toThrow(/CHECK/i);
    expect(() => insert.run('incoming')).not.toThrow();
  });
});
