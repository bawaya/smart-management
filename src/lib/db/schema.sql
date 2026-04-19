-- ניהול חכם (Nihul Hachum) — Database Schema
-- Source: PRD-v3 Section 7 (27 tables + 1 VIEW + seed data)
-- Target: SQLite / Cloudflare D1

-- =====================================================
-- === Tenants ===
-- =====================================================

-- 7.1 tenants
CREATE TABLE tenants (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL DEFAULT '',
  slug TEXT UNIQUE,
  logo_path TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_setup_complete INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================================================
-- === المستخدمين والأدوار ===
-- =====================================================

-- 7.2 users
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  username TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('owner','manager','accountant','operator','viewer')),
  is_active INTEGER NOT NULL DEFAULT 1,
  preferred_lang TEXT DEFAULT 'ar' CHECK(preferred_lang IN ('ar','he')),
  must_change_password INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, username)
);
CREATE INDEX idx_users_tenant ON users(tenant_id);

-- =====================================================
-- === العملاء ===
-- =====================================================

-- 7.3 clients
CREATE TABLE clients (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_id TEXT,
  equipment_daily_rate REAL,
  worker_daily_rate REAL,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_clients_tenant ON clients(tenant_id);

-- =====================================================
-- === أنواع المعدات (ديناميكي) ===
-- =====================================================

-- 7.4 equipment_types
CREATE TABLE equipment_types (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name_ar TEXT NOT NULL,
  name_he TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_equipment_types_tenant ON equipment_types(tenant_id);

-- =====================================================
-- === المعدات ===
-- =====================================================

-- 7.5 equipment
CREATE TABLE equipment (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  equipment_type_id TEXT NOT NULL REFERENCES equipment_types(id),
  identifier TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','deployed','maintenance','retired')),
  insurance_expiry TEXT,
  license_expiry TEXT,
  last_maintenance TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_equipment_tenant ON equipment(tenant_id);
CREATE INDEX idx_equipment_type ON equipment(equipment_type_id);

-- =====================================================
-- === السيارات ===
-- =====================================================

-- 7.6 vehicles
CREATE TABLE vehicles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  license_plate TEXT NOT NULL,
  type TEXT DEFAULT 'owned' CHECK(type IN ('owned','rented')),
  insurance_expiry TEXT,
  license_expiry TEXT,
  annual_insurance_cost REAL DEFAULT 0,
  annual_license_cost REAL DEFAULT 0,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_vehicles_tenant ON vehicles(tenant_id);

-- =====================================================
-- === العمال ===
-- =====================================================

-- 7.7 workers
CREATE TABLE workers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  full_name TEXT NOT NULL,
  id_number TEXT,
  phone TEXT,
  daily_rate REAL,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, id_number)
);
CREATE INDEX idx_workers_tenant ON workers(tenant_id);

-- =====================================================
-- === الدفتر اليومي ===
-- =====================================================

-- 7.8 daily_logs
CREATE TABLE daily_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  log_date TEXT NOT NULL,
  client_id TEXT NOT NULL REFERENCES clients(id),
  equipment_id TEXT NOT NULL REFERENCES equipment(id),
  vehicle_id TEXT REFERENCES vehicles(id),
  location TEXT,
  project_name TEXT,
  equipment_revenue REAL NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','confirmed','invoiced')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_daily_logs_tenant ON daily_logs(tenant_id);
CREATE INDEX idx_daily_logs_date ON daily_logs(log_date);
CREATE INDEX idx_daily_logs_client ON daily_logs(client_id);
CREATE INDEX idx_daily_logs_status ON daily_logs(status);

-- 7.9 worker_assignments
CREATE TABLE worker_assignments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  daily_log_id TEXT NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL REFERENCES workers(id),
  daily_rate REAL NOT NULL,
  revenue REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_wa_tenant ON worker_assignments(tenant_id);
CREATE INDEX idx_wa_log ON worker_assignments(daily_log_id);

-- =====================================================
-- === الوقود ===
-- =====================================================

-- 7.10 fuel_records
CREATE TABLE fuel_records (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  record_date TEXT NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  liters REAL NOT NULL,
  price_per_liter REAL NOT NULL,
  total_cost REAL NOT NULL,
  odometer_reading REAL,
  station_name TEXT,
  receipt_ref TEXT,
  payment_method TEXT DEFAULT 'cash' CHECK(payment_method IN ('cash','credit_card','bank_transfer')),
  credit_card_id TEXT REFERENCES credit_cards(id),
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_fuel_tenant ON fuel_records(tenant_id);
CREATE INDEX idx_fuel_date ON fuel_records(record_date);
CREATE INDEX idx_fuel_vehicle ON fuel_records(vehicle_id);

-- =====================================================
-- === المصاريف ===
-- =====================================================

-- 7.11 expenses
CREATE TABLE expenses (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  expense_date TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN (
    'fuel','vehicle_insurance','vehicle_license','vehicle_maintenance',
    'vehicle_rental','equipment_maintenance','worker_payment',
    'office','phone','internet','other'
  )),
  amount REAL NOT NULL,
  description TEXT,
  vehicle_id TEXT REFERENCES vehicles(id),
  equipment_id TEXT REFERENCES equipment(id),
  worker_id TEXT REFERENCES workers(id),
  payment_method TEXT DEFAULT 'cash' CHECK(payment_method IN ('cash','credit_card','bank_transfer','check')),
  credit_card_id TEXT REFERENCES credit_cards(id),
  check_id TEXT REFERENCES checks(id),
  bank_account_id TEXT REFERENCES bank_accounts(id),
  receipt_ref TEXT,
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);

-- =====================================================
-- === الفواتير ===
-- =====================================================

-- 7.12 invoices
CREATE TABLE invoices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  invoice_number TEXT NOT NULL,
  client_id TEXT NOT NULL REFERENCES clients(id),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  total_equipment_days INTEGER NOT NULL DEFAULT 0,
  total_equipment_revenue REAL NOT NULL DEFAULT 0,
  total_worker_days INTEGER NOT NULL DEFAULT 0,
  total_worker_revenue REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0,
  vat_rate REAL NOT NULL DEFAULT 17.0,
  vat_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','paid','partial','cancelled')),
  payment_due_date TEXT,
  paid_amount REAL DEFAULT 0,
  paid_date TEXT,
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, invoice_number)
);
CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);

-- 7.13 invoice_items
CREATE TABLE invoice_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  daily_log_id TEXT NOT NULL REFERENCES daily_logs(id),
  item_type TEXT NOT NULL CHECK(item_type IN ('equipment','worker')),
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  total REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_invoice_items_tenant ON invoice_items(tenant_id);

-- =====================================================
-- === الميزانية ===
-- =====================================================

-- 7.14 budgets
CREATE TABLE budgets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  budget_year INTEGER NOT NULL,
  budget_month INTEGER,
  category TEXT NOT NULL CHECK(category IN (
    'income_equipment','income_workers','income_other',
    'expense_fuel','expense_vehicle_insurance','expense_vehicle_license',
    'expense_vehicle_maintenance','expense_vehicle_rental',
    'expense_equipment_maintenance','expense_worker_payment',
    'expense_office','expense_phone','expense_internet','expense_other'
  )),
  planned_amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, budget_year, budget_month, category)
);
CREATE INDEX idx_budgets_tenant ON budgets(tenant_id);

-- 7.15 budget_alerts
CREATE TABLE budget_alerts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  budget_id TEXT NOT NULL REFERENCES budgets(id),
  alert_type TEXT NOT NULL CHECK(alert_type IN ('warning_80','warning_90','exceeded','critical')),
  alert_message TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_budget_alerts_tenant ON budget_alerts(tenant_id);

-- =====================================================
-- === الحسابات المالية ===
-- =====================================================

-- 7.16 bank_accounts
CREATE TABLE bank_accounts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  bank_name TEXT NOT NULL,
  branch_number TEXT,
  account_number TEXT NOT NULL,
  account_name TEXT,
  account_type TEXT DEFAULT 'checking' CHECK(account_type IN ('checking','savings','business')),
  currency TEXT DEFAULT 'ILS',
  current_balance REAL NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_bank_accounts_tenant ON bank_accounts(tenant_id);

-- 7.17 credit_cards
CREATE TABLE credit_cards (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id),
  card_name TEXT NOT NULL,
  last_four_digits TEXT NOT NULL,
  card_type TEXT DEFAULT 'visa' CHECK(card_type IN ('visa','mastercard','isracard','amex','diners','other')),
  credit_limit REAL DEFAULT 0,
  billing_day INTEGER NOT NULL DEFAULT 10,
  closing_day INTEGER NOT NULL DEFAULT 2,
  current_balance REAL NOT NULL DEFAULT 0,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_credit_cards_tenant ON credit_cards(tenant_id);

-- 7.18 standing_orders
CREATE TABLE standing_orders (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id),
  payee_name TEXT NOT NULL,
  amount REAL NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK(frequency IN ('weekly','monthly','bimonthly','quarterly','yearly')),
  day_of_month INTEGER,
  category TEXT NOT NULL,
  description TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_executed TEXT,
  next_execution TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_standing_orders_tenant ON standing_orders(tenant_id);

-- 7.19 checks
CREATE TABLE checks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  check_number TEXT NOT NULL,
  bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id),
  direction TEXT NOT NULL CHECK(direction IN ('incoming','outgoing')),
  amount REAL NOT NULL,
  payee_or_payer TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','deposited','cleared','bounced','cancelled','post_dated')),
  category TEXT,
  description TEXT,
  linked_invoice_id TEXT REFERENCES invoices(id),
  linked_expense_id TEXT REFERENCES expenses(id),
  bounce_reason TEXT,
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_checks_tenant ON checks(tenant_id);
CREATE INDEX idx_checks_due ON checks(due_date);
CREATE INDEX idx_checks_status ON checks(status);

-- 7.20 financial_transactions
CREATE TABLE financial_transactions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  transaction_date TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK(transaction_type IN (
    'bank_deposit','bank_withdrawal','bank_transfer',
    'credit_card_charge','credit_card_payment',
    'check_incoming','check_outgoing',
    'standing_order','cash_in','cash_out',
    'invoice_payment','expense_payment','salary_payment',
    'debt_given','debt_received','debt_repayment'
  )),
  amount REAL NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('in','out')),
  bank_account_id TEXT REFERENCES bank_accounts(id),
  credit_card_id TEXT REFERENCES credit_cards(id),
  check_id TEXT REFERENCES checks(id),
  standing_order_id TEXT REFERENCES standing_orders(id),
  invoice_id TEXT REFERENCES invoices(id),
  expense_id TEXT REFERENCES expenses(id),
  counterparty TEXT,
  category TEXT,
  description TEXT,
  reference_number TEXT,
  is_reconciled INTEGER NOT NULL DEFAULT 0,
  reconciled_at TEXT,
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ft_tenant ON financial_transactions(tenant_id);
CREATE INDEX idx_ft_date ON financial_transactions(transaction_date);
CREATE INDEX idx_ft_type ON financial_transactions(transaction_type);
CREATE INDEX idx_ft_reconciled ON financial_transactions(is_reconciled);

-- 7.21 debts
CREATE TABLE debts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  debt_type TEXT NOT NULL CHECK(debt_type IN ('owed_to_me','i_owe')),
  counterparty TEXT NOT NULL,
  counterparty_type TEXT DEFAULT 'other' CHECK(counterparty_type IN ('worker','supplier','client','other')),
  worker_id TEXT REFERENCES workers(id),
  client_id TEXT REFERENCES clients(id),
  original_amount REAL NOT NULL,
  remaining_amount REAL NOT NULL,
  issue_date TEXT NOT NULL,
  due_date TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','partial','paid','written_off')),
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_debts_tenant ON debts(tenant_id);
CREATE INDEX idx_debts_status ON debts(status);

-- 7.22 debt_payments
CREATE TABLE debt_payments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  debt_id TEXT NOT NULL REFERENCES debts(id),
  payment_date TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT DEFAULT 'cash' CHECK(payment_method IN ('cash','bank_transfer','check','credit_card','salary_deduction')),
  transaction_id TEXT REFERENCES financial_transactions(id),
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_debt_payments_tenant ON debt_payments(tenant_id);

-- 7.23 bank_reconciliations
CREATE TABLE bank_reconciliations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id),
  reconciliation_date TEXT NOT NULL,
  statement_balance REAL NOT NULL,
  system_balance REAL NOT NULL,
  difference REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','matched','discrepancy','resolved')),
  notes TEXT,
  reconciled_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reconciliations_tenant ON bank_reconciliations(tenant_id);

-- 7.24 reconciliation_items
CREATE TABLE reconciliation_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  reconciliation_id TEXT NOT NULL REFERENCES bank_reconciliations(id) ON DELETE CASCADE,
  transaction_id TEXT REFERENCES financial_transactions(id),
  statement_description TEXT,
  statement_amount REAL NOT NULL,
  match_status TEXT NOT NULL DEFAULT 'unmatched' CHECK(match_status IN ('matched','unmatched','partial','extra_in_bank','extra_in_system')),
  notes TEXT
);
CREATE INDEX idx_reconciliation_items_tenant ON reconciliation_items(tenant_id);

-- =====================================================
-- === النظام ===
-- =====================================================

-- 7.25 settings
CREATE TABLE settings (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  key TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, key)
);

-- 7.26 audit_log
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_values TEXT,
  new_values TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_tenant ON audit_log(tenant_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);

-- 7.27 notifications
CREATE TABLE notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT REFERENCES users(id),
  notification_type TEXT NOT NULL CHECK(notification_type IN (
    'insurance_expiry','license_expiry',
    'budget_warning','budget_exceeded',
    'low_balance','check_due','check_bounced',
    'standing_order_due','invoice_overdue',
    'debt_due','general'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK(severity IN ('info','warning','critical')),
  entity_type TEXT,
  entity_id TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- =====================================================
-- === VIEWs ===
-- =====================================================

-- 7.28 VIEW: daily_equipment_cost
CREATE VIEW daily_equipment_cost AS
SELECT
  v.tenant_id,
  v.id AS vehicle_id,
  v.name AS vehicle_name,
  COALESCE((
    SELECT SUM(fr.total_cost) / NULLIF(COUNT(DISTINCT fr.record_date), 0)
    FROM fuel_records fr WHERE fr.vehicle_id = v.id
    AND fr.record_date >= date('now', '-3 months')
  ), 0) AS avg_daily_fuel,
  ROUND(v.annual_insurance_cost / 365.0, 2) AS daily_insurance,
  ROUND(v.annual_license_cost / 365.0, 2) AS daily_license,
  COALESCE((
    SELECT SUM(e.amount) / 90.0
    FROM expenses e WHERE e.vehicle_id = v.id
    AND e.category = 'vehicle_maintenance'
    AND e.expense_date >= date('now', '-3 months')
  ), 0) AS avg_daily_maintenance
FROM vehicles v WHERE v.is_active = 1;

-- =====================================================
-- === Seed Data (7.29) ===
-- =====================================================

-- إنشاء tenant افتراضي
INSERT INTO tenants (id, name, is_setup_complete) VALUES
  ('default', '', 0);

-- مستخدم admin أولي — بدون بيانات شخصية
INSERT INTO users (id, tenant_id, username, password_hash, full_name, role, must_change_password) VALUES
  ('admin', 'default', 'admin', 'PLACEHOLDER_HASH', '', 'owner', 1);

-- إعدادات افتراضية — أرقام فقط، بدون بيانات شخصية
INSERT INTO settings (tenant_id, key, value, description) VALUES
  ('default', 'default_worker_daily_rate', '0', 'أجرة العامل اليومية الافتراضية'),
  ('default', 'default_equipment_daily_rate', '0', 'أجرة الوحدة اليومية الافتراضية'),
  ('default', 'client_worker_revenue', '0', 'ما يدفعه العميل مقابل العامل'),
  ('default', 'client_equipment_revenue', '0', 'ما يدفعه العميل مقابل الوحدة'),
  ('default', 'fuel_price_per_liter', '0', 'سعر لتر الوقود الحالي'),
  ('default', 'vat_rate', '17', 'نسبة الضريبة'),
  ('default', 'company_name', '', 'اسم الشركة'),
  ('default', 'company_phone', '', 'هاتف الشركة'),
  ('default', 'company_address', '', 'عنوان الشركة'),
  ('default', 'company_tax_id', '', 'الرقم الضريبي'),
  ('default', 'company_logo_path', '', 'مسار ملف اللوغو'),
  ('default', 'invoice_prefix', 'INV', 'بادئة أرقام الفواتير'),
  ('default', 'data_retention_months', '24', 'مدة الاحتفاظ بالبيانات'),
  ('default', 'low_balance_alert', '0', 'تنبيه نزول الرصيد'),
  ('default', 'budget_warning_threshold', '80', 'نسبة تنبيه الميزانية'),
  ('default', 'equipment_label_ar', 'معدات', 'تسمية المعدات بالعربي'),
  ('default', 'equipment_label_he', 'ציוד', 'تسمية المعدات بالعبري'),
  ('default', 'is_setup_complete', 'false', 'هل تم إكمال الإعداد الأولي');
