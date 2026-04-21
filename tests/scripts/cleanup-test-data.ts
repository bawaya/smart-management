/**
 * يحذف كل بيانات الاختبار من D1 remote.
 *
 * الأمان:
 *  - كل DELETE مقيّد بـ LIKE 'TEST!_%' ESCAPE '!' على حقل ظاهر للمستخدم
 *  - الترتيب FK-aware (children before parents)
 *  - لا يمس جداول tenants / settings / users (المستخدمون لهم script منفصل)
 */

import 'dotenv/config';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const PROJECT_ROOT = join(process.cwd(), '..');
const TMP_DIR = join(process.cwd(), '.tmp');
const SQL_PATH = join(TMP_DIR, 'cleanup-test-data.sql');
const DB_NAME = 'smart-management';
const TENANT = 'default';

/**
 * ترتيب FK-aware: كل entry = (table, where_clause).
 * ينفّذ من الأعلى للأسفل — children أولاً.
 *
 * يستعمل مقاربتين متتاليتين:
 *  1. FK sweep — يحذف كل صف بيشير لـ TEST_ parent (حتى لو الصف نفسه مش TEST_)
 *  2. Text match — يحذف صفوف الـ TEST_ نفسها
 */
/**
 * A cleanup step. Most are DELETEs. A few are UPDATEs to null out nullable
 * FKs where the child is a real (non-TEST_) row but points at a TEST_ parent —
 * we'd rather keep the real row and just unlink it.
 */
type CleanupStep =
  | { table: string; where: string; desc: string }
  | { table: string; set: string; where: string; desc: string; kind: 'update' };

const CLEANUP_STEPS: CleanupStep[] = [
  // =========================================================
  // STAGE 0 — UPDATE: null out non-cascade FKs from non-TEST_
  //                    children to TEST_ parents (keep the child row)
  // =========================================================
  {
    table: 'checks',
    set: 'linked_invoice_id = NULL',
    where: `tenant_id = '${TENANT}' AND linked_invoice_id IN (SELECT id FROM invoices WHERE tenant_id = '${TENANT}' AND invoice_number LIKE 'TEST!_%' ESCAPE '!')`,
    desc: 'checks.linked_invoice_id → NULL (unlink from TEST_ invoice)',
    kind: 'update',
  },
  {
    table: 'checks',
    set: 'linked_expense_id = NULL',
    where: `tenant_id = '${TENANT}' AND linked_expense_id IN (SELECT id FROM expenses WHERE tenant_id = '${TENANT}' AND description LIKE 'TEST!_%' ESCAPE '!')`,
    desc: 'checks.linked_expense_id → NULL (unlink from TEST_ expense)',
    kind: 'update',
  },
  {
    table: 'fuel_records',
    set: 'credit_card_id = NULL',
    where: `tenant_id = '${TENANT}' AND credit_card_id IN (SELECT id FROM credit_cards WHERE tenant_id = '${TENANT}' AND card_name LIKE 'TEST!_%' ESCAPE '!')`,
    desc: 'fuel_records.credit_card_id → NULL (unlink from TEST_ card)',
    kind: 'update',
  },
  {
    table: 'expenses',
    set: 'credit_card_id = NULL, check_id = NULL, bank_account_id = NULL',
    where: `tenant_id = '${TENANT}' AND (credit_card_id IN (SELECT id FROM credit_cards WHERE tenant_id = '${TENANT}' AND card_name LIKE 'TEST!_%' ESCAPE '!') OR check_id IN (SELECT id FROM checks WHERE tenant_id = '${TENANT}' AND (payee_or_payer LIKE 'TEST!_%' ESCAPE '!' OR check_number LIKE 'TEST!_%' ESCAPE '!')) OR bank_account_id IN (SELECT id FROM bank_accounts WHERE tenant_id = '${TENANT}' AND bank_name LIKE 'TEST!_%' ESCAPE '!'))`,
    desc: 'expenses.credit_card_id/check_id/bank_account_id → NULL',
    kind: 'update',
  },
  {
    table: 'debt_payments',
    set: 'transaction_id = NULL',
    where: `tenant_id = '${TENANT}' AND transaction_id IN (SELECT id FROM financial_transactions WHERE tenant_id = '${TENANT}' AND (counterparty LIKE 'TEST!_%' ESCAPE '!' OR description LIKE 'TEST!_%' ESCAPE '!' OR reference_number LIKE 'TEST!_%' ESCAPE '!'))`,
    desc: 'debt_payments.transaction_id → NULL (unlink from TEST_ transaction)',
    kind: 'update',
  },
  {
    table: 'reconciliation_items',
    set: 'transaction_id = NULL',
    where: `tenant_id = '${TENANT}' AND transaction_id IN (SELECT id FROM financial_transactions WHERE tenant_id = '${TENANT}' AND (counterparty LIKE 'TEST!_%' ESCAPE '!' OR description LIKE 'TEST!_%' ESCAPE '!' OR reference_number LIKE 'TEST!_%' ESCAPE '!'))`,
    desc: 'reconciliation_items.transaction_id → NULL (unlink from TEST_ transaction)',
    kind: 'update',
  },

  // =========================================================
  // STAGE 1 — FK sweep: children referencing TEST_ parents
  // حتى لو الـ child نفسه مش marked TEST_ (عادة بيحصل لو اختبار
  // ربط بيانات حقيقية مع TEST_ FK بالخطأ أو من flow مكسور).
  // =========================================================

  // expenses بتشير لـ TEST_ vehicle/equipment/worker
  {
    table: 'expenses',
    where: `tenant_id = '${TENANT}' AND (vehicle_id IN (SELECT id FROM vehicles WHERE tenant_id = '${TENANT}' AND (name LIKE 'TEST!_%' ESCAPE '!' OR license_plate LIKE 'TEST!_%' ESCAPE '!')) OR equipment_id IN (SELECT id FROM equipment WHERE tenant_id = '${TENANT}' AND name LIKE 'TEST!_%' ESCAPE '!') OR worker_id IN (SELECT id FROM workers WHERE tenant_id = '${TENANT}' AND full_name LIKE 'TEST!_%' ESCAPE '!'))`,
    desc: 'expenses (FK → TEST_ vehicle/equipment/worker)',
  },
  // fuel_records بتشير لـ TEST_ vehicle
  {
    table: 'fuel_records',
    where: `tenant_id = '${TENANT}' AND vehicle_id IN (SELECT id FROM vehicles WHERE tenant_id = '${TENANT}' AND (name LIKE 'TEST!_%' ESCAPE '!' OR license_plate LIKE 'TEST!_%' ESCAPE '!'))`,
    desc: 'fuel_records (FK → TEST_ vehicle)',
  },
  // worker_assignments بتشير لـ TEST_ worker (بغضّ النظر عن الـ daily_log)
  {
    table: 'worker_assignments',
    where: `worker_id IN (SELECT id FROM workers WHERE tenant_id = '${TENANT}' AND full_name LIKE 'TEST!_%' ESCAPE '!')`,
    desc: 'worker_assignments (FK → TEST_ worker)',
  },
  // invoice_items.daily_log_id غير cascade — لازم تنحذف أي item بيشير
  // لأي daily_log رح نحذفه بالـ sweep التالي (سواء بالـ FK أو بالـ text).
  // لو تركناها، حذف daily_logs بيرجّع FK constraint failure.
  {
    table: 'invoice_items',
    where: `daily_log_id IN (SELECT id FROM daily_logs WHERE tenant_id = '${TENANT}' AND (client_id IN (SELECT id FROM clients WHERE tenant_id = '${TENANT}' AND name LIKE 'TEST!_%' ESCAPE '!') OR equipment_id IN (SELECT id FROM equipment WHERE tenant_id = '${TENANT}' AND name LIKE 'TEST!_%' ESCAPE '!') OR vehicle_id IN (SELECT id FROM vehicles WHERE tenant_id = '${TENANT}' AND (name LIKE 'TEST!_%' ESCAPE '!' OR license_plate LIKE 'TEST!_%' ESCAPE '!')) OR project_name LIKE 'TEST!_%' ESCAPE '!' OR location LIKE 'TEST!_%' ESCAPE '!'))`,
    desc: 'invoice_items (FK → daily_logs about to be deleted, non-cascade)',
  },
  // daily_logs بتشير لـ TEST_ client/equipment/vehicle
  {
    table: 'daily_logs',
    where: `tenant_id = '${TENANT}' AND (client_id IN (SELECT id FROM clients WHERE tenant_id = '${TENANT}' AND name LIKE 'TEST!_%' ESCAPE '!') OR equipment_id IN (SELECT id FROM equipment WHERE tenant_id = '${TENANT}' AND name LIKE 'TEST!_%' ESCAPE '!') OR vehicle_id IN (SELECT id FROM vehicles WHERE tenant_id = '${TENANT}' AND (name LIKE 'TEST!_%' ESCAPE '!' OR license_plate LIKE 'TEST!_%' ESCAPE '!')))`,
    desc: 'daily_logs (FK → TEST_ client/equipment/vehicle)',
  },
  // invoices بتشير لـ TEST_ client
  {
    table: 'invoices',
    where: `tenant_id = '${TENANT}' AND client_id IN (SELECT id FROM clients WHERE tenant_id = '${TENANT}' AND name LIKE 'TEST!_%' ESCAPE '!')`,
    desc: 'invoices (FK → TEST_ client)',
  },
  // financial_transactions بتشير لـ TEST_ bank/card/check/standing_order/invoice/expense
  {
    table: 'financial_transactions',
    where: `tenant_id = '${TENANT}' AND (bank_account_id IN (SELECT id FROM bank_accounts WHERE tenant_id = '${TENANT}' AND bank_name LIKE 'TEST!_%' ESCAPE '!') OR credit_card_id IN (SELECT id FROM credit_cards WHERE tenant_id = '${TENANT}' AND card_name LIKE 'TEST!_%' ESCAPE '!') OR check_id IN (SELECT id FROM checks WHERE tenant_id = '${TENANT}' AND (payee_or_payer LIKE 'TEST!_%' ESCAPE '!' OR check_number LIKE 'TEST!_%' ESCAPE '!')) OR standing_order_id IN (SELECT id FROM standing_orders WHERE tenant_id = '${TENANT}' AND payee_name LIKE 'TEST!_%' ESCAPE '!') OR invoice_id IN (SELECT id FROM invoices WHERE tenant_id = '${TENANT}' AND invoice_number LIKE 'TEST!_%' ESCAPE '!') OR expense_id IN (SELECT id FROM expenses WHERE tenant_id = '${TENANT}' AND description LIKE 'TEST!_%' ESCAPE '!'))`,
    desc: 'financial_transactions (FK → TEST_ bank/card/check/so/invoice/expense)',
  },
  // credit_cards بتشير لـ TEST_ bank
  {
    table: 'credit_cards',
    where: `tenant_id = '${TENANT}' AND bank_account_id IN (SELECT id FROM bank_accounts WHERE tenant_id = '${TENANT}' AND bank_name LIKE 'TEST!_%' ESCAPE '!')`,
    desc: 'credit_cards (FK → TEST_ bank_account)',
  },
  // checks بتشير لـ TEST_ bank
  {
    table: 'checks',
    where: `tenant_id = '${TENANT}' AND bank_account_id IN (SELECT id FROM bank_accounts WHERE tenant_id = '${TENANT}' AND bank_name LIKE 'TEST!_%' ESCAPE '!')`,
    desc: 'checks (FK → TEST_ bank_account)',
  },
  // standing_orders بتشير لـ TEST_ bank
  {
    table: 'standing_orders',
    where: `tenant_id = '${TENANT}' AND bank_account_id IN (SELECT id FROM bank_accounts WHERE tenant_id = '${TENANT}' AND bank_name LIKE 'TEST!_%' ESCAPE '!')`,
    desc: 'standing_orders (FK → TEST_ bank_account)',
  },
  // bank_reconciliations بتشير لـ TEST_ bank
  {
    table: 'bank_reconciliations',
    where: `tenant_id = '${TENANT}' AND bank_account_id IN (SELECT id FROM bank_accounts WHERE tenant_id = '${TENANT}' AND bank_name LIKE 'TEST!_%' ESCAPE '!')`,
    desc: 'bank_reconciliations (FK → TEST_ bank_account)',
  },
  // debts بتشير لـ TEST_ worker/client
  {
    table: 'debts',
    where: `tenant_id = '${TENANT}' AND (worker_id IN (SELECT id FROM workers WHERE tenant_id = '${TENANT}' AND full_name LIKE 'TEST!_%' ESCAPE '!') OR client_id IN (SELECT id FROM clients WHERE tenant_id = '${TENANT}' AND name LIKE 'TEST!_%' ESCAPE '!'))`,
    desc: 'debts (FK → TEST_ worker/client)',
  },
  // equipment بتشير لـ TEST_ equipment_type
  {
    table: 'equipment',
    where: `tenant_id = '${TENANT}' AND equipment_type_id IN (SELECT id FROM equipment_types WHERE tenant_id = '${TENANT}' AND (name_ar LIKE 'TEST!_%' ESCAPE '!' OR name_he LIKE 'TEST!_%' ESCAPE '!'))`,
    desc: 'equipment (FK → TEST_ equipment_type)',
  },

  // =========================================================
  // STAGE 2 — Text-match deletes (original logic) + a critical
  // FK-based pass: invoice_items.daily_log_id has no cascade, so
  // any item generated from a TEST_ daily_log for a non-TEST_
  // invoice blocks the daily_log delete downstream.
  // =========================================================

  // فواتير وعناصرها (invoice_items → TEST_ daily_log already handled
  // pre-Stage-1 above, so we only need the invoice-side sweep here)
  {
    table: 'invoice_items',
    where: `invoice_id IN (SELECT id FROM invoices WHERE tenant_id = '${TENANT}' AND invoice_number LIKE 'TEST!_%' ESCAPE '!')`,
    desc: 'invoice_items (via TEST_ invoices)',
  },
  // worker_assignments مربوطة بـ daily_logs
  {
    table: 'worker_assignments',
    where: `daily_log_id IN (SELECT id FROM daily_logs WHERE tenant_id = '${TENANT}' AND (project_name LIKE 'TEST!_%' ESCAPE '!' OR location LIKE 'TEST!_%' ESCAPE '!'))`,
    desc: 'worker_assignments (via TEST_ daily_logs)',
  },
  // debts payments
  {
    table: 'debt_payments',
    where: `debt_id IN (SELECT id FROM debts WHERE tenant_id = '${TENANT}' AND counterparty LIKE 'TEST!_%' ESCAPE '!')`,
    desc: 'debt_payments',
  },
  // reconciliation items
  {
    table: 'reconciliation_items',
    where: `reconciliation_id IN (SELECT id FROM bank_reconciliations WHERE tenant_id = '${TENANT}' AND notes LIKE 'TEST!_%' ESCAPE '!')`,
    desc: 'reconciliation_items',
  },
  // budget alerts
  {
    table: 'budget_alerts',
    where: `budget_id IN (SELECT id FROM budgets WHERE tenant_id = '${TENANT}' AND notes LIKE 'TEST!_%' ESCAPE '!')`,
    desc: 'budget_alerts',
  },

  // الآن الجداول الأب — بس بعد حذف children
  {
    table: 'invoices',
    where: `tenant_id = '${TENANT}' AND invoice_number LIKE 'TEST!_%' ESCAPE '!'`,
    desc: 'invoices',
  },
  {
    table: 'daily_logs',
    where: `tenant_id = '${TENANT}' AND (project_name LIKE 'TEST!_%' ESCAPE '!' OR location LIKE 'TEST!_%' ESCAPE '!')`,
    desc: 'daily_logs',
  },
  {
    table: 'bank_reconciliations',
    where: `tenant_id = '${TENANT}' AND notes LIKE 'TEST!_%' ESCAPE '!'`,
    desc: 'bank_reconciliations',
  },
  {
    table: 'debts',
    where: `tenant_id = '${TENANT}' AND counterparty LIKE 'TEST!_%' ESCAPE '!'`,
    desc: 'debts',
  },
  {
    table: 'budgets',
    where: `tenant_id = '${TENANT}' AND notes LIKE 'TEST!_%' ESCAPE '!'`,
    desc: 'budgets',
  },

  // financial data — transactions بتشير لجداول كثير، لازم تنحذف قبلها
  {
    table: 'financial_transactions',
    where: `tenant_id = '${TENANT}' AND (counterparty LIKE 'TEST!_%' ESCAPE '!' OR description LIKE 'TEST!_%' ESCAPE '!' OR reference_number LIKE 'TEST!_%' ESCAPE '!')`,
    desc: 'financial_transactions',
  },
  {
    table: 'checks',
    where: `tenant_id = '${TENANT}' AND (payee_or_payer LIKE 'TEST!_%' ESCAPE '!' OR check_number LIKE 'TEST!_%' ESCAPE '!')`,
    desc: 'checks',
  },
  {
    table: 'standing_orders',
    where: `tenant_id = '${TENANT}' AND payee_name LIKE 'TEST!_%' ESCAPE '!'`,
    desc: 'standing_orders',
  },
  {
    table: 'credit_cards',
    where: `tenant_id = '${TENANT}' AND card_name LIKE 'TEST!_%' ESCAPE '!'`,
    desc: 'credit_cards',
  },
  {
    table: 'bank_accounts',
    where: `tenant_id = '${TENANT}' AND bank_name LIKE 'TEST!_%' ESCAPE '!'`,
    desc: 'bank_accounts',
  },

  // operations data
  {
    table: 'expenses',
    where: `tenant_id = '${TENANT}' AND description LIKE 'TEST!_%' ESCAPE '!'`,
    desc: 'expenses',
  },
  {
    table: 'fuel_records',
    where: `tenant_id = '${TENANT}' AND (notes LIKE 'TEST!_%' ESCAPE '!' OR station_name LIKE 'TEST!_%' ESCAPE '!')`,
    desc: 'fuel_records',
  },

  // master data — workers/vehicles/equipment/clients (بعد ما كل المراجع انحذفت)
  {
    table: 'workers',
    where: `tenant_id = '${TENANT}' AND full_name LIKE 'TEST!_%' ESCAPE '!'`,
    desc: 'workers',
  },
  {
    table: 'vehicles',
    where: `tenant_id = '${TENANT}' AND (name LIKE 'TEST!_%' ESCAPE '!' OR license_plate LIKE 'TEST!_%' ESCAPE '!')`,
    desc: 'vehicles',
  },
  {
    table: 'equipment',
    where: `tenant_id = '${TENANT}' AND name LIKE 'TEST!_%' ESCAPE '!'`,
    desc: 'equipment',
  },
  {
    table: 'equipment_types',
    where: `tenant_id = '${TENANT}' AND (name_ar LIKE 'TEST!_%' ESCAPE '!' OR name_he LIKE 'TEST!_%' ESCAPE '!')`,
    desc: 'equipment_types',
  },
  {
    table: 'clients',
    where: `tenant_id = '${TENANT}' AND name LIKE 'TEST!_%' ESCAPE '!'`,
    desc: 'clients',
  },

  // notifications + audit
  {
    table: 'notifications',
    where: `tenant_id = '${TENANT}' AND (title LIKE 'TEST!_%' ESCAPE '!' OR message LIKE 'TEST!_%' ESCAPE '!')`,
    desc: 'notifications',
  },
  {
    table: 'audit_log',
    where: `tenant_id = '${TENANT}' AND entity_id LIKE 'TEST!_%' ESCAPE '!'`,
    desc: 'audit_log (by TEST_ entity_id)',
  },
];

function buildSql(step: CleanupStep): string {
  if ('kind' in step && step.kind === 'update') {
    return `UPDATE ${step.table} SET ${step.set} WHERE ${step.where};`;
  }
  return `DELETE FROM ${step.table} WHERE ${step.where};`;
}

export async function cleanupTestData(): Promise<void> {
  console.log('▶ Cleanup test data on D1 remote');
  console.log(`  DB: ${DB_NAME}, tenant: ${TENANT}`);

  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

  // نكتب الـ SQL الكامل كـ artifact للمرجع، لكن ما بنشغّله كملف واحد —
  // wrangler بيشغّل الملف كـ transaction واحد وما بيخبرنا أي statement فشل.
  let sqlFile = '-- Cleanup test data — auto-generated\n\n';
  for (const step of CLEANUP_STEPS) {
    sqlFile += `-- ${step.desc}\n${buildSql(step)}\n\n`;
  }
  writeFileSync(SQL_PATH, sqlFile, 'utf8');

  const total = CLEANUP_STEPS.length;
  console.log(
    `▶ Executing cleanup — ${total} statements, one at a time for precise failure attribution\n`,
  );

  for (let i = 0; i < total; i += 1) {
    const step = CLEANUP_STEPS[i];
    const sql = buildSql(step);
    const tag = `[${String(i + 1).padStart(2, ' ')}/${total}]`;
    // wrangler --command يقبل string؛ SQL عندنا بيستعمل single quotes
    // جوّاه، فـ wrapping بـ double quotes في bash آمن (ما فيه $ أو `).
    const cmd = `npx wrangler d1 execute ${DB_NAME} --remote --command="${sql.replace(/"/g, '\\"')}"`;
    try {
      execSync(cmd, {
        cwd: PROJECT_ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
      });
      console.log(`${tag} ✓ ${step.desc}`);
    } catch (err) {
      const e = err as { stdout?: Buffer | string; stderr?: Buffer | string };
      const stdout = e.stdout ? e.stdout.toString() : '';
      const stderr = e.stderr ? e.stderr.toString() : '';
      console.error(`\n${tag} ✗ FAILED: ${step.desc}`);
      console.error(`  SQL: ${sql}`);
      if (stdout.trim()) console.error(`  stdout:\n${stdout.trim()}`);
      if (stderr.trim()) console.error(`  stderr:\n${stderr.trim()}`);
      console.error(
        `\n✗ Cleanup stopped at step ${i + 1}/${total}. Fix the dependency and re-run.`,
      );
      process.exit(1);
    }
  }

  console.log(`\n✓ Cleanup complete — all ${total} statements succeeded`);
}

// Script mode — `tsx scripts/cleanup-test-data.ts`
const isMain =
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  cleanupTestData().catch((e) => {
    console.error('✗ Fatal:', e);
    process.exit(1);
  });
}
