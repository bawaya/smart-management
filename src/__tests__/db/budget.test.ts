import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, seedTestData, type SeededData } from '../helpers/test-db';

function upsertBudget(
  db: Database.Database,
  seed: SeededData,
  year: number,
  month: number | null,
  category: string,
  planned: number,
): void {
  db.prepare(
    `DELETE FROM budgets WHERE tenant_id = ? AND budget_year = ? AND budget_month IS ? AND category = ?`,
  ).run(seed.tenantId, year, month, category);

  db.prepare(
    `INSERT INTO budgets (id, tenant_id, budget_year, budget_month, category, planned_amount, created_by)
     VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?)`,
  ).run(seed.tenantId, year, month, category, planned, seed.users.ownerId);
}

describe('budgets', () => {
  let db: Database.Database;
  let seed: SeededData;

  beforeEach(() => {
    db = createTestDb();
    seed = seedTestData(db);
  });

  afterEach(() => {
    db.close();
  });

  it('inserts an annual budget (budget_month = NULL)', () => {
    db.prepare(
      `INSERT INTO budgets (id, tenant_id, budget_year, budget_month, category, planned_amount, created_by)
       VALUES ('b-y', ?, 2026, NULL, 'expense_fuel', 60000, ?)`,
    ).run(seed.tenantId, seed.users.ownerId);

    const row = db
      .prepare('SELECT planned_amount, budget_month FROM budgets WHERE id = ?')
      .get('b-y') as { planned_amount: number; budget_month: number | null };
    expect(row.planned_amount).toBe(60000);
    expect(row.budget_month).toBeNull();
  });

  it('inserts a monthly budget', () => {
    db.prepare(
      `INSERT INTO budgets (id, tenant_id, budget_year, budget_month, category, planned_amount, created_by)
       VALUES ('b-m', ?, 2026, 3, 'expense_fuel', 5000, ?)`,
    ).run(seed.tenantId, seed.users.ownerId);

    const row = db
      .prepare('SELECT planned_amount, budget_month FROM budgets WHERE id = ?')
      .get('b-m') as { planned_amount: number; budget_month: number };
    expect(row.planned_amount).toBe(5000);
    expect(row.budget_month).toBe(3);
  });

  it('enforces UNIQUE(tenant_id, year, month, category) for monthly entries', () => {
    db.prepare(
      `INSERT INTO budgets (id, tenant_id, budget_year, budget_month, category, planned_amount, created_by)
       VALUES ('b-u1', ?, 2026, 4, 'expense_fuel', 5000, ?)`,
    ).run(seed.tenantId, seed.users.ownerId);

    const duplicate = db.prepare(
      `INSERT INTO budgets (id, tenant_id, budget_year, budget_month, category, planned_amount, created_by)
       VALUES ('b-u2', ?, 2026, 4, 'expense_fuel', 6000, ?)`,
    );
    expect(() => duplicate.run(seed.tenantId, seed.users.ownerId)).toThrow(/UNIQUE/i);
  });

  it('replace-on-conflict via delete+insert (upsert helper)', () => {
    upsertBudget(db, seed, 2026, 5, 'expense_office', 1000);
    upsertBudget(db, seed, 2026, 5, 'expense_office', 1500);

    const row = db
      .prepare(
        'SELECT planned_amount FROM budgets WHERE tenant_id = ? AND budget_year = 2026 AND budget_month = 5 AND category = ?',
      )
      .get(seed.tenantId, 'expense_office') as { planned_amount: number };
    expect(row.planned_amount).toBe(1500);

    const count = (
      db
        .prepare(
          'SELECT COUNT(*) AS c FROM budgets WHERE tenant_id = ? AND budget_year = 2026 AND budget_month = 5 AND category = ?',
        )
        .get(seed.tenantId, 'expense_office') as { c: number }
    ).c;
    expect(count).toBe(1);
  });

  it('computes actual income from daily_logs for the month', () => {
    db.prepare(
      `INSERT INTO daily_logs (id, tenant_id, log_date, client_id, equipment_id, equipment_revenue, status, created_by) VALUES
        ('dl-1', ?, '2026-03-05', ?, ?, 1000, 'confirmed', ?),
        ('dl-2', ?, '2026-03-10', ?, ?, 1500, 'confirmed', ?),
        ('dl-3', ?, '2026-04-01', ?, ?, 2000, 'confirmed', ?)`,
    ).run(
      seed.tenantId,
      seed.clientId,
      seed.equipment.id1,
      seed.users.ownerId,
      seed.tenantId,
      seed.clientId,
      seed.equipment.id1,
      seed.users.ownerId,
      seed.tenantId,
      seed.clientId,
      seed.equipment.id1,
      seed.users.ownerId,
    );

    const row = db
      .prepare(
        `SELECT COALESCE(SUM(equipment_revenue), 0) AS actual FROM daily_logs
         WHERE tenant_id = ? AND log_date >= '2026-03-01' AND log_date < '2026-04-01'`,
      )
      .get(seed.tenantId) as { actual: number };

    expect(row.actual).toBe(2500);
  });

  it('computes actual expenses from expenses for the month by category', () => {
    db.prepare(
      `INSERT INTO expenses (id, tenant_id, expense_date, category, amount, created_by) VALUES
        ('e1', ?, '2026-03-05', 'fuel', 500, ?),
        ('e2', ?, '2026-03-20', 'fuel', 700, ?),
        ('e3', ?, '2026-03-15', 'office', 200, ?),
        ('e4', ?, '2026-04-01', 'fuel', 400, ?)`,
    ).run(
      seed.tenantId,
      seed.users.ownerId,
      seed.tenantId,
      seed.users.ownerId,
      seed.tenantId,
      seed.users.ownerId,
      seed.tenantId,
      seed.users.ownerId,
    );

    const row = db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS actual FROM expenses
         WHERE tenant_id = ? AND category = 'fuel' AND expense_date >= '2026-03-01' AND expense_date < '2026-04-01'`,
      )
      .get(seed.tenantId) as { actual: number };

    expect(row.actual).toBe(1200);
  });

  it('utilization percentage = actual / planned * 100', () => {
    db.prepare(
      `INSERT INTO budgets (id, tenant_id, budget_year, budget_month, category, planned_amount, created_by)
       VALUES ('b-util', ?, 2026, 3, 'expense_fuel', 2000, ?)`,
    ).run(seed.tenantId, seed.users.ownerId);

    db.prepare(
      `INSERT INTO expenses (id, tenant_id, expense_date, category, amount, created_by)
       VALUES ('e-util', ?, '2026-03-15', 'fuel', 1600, ?)`,
    ).run(seed.tenantId, seed.users.ownerId);

    const planned = (
      db
        .prepare(
          `SELECT planned_amount FROM budgets WHERE tenant_id = ? AND budget_year = 2026 AND budget_month = 3 AND category = 'expense_fuel'`,
        )
        .get(seed.tenantId) as { planned_amount: number }
    ).planned_amount;

    const actual = (
      db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) AS actual FROM expenses
           WHERE tenant_id = ? AND category = 'fuel' AND expense_date >= '2026-03-01' AND expense_date < '2026-04-01'`,
        )
        .get(seed.tenantId) as { actual: number }
    ).actual;

    const percentage = (actual / planned) * 100;
    expect(percentage).toBe(80);
  });
});
