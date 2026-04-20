import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, seedTestData, type SeededData } from '../helpers/test-db';

describe('CRUD operations', () => {
  let db: Database.Database;
  let seed: SeededData;

  beforeEach(() => {
    db = createTestDb();
    seed = seedTestData(db);
  });

  afterEach(() => {
    db.close();
  });

  it('inserts a client and reads it back', () => {
    db.prepare(
      `INSERT INTO clients (id, tenant_id, name, phone, equipment_daily_rate) VALUES (?, ?, ?, ?, ?)`,
    ).run('c-new', seed.tenantId, 'לקוח חדש', '050-1234567', 1200);

    const row = db
      .prepare('SELECT name, phone, equipment_daily_rate FROM clients WHERE id = ?')
      .get('c-new') as { name: string; phone: string; equipment_daily_rate: number };

    expect(row.name).toBe('לקוח חדש');
    expect(row.phone).toBe('050-1234567');
    expect(row.equipment_daily_rate).toBe(1200);
  });

  it('inserts equipment type and equipment linked to it', () => {
    db.prepare(
      `INSERT INTO equipment_types (id, tenant_id, name_ar, sort_order) VALUES (?, ?, ?, ?)`,
    ).run('eqt-new', seed.tenantId, 'סוג חדש', 5);

    db.prepare(
      `INSERT INTO equipment (id, tenant_id, name, equipment_type_id, status) VALUES (?, ?, ?, ?, ?)`,
    ).run('eq-new', seed.tenantId, 'מכשיר חדש', 'eqt-new', 'available');

    const joined = db
      .prepare(
        `SELECT e.name AS e_name, t.name_ar AS t_name FROM equipment e JOIN equipment_types t ON e.equipment_type_id = t.id WHERE e.id = ?`,
      )
      .get('eq-new') as { e_name: string; t_name: string };

    expect(joined.e_name).toBe('מכשיר חדש');
    expect(joined.t_name).toBe('סוג חדש');
  });

  it('inserts a vehicle with expiry dates', () => {
    db.prepare(
      `INSERT INTO vehicles (id, tenant_id, name, license_plate, insurance_expiry, license_expiry) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('v-new', seed.tenantId, 'משאית חדשה', '55-555-55', '2026-12-31', '2027-03-15');

    const row = db
      .prepare('SELECT license_plate, insurance_expiry FROM vehicles WHERE id = ?')
      .get('v-new') as { license_plate: string; insurance_expiry: string };

    expect(row.license_plate).toBe('55-555-55');
    expect(row.insurance_expiry).toBe('2026-12-31');
  });

  it('worker with custom daily_rate overrides default, NULL means use default', () => {
    const custom = db
      .prepare('SELECT daily_rate FROM workers WHERE id = ?')
      .get(seed.workers.id3) as { daily_rate: number };
    expect(custom.daily_rate).toBe(500);

    const defaultRate = db
      .prepare('SELECT daily_rate FROM workers WHERE id = ?')
      .get(seed.workers.id1) as { daily_rate: number | null };
    expect(defaultRate.daily_rate).toBeNull();
  });

  it('updates a worker and the change is persisted', () => {
    db.prepare(
      `UPDATE workers SET full_name = ?, daily_rate = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run('עובד א - עודכן', 450, seed.workers.id1);

    const updated = db
      .prepare('SELECT full_name, daily_rate FROM workers WHERE id = ?')
      .get(seed.workers.id1) as { full_name: string; daily_rate: number };

    expect(updated.full_name).toBe('עובד א - עודכן');
    expect(updated.daily_rate).toBe(450);
  });

  it('soft-deletes a worker via toggle is_active', () => {
    db.prepare('UPDATE workers SET is_active = 0 WHERE id = ?').run(seed.workers.id2);

    const row = db
      .prepare('SELECT is_active FROM workers WHERE id = ?')
      .get(seed.workers.id2) as { is_active: number };
    expect(row.is_active).toBe(0);

    const activeCount = (
      db
        .prepare('SELECT COUNT(*) AS c FROM workers WHERE tenant_id = ? AND is_active = 1')
        .get(seed.tenantId) as { c: number }
    ).c;
    expect(activeCount).toBe(2);
  });

  it('rejects a duplicate worker id_number within the same tenant', () => {
    const insert = db.prepare(
      `INSERT INTO workers (id, tenant_id, full_name, id_number) VALUES (?, ?, ?, ?)`,
    );
    expect(() =>
      insert.run('w-dup', seed.tenantId, 'עובד כפול', '111111111'),
    ).toThrow(/UNIQUE/i);
  });

  it('accepts the same id_number under a different tenant', () => {
    db.prepare("INSERT INTO tenants (id, name) VALUES ('tenant-b', 'B')").run();

    expect(() =>
      db
        .prepare(
          `INSERT INTO workers (id, tenant_id, full_name, id_number) VALUES (?, ?, ?, ?)`,
        )
        .run('w-other', 'tenant-b', 'עובד בטננט אחר', '111111111'),
    ).not.toThrow();

    const row = db
      .prepare('SELECT tenant_id FROM workers WHERE id_number = ? ORDER BY tenant_id')
      .all('111111111') as Array<{ tenant_id: string }>;
    expect(row).toHaveLength(2);
    expect(row.map((r) => r.tenant_id)).toEqual(['tenant-b', 'test-tenant']);
  });
});
