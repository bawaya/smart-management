import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = 'C:\\smart-management\\data\\dev.db';
const SCHEMA_PATH = 'C:\\smart-management\\src\\lib\\db\\schema.sql';
const EXPECTED_SETTINGS_ROWS = 18;

function migrate(): void {
  const dataDir = dirname(DB_PATH);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  if (existsSync(DB_PATH)) {
    console.log(`[migrate] Removing existing database: ${DB_PATH}`);
    unlinkSync(DB_PATH);
  }

  console.log('[migrate] Running migration...');
  console.log(`[migrate] Database: ${DB_PATH}`);
  console.log(`[migrate] Schema:   ${SCHEMA_PATH}`);

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const sql = readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(sql);

  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as Array<{ name: string }>;

  const views = db
    .prepare("SELECT name FROM sqlite_master WHERE type='view' ORDER BY name")
    .all() as Array<{ name: string }>;

  console.log(`\n[migrate] Created ${tables.length} tables:`);
  for (const t of tables) {
    console.log(`  - ${t.name}`);
  }

  console.log(`\n[migrate] Created ${views.length} views:`);
  for (const v of views) {
    console.log(`  - ${v.name}`);
  }

  const tenant = db
    .prepare("SELECT id, name FROM tenants WHERE id = 'default'")
    .get() as { id: string; name: string } | undefined;

  const adminUser = db
    .prepare(
      "SELECT username, role FROM users WHERE username = 'admin' AND tenant_id = 'default'",
    )
    .get() as { username: string; role: string } | undefined;

  const settingsCount = (
    db
      .prepare("SELECT COUNT(*) AS c FROM settings WHERE tenant_id = 'default'")
      .get() as { c: number }
  ).c;

  console.log('\n[migrate] Seed data verification:');
  console.log(`  - default tenant: ${tenant ? 'OK' : 'MISSING'}`);
  console.log(
    `  - admin user:     ${adminUser ? `OK (role=${adminUser.role})` : 'MISSING'}`,
  );
  console.log(
    `  - settings rows:  ${settingsCount} (expected ${EXPECTED_SETTINGS_ROWS})`,
  );

  const seedOk =
    tenant != null &&
    adminUser != null &&
    settingsCount === EXPECTED_SETTINGS_ROWS;

  if (!seedOk) {
    console.error('\n[migrate] Seed data verification FAILED.');
    db.close();
    process.exit(1);
  }

  db.pragma('foreign_keys = ON');
  db.close();

  console.log('\n[migrate] Migration complete.');
}

try {
  migrate();
} catch (err) {
  console.error('[migrate] Migration failed:', err);
  process.exit(1);
}
