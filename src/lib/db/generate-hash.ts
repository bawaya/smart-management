import bcrypt from 'bcryptjs';
import { readFileSync, writeFileSync } from 'node:fs';

const SCHEMA_PATH = 'C:\\smart-management\\src\\lib\\db\\schema.sql';
const PASSWORD = 'admin123';
const PLACEHOLDER = 'PLACEHOLDER_HASH';
const SALT_ROUNDS = 12;

async function main(): Promise<void> {
  console.log(`[generate-hash] Generating bcrypt hash for '${PASSWORD}'...`);
  const hash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
  console.log(`[generate-hash] Hash: ${hash}`);

  const sql = readFileSync(SCHEMA_PATH, 'utf-8');

  if (!sql.includes(PLACEHOLDER)) {
    console.error(
      `[generate-hash] '${PLACEHOLDER}' not found in ${SCHEMA_PATH}.`,
    );
    console.error(
      '[generate-hash] schema.sql has already been updated — aborting to avoid invalidating existing credentials.',
    );
    process.exit(1);
  }

  const updated = sql.split(PLACEHOLDER).join(hash);
  writeFileSync(SCHEMA_PATH, updated, 'utf-8');

  console.log(`[generate-hash] schema.sql updated at ${SCHEMA_PATH}.`);
  console.log("[generate-hash] Next: run 'npx tsx src/lib/db/migrate.ts'.");
}

main().catch((err) => {
  console.error('[generate-hash] Failed:', err);
  process.exit(1);
});
