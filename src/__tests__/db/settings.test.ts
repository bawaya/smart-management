import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, seedTestData, type SeededData } from '../helpers/test-db';

describe('settings', () => {
  let db: Database.Database;
  let seed: SeededData;

  beforeEach(() => {
    db = createTestDb();
    seed = seedTestData(db);
  });

  afterEach(() => {
    db.close();
  });

  it('reads an existing setting (from default tenant seed)', () => {
    const row = db
      .prepare('SELECT value FROM settings WHERE tenant_id = ? AND key = ?')
      .get('default', 'vat_rate') as { value: string } | undefined;
    expect(row?.value).toBe('17');
  });

  it('updates a setting value', () => {
    db.prepare(
      `UPDATE settings SET value = ?, updated_at = datetime('now') WHERE tenant_id = ? AND key = ?`,
    ).run('18', 'default', 'vat_rate');

    const row = db
      .prepare('SELECT value FROM settings WHERE tenant_id = ? AND key = ?')
      .get('default', 'vat_rate') as { value: string };
    expect(row.value).toBe('18');
  });

  it('is_setup_complete starts as false for default tenant', () => {
    const row = db
      .prepare('SELECT value FROM settings WHERE tenant_id = ? AND key = ?')
      .get('default', 'is_setup_complete') as { value: string };
    expect(row.value).toBe('false');
  });

  it('updates is_setup_complete to true', () => {
    db.prepare(
      `UPDATE settings SET value = 'true' WHERE tenant_id = ? AND key = 'is_setup_complete'`,
    ).run('default');

    const row = db
      .prepare('SELECT value FROM settings WHERE tenant_id = ? AND key = ?')
      .get('default', 'is_setup_complete') as { value: string };
    expect(row.value).toBe('true');
  });

  it('insert new settings key for the test tenant', () => {
    db.prepare(
      `INSERT INTO settings (tenant_id, key, value, description) VALUES (?, ?, ?, ?)`,
    ).run(seed.tenantId, 'custom_key', 'custom_value', 'Test setting');

    const row = db
      .prepare('SELECT value FROM settings WHERE tenant_id = ? AND key = ?')
      .get(seed.tenantId, 'custom_key') as { value: string };
    expect(row.value).toBe('custom_value');
  });

  it('PRIMARY KEY (tenant_id, key) rejects duplicate inserts', () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO settings (tenant_id, key, value) VALUES ('default', 'vat_rate', '99')`,
        )
        .run(),
    ).toThrow(/UNIQUE|PRIMARY KEY/i);
  });

  it('same key under different tenants are independent', () => {
    db.prepare(
      `INSERT INTO settings (tenant_id, key, value) VALUES (?, 'vat_rate', '0')`,
    ).run(seed.tenantId);

    const defaultVat = db
      .prepare('SELECT value FROM settings WHERE tenant_id = ? AND key = ?')
      .get('default', 'vat_rate') as { value: string };
    const testVat = db
      .prepare('SELECT value FROM settings WHERE tenant_id = ? AND key = ?')
      .get(seed.tenantId, 'vat_rate') as { value: string };

    expect(defaultVat.value).toBe('17');
    expect(testVat.value).toBe('0');
  });
});
