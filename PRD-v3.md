# PRD v3 — ניהול חכם (Nihul Hachum)
## Smart Field Service Management — SaaS-Ready Product

---

## 1. نظرة عامة (Overview)

### 1.1 المنتج
**ניהול חכם** — منتج SaaS لإدارة شركات الخدمات الميدانية. يناسب أي شركة عندها معدات/وحدات بتطلع يومياً مع أو بدون عمال: عربيات طرقات، مولدات كهرباء، رافعات، معدات بناء، شفط بيارات، وغيرها.

### 1.2 الرؤية
منتج تجاري عام — بدون أي بيانات شخصية بالكود. كل زبون بيفتح حسابه، بيسمي معداته حسب شغله، بيرفع لوغو شركته، وبيبلش يشتغل.

### 1.3 الفئة المستهدفة
- شركات خدمات ميدانية (5-100 موظف)
- مقاولين مستقلين عندهم معدات
- شركات تأجير معدات يومية

### 1.4 البنية
- **حالياً:** نسخة واحدة (Single Tenant) — لإثبات المنتج
- **مستقبلاً:** SaaS كامل (Multi-Tenant) — البنية جاهزة من اليوم الأول
- كل جدول فيه `tenant_id` من البداية

---

## 2. التقنيات (Tech Stack)

| المكون | التقنية |
|--------|---------|
| Frontend | Next.js 14+ (App Router) |
| Styling | Tailwind CSS + RTL support |
| Backend | Next.js Server Actions + API Routes |
| Database | Cloudflare D1 (SQLite) |
| Hosting | Cloudflare Workers/Pages |
| Auth | Custom JWT + bcrypt |
| PWA | next-pwa |
| PDF | jsPDF / reportlab |
| Excel | SheetJS |
| i18n | next-intl (ar + he) |
| Testing | Vitest + Playwright |
| File Upload | Local storage (لوغو + إيصالات) |

---

## 3. أدوار المستخدمين (User Roles)

| الدور | الوصف | الصلاحيات |
|-------|-------|-----------|
| `owner` | صاحب الشركة | كامل الصلاحيات |
| `manager` | مدير عمليات | تسجيل يومي، إدارة موارد، عرض تقارير |
| `accountant` | محاسب | تقارير مالية، فواتير، حسابات بنك، ميزانية |
| `operator` | مشغّل/سائق | تسجيل يومي خاص به فقط |
| `viewer` | مشاهد | عرض فقط |

---

## 4. معالج الإعداد الأولي (Setup Wizard)

عند أول دخول (`is_setup_complete = false`)، المستخدم يمر بـ 5 خطوات:

### الخطوة 1 — حسابك
- تغيير كلمة المرور الافتراضية (إجباري)
- الاسم الكامل
- البريد الإلكتروني (اختياري)
- اللغة المفضلة (عربي / عبري)

### الخطوة 2 — شركتك
- اسم الشركة
- رفع لوغو الشركة (ملف محلي، مش رابط)
- رقم التلفون
- العنوان
- מספר עוסק מורשה / ח.פ (اختياري)

### الخطوة 3 — طبيعة شغلك
- "شو بتسمي الوحدات/المعدات اللي بتشتغل فيها؟" (مثال: عربيات، مولدات، رافعات، معدات)
- إضافة أنواع المعدات (المستخدم بيحددها بنفسه)
- مثال: "عربية سهم"، "بالون إضاءة"، "عين قطة" — أو "مولد 50KVA"، "مولد 100KVA"

### الخطوة 4 — الأسعار
- سعر الوحدة اليومي (ما تدفعه الشركة العميلة مقابل الوحدة)
- سعر العامل اليومي الافتراضي (ما تدفعه أنت للعامل)
- ما تدفعه الشركة العميلة مقابل العامل
- نسبة ضريبة (ברירת מחדל: 17%)

### الخطوة 5 — ملخص وانطلاق
- ملخص كل الإعدادات
- زر "ابدأ باستخدام ניהול חכם"
- تحديث `is_setup_complete = true`

**ملاحظة:** كل هذه الإعدادات قابلة للتعديل لاحقاً من صفحة الإعدادات.

---

## 5. صفحة المساعدة (עזרה / مساعدة)

- متاحة دائماً من القائمة الجانبية
- دليل استخدام مبسط لكل قسم
- إمكانية إعادة تشغيل معالج الإعداد
- أسئلة شائعة
- نصائح وحيل

---

## 6. واجهة المستخدم (UI)

### 6.1 البراندينغ
- اللوغو: يظهر بالأعلى بالـ Sidebar
- تحت اللوغو: "ניהול חכם"
- تحته: اسم الشركة (من الإعدادات)
- لو ما في لوغو: يظهر اسم المنتج "ניהול חכם" فقط

### 6.2 المصطلحات الديناميكية
- النظام يستخدم المصطلح اللي اختاره المستخدم
- مثال: لو سمّى المعدات "مولدات" — كل الواجهة بتقول "مولدات" بدل "معدات"
- يُخزّن بـ settings: `equipment_label_ar`, `equipment_label_he`

### 6.3 هيكل الصفحات
```
/ ........................... Dashboard الرئيسي
/daily-log .................. الدفتر اليومي
/equipment .................. إدارة المعدات (الاسم حسب المستخدم)
/vehicles ................... إدارة السيارات
/workers .................... إدارة العمال
/fuel ....................... سجل الوقود
/expenses ................... المصاريف
/invoices ................... الفواتير
/budget ..................... الميزانية
/finance .................... الحسابات المالية
  /finance/bank-accounts .... حسابات البنك
  /finance/credit-cards ..... بطاقات الائتمان
  /finance/checks ........... الشيكات
  /finance/standing-orders .. הוראות קבע
  /finance/transactions ..... الحركات المالية
  /finance/cash-flow ........ תזרים מזומנים
  /finance/reconciliation ... התאמת בנק
  /finance/debts ............ ديون وسلف
/reports .................... التقارير
  /reports/profit-loss ...... ربح وخسارة
  /reports/accountant ....... דוח רואה חשבון
  /reports/fuel ............. تقرير الوقود
  /reports/workers .......... تقرير العمال
  /reports/cost-analysis .... تسعير ذكي
  /reports/budget ........... تقرير الميزانية
/settings ................... الإعدادات
  /settings/company ......... بيانات الشركة + لوغو
  /settings/pricing ......... الأسعار
  /settings/equipment-types . أنواع المعدات
  /settings/users ........... إدارة المستخدمين
  /settings/clients ......... إدارة الشركات العميلة
/help ....................... עזרה / مساعدة
/setup ...................... معالج الإعداد (أول مرة + إعادة تشغيل)
```

---

## 7. قاعدة البيانات (Database Schema)

**ملاحظة مهمة:** كل جدول فيه `tenant_id` — جاهز لـ SaaS. حالياً بنستخدم tenant واحد افتراضي.

---

### === Tenants ===

### 7.1 `tenants`
```sql
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
```

---

### === المستخدمين والأدوار ===

### 7.2 `users`
```sql
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
```

---

### === العملاء ===

### 7.3 `clients`
```sql
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
```

---

### === أنواع المعدات (ديناميكي) ===

### 7.4 `equipment_types`
```sql
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
```

---

### === المعدات ===

### 7.5 `equipment`
```sql
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
```

---

### === السيارات ===

### 7.6 `vehicles`
```sql
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
```

---

### === العمال ===

### 7.7 `workers`
```sql
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
```

---

### === الدفتر اليومي ===

### 7.8 `daily_logs`
```sql
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
```

### 7.9 `worker_assignments`
```sql
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
```

---

### === الوقود ===

### 7.10 `fuel_records`
```sql
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
```

---

### === المصاريف ===

### 7.11 `expenses`
```sql
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
```

---

### === الفواتير ===

### 7.12 `invoices`
```sql
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
```

### 7.13 `invoice_items`
```sql
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
```

---

### === الميزانية ===

### 7.14 `budgets`
```sql
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
```

### 7.15 `budget_alerts`
```sql
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
```

---

### === الحسابات المالية ===

### 7.16 `bank_accounts`
```sql
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
```

### 7.17 `credit_cards`
```sql
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
```

### 7.18 `standing_orders`
```sql
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
```

### 7.19 `checks`
```sql
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
```

### 7.20 `financial_transactions`
```sql
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
```

### 7.21 `debts`
```sql
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
```

### 7.22 `debt_payments`
```sql
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
```

### 7.23 `bank_reconciliations`
```sql
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
```

### 7.24 `reconciliation_items`
```sql
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
```

---

### === النظام ===

### 7.25 `settings`
```sql
CREATE TABLE settings (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  key TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, key)
);
```

### 7.26 `audit_log`
```sql
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
```

### 7.27 `notifications`
```sql
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
```

---

### === VIEWs ===

### 7.28 `VIEW: daily_equipment_cost`
```sql
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
```

---

### === Seed Data ===

### 7.29 البيانات الأولية
```sql
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
```

---

## 8. خطة السبرينتات — 12 مرحلة

| # | السبرينت | الوصف |
|---|----------|-------|
| 1 | Foundation | مشروع + DB + Auth + Login |
| 2 | Setup Wizard | معالج الإعداد الأولي (5 خطوات) + صفحة مساعدة |
| 3 | Settings | لوحة إعدادات + مستخدمين + عملاء + أنواع معدات |
| 4 | Resources | إدارة معدات + سيارات + عمال + تنبيهات |
| 5 | Daily Log | الدفتر اليومي + تعيين عمال + حساب إيرادات |
| 6 | Fuel & Expenses | وقود + مصاريف + ربط بوسيلة دفع |
| 7 | Invoicing | فوترة شهرية + PDF + حالات |
| 8 | Budget | ميزانية + תקציב מול ביצוע + تنبيهات |
| 9 | Finance | بنك + فيزا + שיקים + הוראות קבע + حركات |
| 10 | Cash Flow | תזרים מזומנים + התאמת בנק + ديون + تسعير ذكي |
| 11 | Reports | ربح/خسارة + רואה חשבון + وقود + عمال + ميزانية |
| 12 | Dashboard + PWA + i18n | لوحة رئيسية + موبايل + عربي/عبري + تحسينات |

---

## 9. الأمان

- JWT + refresh tokens
- bcrypt لكلمات المرور
- إجبار تغيير كلمة المرور أول مرة
- CSRF + Rate Limiting
- Audit log لكل عملية
- RBAC على كل route
- tenant_id isolation على كل query
- تشفير بيانات مالية حساسة
- HTTPS فقط

---

## 10. ملخص الجداول: 27 جدول + 1 VIEW

| # | الجدول | الوصف |
|---|--------|-------|
| 1 | tenants | المستأجرين (SaaS) |
| 2 | users | المستخدمين |
| 3 | clients | الشركات العميلة |
| 4 | equipment_types | أنواع المعدات (ديناميكي) |
| 5 | equipment | المعدات |
| 6 | vehicles | السيارات |
| 7 | workers | العمال |
| 8 | daily_logs | الدفتر اليومي |
| 9 | worker_assignments | تعيينات العمال |
| 10 | fuel_records | سجل الوقود |
| 11 | expenses | المصاريف |
| 12 | invoices | الفواتير |
| 13 | invoice_items | بنود الفواتير |
| 14 | budgets | الميزانيات |
| 15 | budget_alerts | تنبيهات الميزانية |
| 16 | bank_accounts | حسابات البنك |
| 17 | credit_cards | بطاقات الائتمان |
| 18 | standing_orders | הוראות קבע |
| 19 | checks | שיקים |
| 20 | financial_transactions | الحركات المالية |
| 21 | debts | ديون وسلف |
| 22 | debt_payments | سدادات الديون |
| 23 | bank_reconciliations | مطابقة البنك |
| 24 | reconciliation_items | بنود المطابقة |
| 25 | settings | الإعدادات |
| 26 | audit_log | سجل التدقيق |
| 27 | notifications | التنبيهات |
| V1 | daily_equipment_cost | VIEW: تكلفة يومية |
