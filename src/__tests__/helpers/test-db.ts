import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SCHEMA_PATH = path.resolve(
  process.cwd(),
  'src',
  'lib',
  'db',
  'schema.sql',
);

// Lower rounds for faster tests — not production security.
const TEST_SALT_ROUNDS = 4;

export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  const sql = readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(sql);
  return db;
}

export interface SeededData {
  tenantId: string;
  users: {
    ownerId: string;
    operatorId: string;
    viewerId: string;
  };
  clientId: string;
  equipmentTypes: { id1: string; id2: string };
  equipment: { id1: string; id2: string };
  vehicles: { id1: string; id2: string };
  workers: { id1: string; id2: string; id3: string };
  bankAccountId: string;
  creditCardId: string;
}

export function seedTestData(db: Database.Database): SeededData {
  const tenantId = 'test-tenant';

  db.prepare(
    `INSERT INTO tenants (id, name, is_setup_complete) VALUES (?, ?, ?)`,
  ).run(tenantId, 'Test Company', 1);

  const ownerHash = bcrypt.hashSync('admin123', TEST_SALT_ROUNDS);
  const operatorHash = bcrypt.hashSync('driver123', TEST_SALT_ROUNDS);
  const viewerHash = bcrypt.hashSync('viewer123', TEST_SALT_ROUNDS);

  const ownerId = 'test-owner';
  const operatorId = 'test-operator';
  const viewerId = 'test-viewer';

  const insertUser = db.prepare(
    `INSERT INTO users (id, tenant_id, username, password_hash, full_name, role, must_change_password) VALUES (?, ?, ?, ?, ?, ?, 0)`,
  );
  insertUser.run(ownerId, tenantId, 'admin', ownerHash, 'Test Owner', 'owner');
  insertUser.run(
    operatorId,
    tenantId,
    'driver1',
    operatorHash,
    'Test Driver',
    'operator',
  );
  insertUser.run(
    viewerId,
    tenantId,
    'viewer1',
    viewerHash,
    'Test Viewer',
    'viewer',
  );

  const clientId = 'test-client';
  db.prepare(
    `INSERT INTO clients (id, tenant_id, name, equipment_daily_rate, worker_daily_rate) VALUES (?, ?, ?, ?, ?)`,
  ).run(clientId, tenantId, 'חברת בדיקות', 1000, 400);

  const eqt1 = 'eqt-1';
  const eqt2 = 'eqt-2';
  const insertEqType = db.prepare(
    `INSERT INTO equipment_types (id, tenant_id, name_ar) VALUES (?, ?, ?)`,
  );
  insertEqType.run(eqt1, tenantId, 'סוג א');
  insertEqType.run(eqt2, tenantId, 'סוג ב');

  const eq1 = 'eq-1';
  const eq2 = 'eq-2';
  const insertEq = db.prepare(
    `INSERT INTO equipment (id, tenant_id, name, equipment_type_id) VALUES (?, ?, ?, ?)`,
  );
  insertEq.run(eq1, tenantId, 'מחפרון 1', eqt1);
  insertEq.run(eq2, tenantId, 'משאית 1', eqt2);

  const v1 = 'v-1';
  const v2 = 'v-2';
  const insertVehicle = db.prepare(
    `INSERT INTO vehicles (id, tenant_id, name, license_plate) VALUES (?, ?, ?, ?)`,
  );
  insertVehicle.run(v1, tenantId, 'משאית א', '12-345-67');
  insertVehicle.run(v2, tenantId, 'רכב שירות', '89-012-34');

  const w1 = 'w-1';
  const w2 = 'w-2';
  const w3 = 'w-3';
  const insertWorker = db.prepare(
    `INSERT INTO workers (id, tenant_id, full_name, id_number, daily_rate) VALUES (?, ?, ?, ?, ?)`,
  );
  insertWorker.run(w1, tenantId, 'עובד א', '111111111', null);
  insertWorker.run(w2, tenantId, 'עובד ב', '222222222', null);
  insertWorker.run(w3, tenantId, 'עובד ג', '333333333', 500);

  const bankAccountId = 'ba-1';
  db.prepare(
    `INSERT INTO bank_accounts (id, tenant_id, bank_name, account_number, current_balance, is_primary) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(bankAccountId, tenantId, 'בנק הפועלים', '12345678', 10000, 1);

  const creditCardId = 'cc-1';
  db.prepare(
    `INSERT INTO credit_cards (id, tenant_id, bank_account_id, card_name, last_four_digits) VALUES (?, ?, ?, ?, ?)`,
  ).run(creditCardId, tenantId, bankAccountId, 'כרטיס ראשי', '1234');

  return {
    tenantId,
    users: { ownerId, operatorId, viewerId },
    clientId,
    equipmentTypes: { id1: eqt1, id2: eqt2 },
    equipment: { id1: eq1, id2: eq2 },
    vehicles: { id1: v1, id2: v2 },
    workers: { id1: w1, id2: w2, id3: w3 },
    bankAccountId,
    creditCardId,
  };
}
