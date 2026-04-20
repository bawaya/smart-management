import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, seedTestData, type SeededData } from '../helpers/test-db';

function generateInvoiceNumber(
  db: Database.Database,
  tenantId: string,
  yyyyMm: string,
): string {
  const prefix = `INV-${yyyyMm}-`;
  const row = db
    .prepare(
      `SELECT invoice_number FROM invoices WHERE tenant_id = ? AND invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1`,
    )
    .get(tenantId, `${prefix}%`) as { invoice_number: string } | undefined;
  const seq = row ? parseInt(row.invoice_number.slice(-3), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

function createInvoiceFromLog(
  db: Database.Database,
  seed: SeededData,
  args: {
    id: string;
    logId: string;
    equipmentRevenue: number;
    workerRevenue: number;
    vatRate?: number;
    yyyyMm?: string;
  },
): string {
  const vatRate = args.vatRate ?? 17;
  const subtotal = args.equipmentRevenue + args.workerRevenue;
  const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;
  const invoiceNumber = generateInvoiceNumber(
    db,
    seed.tenantId,
    args.yyyyMm ?? '202603',
  );

  db.prepare(
    `INSERT INTO invoices (id, tenant_id, invoice_number, client_id, period_start, period_end,
      total_equipment_revenue, total_worker_revenue, subtotal, vat_rate, vat_amount, total, status, created_by)
     VALUES (?, ?, ?, ?, '2026-03-01', '2026-03-31', ?, ?, ?, ?, ?, ?, 'draft', ?)`,
  ).run(
    args.id,
    seed.tenantId,
    invoiceNumber,
    seed.clientId,
    args.equipmentRevenue,
    args.workerRevenue,
    subtotal,
    vatRate,
    vatAmount,
    total,
    seed.users.ownerId,
  );

  db.prepare(
    `INSERT INTO invoice_items (id, tenant_id, invoice_id, daily_log_id, item_type, quantity, unit_price, total) VALUES (?, ?, ?, ?, 'equipment', 1, ?, ?)`,
  ).run(
    `item-eq-${args.id}`,
    seed.tenantId,
    args.id,
    args.logId,
    args.equipmentRevenue,
    args.equipmentRevenue,
  );

  db.prepare('UPDATE daily_logs SET status = ? WHERE id = ?').run(
    'invoiced',
    args.logId,
  );

  return invoiceNumber;
}

function recordPayment(
  db: Database.Database,
  invoiceId: string,
  amount: number,
  date: string,
): void {
  const inv = db
    .prepare('SELECT total, paid_amount, status FROM invoices WHERE id = ?')
    .get(invoiceId) as { total: number; paid_amount: number; status: string };

  if (inv.status === 'cancelled') {
    throw new Error('Cannot record payment on a cancelled invoice');
  }

  const newPaid = (inv.paid_amount || 0) + amount;
  const newStatus = newPaid >= inv.total ? 'paid' : 'partial';
  db.prepare(
    'UPDATE invoices SET paid_amount = ?, paid_date = ?, status = ? WHERE id = ?',
  ).run(newPaid, newStatus === 'paid' ? date : null, newStatus, invoiceId);
}

function cancelInvoice(db: Database.Database, invoiceId: string): void {
  db.prepare(
    `UPDATE daily_logs SET status = 'confirmed' WHERE id IN (SELECT daily_log_id FROM invoice_items WHERE invoice_id = ?)`,
  ).run(invoiceId);
  db.prepare("UPDATE invoices SET status = 'cancelled' WHERE id = ?").run(invoiceId);
}

function addConfirmedLog(
  db: Database.Database,
  seed: SeededData,
  id: string,
  date: string,
  revenue: number,
): void {
  db.prepare(
    `INSERT INTO daily_logs (id, tenant_id, log_date, client_id, equipment_id, equipment_revenue, status, created_by) VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?)`,
  ).run(
    id,
    seed.tenantId,
    date,
    seed.clientId,
    seed.equipment.id1,
    revenue,
    seed.users.ownerId,
  );
}

describe('invoices', () => {
  let db: Database.Database;
  let seed: SeededData;

  beforeEach(() => {
    db = createTestDb();
    seed = seedTestData(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates invoice from confirmed logs and marks them invoiced', () => {
    addConfirmedLog(db, seed, 'log-a', '2026-03-05', 1000);
    createInvoiceFromLog(db, seed, {
      id: 'inv-a',
      logId: 'log-a',
      equipmentRevenue: 1000,
      workerRevenue: 0,
    });

    const log = db
      .prepare('SELECT status FROM daily_logs WHERE id = ?')
      .get('log-a') as { status: string };
    expect(log.status).toBe('invoiced');
  });

  it('generates invoice numbers in INV-YYYYMM-NNN format with sequencing', () => {
    addConfirmedLog(db, seed, 'log-x1', '2026-03-01', 500);
    addConfirmedLog(db, seed, 'log-x2', '2026-03-02', 500);
    addConfirmedLog(db, seed, 'log-y1', '2026-04-01', 500);

    const n1 = createInvoiceFromLog(db, seed, {
      id: 'i1',
      logId: 'log-x1',
      equipmentRevenue: 500,
      workerRevenue: 0,
      yyyyMm: '202603',
    });
    const n2 = createInvoiceFromLog(db, seed, {
      id: 'i2',
      logId: 'log-x2',
      equipmentRevenue: 500,
      workerRevenue: 0,
      yyyyMm: '202603',
    });
    const n3 = createInvoiceFromLog(db, seed, {
      id: 'i3',
      logId: 'log-y1',
      equipmentRevenue: 500,
      workerRevenue: 0,
      yyyyMm: '202604',
    });

    expect(n1).toBe('INV-202603-001');
    expect(n2).toBe('INV-202603-002');
    expect(n3).toBe('INV-202604-001');
  });

  it('computes totals correctly (subtotal + vat_amount = total)', () => {
    addConfirmedLog(db, seed, 'log-t', '2026-03-10', 1000);
    createInvoiceFromLog(db, seed, {
      id: 'inv-t',
      logId: 'log-t',
      equipmentRevenue: 1000,
      workerRevenue: 500,
      vatRate: 17,
    });

    const row = db
      .prepare(
        'SELECT subtotal, vat_rate, vat_amount, total FROM invoices WHERE id = ?',
      )
      .get('inv-t') as {
      subtotal: number;
      vat_rate: number;
      vat_amount: number;
      total: number;
    };

    expect(row.subtotal).toBe(1500);
    expect(row.vat_rate).toBe(17);
    expect(row.vat_amount).toBeCloseTo(255, 2);
    expect(row.total).toBeCloseTo(1755, 2);
    expect(row.subtotal + row.vat_amount).toBeCloseTo(row.total, 2);
  });

  it('full payment marks invoice paid', () => {
    addConfirmedLog(db, seed, 'log-p', '2026-03-15', 1000);
    createInvoiceFromLog(db, seed, {
      id: 'inv-p',
      logId: 'log-p',
      equipmentRevenue: 1000,
      workerRevenue: 0,
    });

    recordPayment(db, 'inv-p', 1170, '2026-04-01');

    const row = db
      .prepare('SELECT status, paid_amount FROM invoices WHERE id = ?')
      .get('inv-p') as { status: string; paid_amount: number };
    expect(row.status).toBe('paid');
    expect(row.paid_amount).toBe(1170);
  });

  it('partial payment marks invoice partial', () => {
    addConfirmedLog(db, seed, 'log-pp', '2026-03-15', 1000);
    createInvoiceFromLog(db, seed, {
      id: 'inv-pp',
      logId: 'log-pp',
      equipmentRevenue: 1000,
      workerRevenue: 0,
    });

    recordPayment(db, 'inv-pp', 500, '2026-04-01');

    const row = db
      .prepare('SELECT status, paid_amount FROM invoices WHERE id = ?')
      .get('inv-pp') as { status: string; paid_amount: number };
    expect(row.status).toBe('partial');
    expect(row.paid_amount).toBe(500);
  });

  it('cancelling an invoice returns linked logs to confirmed', () => {
    addConfirmedLog(db, seed, 'log-c', '2026-03-15', 1000);
    createInvoiceFromLog(db, seed, {
      id: 'inv-c',
      logId: 'log-c',
      equipmentRevenue: 1000,
      workerRevenue: 0,
    });

    const beforeCancel = db
      .prepare('SELECT status FROM daily_logs WHERE id = ?')
      .get('log-c') as { status: string };
    expect(beforeCancel.status).toBe('invoiced');

    cancelInvoice(db, 'inv-c');

    const afterCancel = db
      .prepare('SELECT status FROM daily_logs WHERE id = ?')
      .get('log-c') as { status: string };
    const invStatus = db
      .prepare('SELECT status FROM invoices WHERE id = ?')
      .get('inv-c') as { status: string };

    expect(afterCancel.status).toBe('confirmed');
    expect(invStatus.status).toBe('cancelled');
  });

  it('rejects payment on a cancelled invoice', () => {
    addConfirmedLog(db, seed, 'log-r', '2026-03-15', 1000);
    createInvoiceFromLog(db, seed, {
      id: 'inv-r',
      logId: 'log-r',
      equipmentRevenue: 1000,
      workerRevenue: 0,
    });
    cancelInvoice(db, 'inv-r');

    expect(() => recordPayment(db, 'inv-r', 500, '2026-04-01')).toThrow(/cancelled/);
  });
});
