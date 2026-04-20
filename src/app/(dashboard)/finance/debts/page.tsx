import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import {
  type ClientOption,
  type DebtPaymentRow,
  type DebtRow,
  DebtsManager,
  type WorkerOption,
} from './DebtsManager';

export default async function FinanceDebtsPage() {
  const tenantId = headers().get('x-tenant-id') ?? 'default';
  const db = getDb();

  const debts = await db.query<DebtRow>(
    `SELECT d.id, d.debt_type, d.counterparty, d.counterparty_type,
            d.worker_id, d.client_id,
            d.original_amount, d.remaining_amount,
            d.issue_date, d.due_date, d.description, d.status, d.notes,
            w.full_name AS worker_name,
            c.name AS client_name
     FROM debts d
     LEFT JOIN workers w ON w.id = d.worker_id
     LEFT JOIN clients c ON c.id = d.client_id
     WHERE d.tenant_id = ?
     ORDER BY d.status != 'paid' DESC, d.issue_date DESC`,
    [tenantId],
  );

  const payments =
    debts.length > 0
      ? await db.query<DebtPaymentRow>(
          `SELECT id, debt_id, payment_date, amount, payment_method, notes
             FROM debt_payments
             WHERE debt_id IN (${debts.map(() => '?').join(', ')})
             ORDER BY payment_date DESC`,
          [...debts.map((d) => d.id)],
        )
      : [];

  const workers = await db.query<WorkerOption>(
    `SELECT id, full_name FROM workers
       WHERE tenant_id = ? AND is_active = 1
       ORDER BY full_name`,
    [tenantId],
  );

  const clients = await db.query<ClientOption>(
    `SELECT id, name FROM clients
       WHERE tenant_id = ? AND is_active = 1
       ORDER BY name`,
    [tenantId],
  );

  return (
    <DebtsManager
      tenantId={tenantId}
      debts={debts}
      payments={payments}
      workers={workers}
      clients={clients}
    />
  );
}
