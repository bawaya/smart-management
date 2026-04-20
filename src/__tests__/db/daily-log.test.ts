import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, seedTestData, type SeededData } from '../helpers/test-db';

function addLog(
  db: Database.Database,
  seed: SeededData,
  overrides: Partial<{
    id: string;
    date: string;
    equipmentRevenue: number;
    status: 'draft' | 'confirmed' | 'invoiced';
  }> = {},
): string {
  const id = overrides.id ?? 'dl-1';
  const date = overrides.date ?? '2026-03-15';
  db.prepare(
    `INSERT INTO daily_logs (id, tenant_id, log_date, client_id, equipment_id, vehicle_id, equipment_revenue, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    seed.tenantId,
    date,
    seed.clientId,
    seed.equipment.id1,
    seed.vehicles.id1,
    overrides.equipmentRevenue ?? 1000,
    overrides.status ?? 'draft',
    seed.users.ownerId,
  );
  return id;
}

function addAssignment(
  db: Database.Database,
  seed: SeededData,
  logId: string,
  workerId: string,
  dailyRate: number,
  revenue: number,
  id?: string,
): void {
  db.prepare(
    `INSERT INTO worker_assignments (id, tenant_id, daily_log_id, worker_id, daily_rate, revenue) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id ?? `wa-${logId}-${workerId}`,
    seed.tenantId,
    logId,
    workerId,
    dailyRate,
    revenue,
  );
}

// Mimics updateDailyLogAction's confirmed-lock check.
function updateLogWithGuard(
  db: Database.Database,
  logId: string,
  newRevenue: number,
): void {
  const existing = db
    .prepare('SELECT status FROM daily_logs WHERE id = ?')
    .get(logId) as { status: string } | undefined;
  if (!existing) throw new Error('log not found');
  if (existing.status !== 'draft') {
    throw new Error('Cannot edit a confirmed or invoiced log');
  }
  db.prepare('UPDATE daily_logs SET equipment_revenue = ? WHERE id = ?').run(
    newRevenue,
    logId,
  );
}

describe('daily_log', () => {
  let db: Database.Database;
  let seed: SeededData;

  beforeEach(() => {
    db = createTestDb();
    seed = seedTestData(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates a daily_log with multiple worker_assignments', () => {
    const logId = addLog(db, seed, { equipmentRevenue: 1000 });
    addAssignment(db, seed, logId, seed.workers.id1, 400, 450);
    addAssignment(db, seed, logId, seed.workers.id2, 400, 450);

    const count = (
      db
        .prepare('SELECT COUNT(*) AS c FROM worker_assignments WHERE daily_log_id = ?')
        .get(logId) as { c: number }
    ).c;
    expect(count).toBe(2);
  });

  it('total income = equipment_revenue + SUM(worker revenue)', () => {
    const logId = addLog(db, seed, { equipmentRevenue: 1000 });
    addAssignment(db, seed, logId, seed.workers.id1, 400, 500);
    addAssignment(db, seed, logId, seed.workers.id2, 400, 500);

    const row = db
      .prepare(
        `SELECT dl.equipment_revenue + COALESCE(SUM(wa.revenue), 0) AS total_income
         FROM daily_logs dl LEFT JOIN worker_assignments wa ON wa.daily_log_id = dl.id
         WHERE dl.id = ? GROUP BY dl.id`,
      )
      .get(logId) as { total_income: number };

    expect(row.total_income).toBe(2000);
  });

  it('total worker cost = SUM(daily_rate)', () => {
    const logId = addLog(db, seed);
    addAssignment(db, seed, logId, seed.workers.id1, 400, 500);
    addAssignment(db, seed, logId, seed.workers.id2, 400, 500);
    addAssignment(db, seed, logId, seed.workers.id3, 500, 600);

    const row = db
      .prepare('SELECT SUM(daily_rate) AS total_cost FROM worker_assignments WHERE daily_log_id = ?')
      .get(logId) as { total_cost: number };

    expect(row.total_cost).toBe(1300);
  });

  it('profit = income − cost', () => {
    const logId = addLog(db, seed, { equipmentRevenue: 1200 });
    addAssignment(db, seed, logId, seed.workers.id1, 400, 500);
    addAssignment(db, seed, logId, seed.workers.id3, 500, 600);

    const row = db
      .prepare(
        `SELECT dl.equipment_revenue + COALESCE(SUM(wa.revenue), 0) AS income,
                COALESCE(SUM(wa.daily_rate), 0) AS cost
         FROM daily_logs dl LEFT JOIN worker_assignments wa ON wa.daily_log_id = dl.id
         WHERE dl.id = ? GROUP BY dl.id`,
      )
      .get(logId) as { income: number; cost: number };

    const profit = row.income - row.cost;
    expect(row.income).toBe(2300);
    expect(row.cost).toBe(900);
    expect(profit).toBe(1400);
  });

  it('transitions status from draft to confirmed', () => {
    const logId = addLog(db, seed, { status: 'draft' });
    db.prepare('UPDATE daily_logs SET status = ? WHERE id = ?').run(
      'confirmed',
      logId,
    );

    const row = db
      .prepare('SELECT status FROM daily_logs WHERE id = ?')
      .get(logId) as { status: string };
    expect(row.status).toBe('confirmed');
  });

  it('prevents editing a confirmed log via the application guard', () => {
    const logId = addLog(db, seed, { status: 'draft', equipmentRevenue: 500 });

    updateLogWithGuard(db, logId, 750);
    expect(
      (
        db
          .prepare('SELECT equipment_revenue FROM daily_logs WHERE id = ?')
          .get(logId) as { equipment_revenue: number }
      ).equipment_revenue,
    ).toBe(750);

    db.prepare('UPDATE daily_logs SET status = ? WHERE id = ?').run('confirmed', logId);
    expect(() => updateLogWithGuard(db, logId, 900)).toThrow(/confirmed/);
  });

  it('counts distinct working days in a month', () => {
    addLog(db, seed, { id: 'l1', date: '2026-03-01' });
    addLog(db, seed, { id: 'l2', date: '2026-03-01' });
    addLog(db, seed, { id: 'l3', date: '2026-03-05' });
    addLog(db, seed, { id: 'l4', date: '2026-03-12' });
    addLog(db, seed, { id: 'l5', date: '2026-04-01' });

    const row = db
      .prepare(
        `SELECT COUNT(DISTINCT log_date) AS days FROM daily_logs
         WHERE tenant_id = ? AND log_date >= ? AND log_date < ?`,
      )
      .get(seed.tenantId, '2026-03-01', '2026-04-01') as { days: number };

    expect(row.days).toBe(3);
  });
});
