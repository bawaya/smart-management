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
 */
const CLEANUP_STEPS: Array<{ table: string; where: string; desc: string }> = [
  // فواتير وعناصرها
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

export async function cleanupTestData(): Promise<void> {
  console.log('▶ Cleanup test data on D1 remote');
  console.log(`  DB: ${DB_NAME}, tenant: ${TENANT}`);

  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

  // نبني SQL ملف واحد متسلسل (أسرع من run per step)
  let sql = '-- Cleanup test data — auto-generated\n\n';
  for (const step of CLEANUP_STEPS) {
    sql += `-- ${step.desc}\n`;
    sql += `DELETE FROM ${step.table} WHERE ${step.where};\n\n`;
  }
  writeFileSync(SQL_PATH, sql, 'utf8');

  console.log(
    `▶ Executing cleanup (${CLEANUP_STEPS.length} delete statements)...`,
  );
  execSync(
    `npx wrangler d1 execute ${DB_NAME} --remote --file="${SQL_PATH}"`,
    { cwd: PROJECT_ROOT, stdio: 'inherit' },
  );
  console.log('✓ Cleanup complete');
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
