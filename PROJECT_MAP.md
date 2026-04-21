# PROJECT_MAP — ניהול חכם / smart-management

Generated: 2026-04-21
Working directory: `C:\smart-management`
Git branch: `master`
Production URL: `https://smart-management.pages.dev`

---

## 1. الهيكل

### 1.1 Top-level

```
C:\smart-management\
├── .claude\
├── .env.example (none — see wrangler.toml + Pages secrets for prod)
├── .eslintrc.json
├── .gitignore
├── .npmrc                  (legacy-peer-deps=true)
├── PRD-v3.md
├── README.md
├── data\                   (local sqlite dev only, gitignored)
├── docs\
├── next-env.d.ts
├── next.config.mjs
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── public\                 (PWA: icons, manifest.json, offline.html, sw.js)
├── scripts\                (generate-pwa-icons.mjs)
├── src\
├── tailwind.config.ts
├── tests\                  (separate test harness; own package.json)
├── tsconfig.json
├── vitest.config.ts
└── wrangler.toml
```

### 1.2 `src/` tree (depth 3)

```
src\
├── __tests__\
│   ├── auth\               jwt.test.ts, password.test.ts, rbac.test.ts
│   ├── db\                 budget / daily-log / finance / invoices / operations / schema / settings .test.ts
│   └── helpers\            test-db.ts
├── app\
│   ├── (auth)\
│   │   ├── layout.tsx
│   │   └── login\          page.tsx
│   ├── (dashboard)\
│   │   ├── layout.tsx, loading.tsx, page.tsx
│   │   ├── budget\         actions.ts, BudgetManager.tsx, loading.tsx, page.tsx
│   │   ├── daily-log\      [id]\, actions.ts, DailyLogManager.tsx, loading.tsx, page.tsx
│   │   ├── equipment\      actions.ts, EquipmentManager.tsx, loading.tsx, page.tsx
│   │   ├── expenses\       actions.ts, ExpensesManager.tsx, loading.tsx, page.tsx
│   │   ├── finance\        7 sub-routes (cash-flow, checks, credit-cards, debts, reconciliation, standing-orders, transactions) + actions.ts + managers + layout.tsx + page.tsx
│   │   ├── fuel\           actions.ts, FuelManager.tsx, loading.tsx, page.tsx
│   │   ├── help\           actions.ts, HelpContent.tsx, loading.tsx, page.tsx
│   │   ├── invoices\       [id]\, actions.ts, InvoicesManager.tsx, loading.tsx, page.tsx
│   │   ├── reports\        6 sub-routes (accountant, budget-report, cost-analysis, fuel, workers, index) + layout.tsx + loading.tsx + page.tsx
│   │   ├── settings\       5 sub-routes (clients, equipment-types, pricing, users, index) + actions.ts + CompanyForm.tsx + SettingsNav.tsx + layout.tsx + loading.tsx + page.tsx
│   │   ├── vehicles\       actions.ts, VehiclesManager.tsx, loading.tsx, page.tsx
│   │   └── workers\        actions.ts, WorkersManager.tsx, loading.tsx, page.tsx
│   ├── (setup)\
│   │   ├── layout.tsx
│   │   ├── setup-context.tsx
│   │   └── setup\          actions.ts, page.tsx, steps\ (Step1Password, Step2Company, Step3Business, Step4Pricing, Step5Summary)
│   ├── api\
│   │   ├── auth\           login\route.ts, logout\route.ts
│   │   └── health\         route.ts
│   ├── favicon.ico
│   ├── fonts\
│   ├── globals.css
│   ├── layout.tsx          (root)
│   └── not-found.tsx
├── components\
│   ├── layout\             Header.tsx, Sidebar.tsx, sidebar-state.ts
│   └── ui\                 AlertsBanner.tsx, LoadingSpinner.tsx
├── env.d.ts                (CloudflareEnv + D1Database global types)
├── lib\
│   ├── auth\               __tests__\ (none at this level), jwt.ts, password.ts, rbac.ts, session.ts
│   ├── db\                 d1-adapter.ts, generate-hash.ts, index.ts, migrate.ts, schema.sql, sqlite-adapter.ts, types.ts
│   ├── i18n\               (empty dir retained)
│   └── utils\              budget-calculations.ts, budget-types.ts, cash-flow-calculations.ts, company-info.ts, dashboard-stats.ts, expiry-alerts.ts, generate-invoice-pdf.ts, id.ts, report-calculations.ts
├── middleware.ts
└── types\                  (empty dir retained)
```

### 1.3 All `route.ts` files (full list)

```
src\app\api\auth\login\route.ts
src\app\api\auth\logout\route.ts
src\app\api\health\route.ts
```

Only **3 route.ts files** exist. All other mutations in the app are **Server Actions** (`actions.ts` files), invoked via Next.js RSC flight protocol, **not** reachable via plain `fetch`.

---

## 2. مصفوفة الـ API Routes

**No Zod anywhere in the project.** Validation is inline in each route/action.

| المسار الكامل | Method | Body schema | Response schema | Auth |
|---|---|---|---|---|
| `/api/auth/login` | `POST` | `{ username: string, password: string }` (read via `request.json()`, validated inline — both required non-empty strings) | `200`: `{ success: true, mustChangePassword: boolean, isSetupComplete: boolean }` <br> `400`: `{ success: false, error: "اسم المستخدم أو كلمة المرور غلط" }` (invalid JSON / missing fields) <br> `401`: same error body (wrong creds) | Public (bypass) |
| `/api/auth/logout` | `POST` | _none_ (no body) | `200`: `{ success: true }` | Authenticated (cookie required) |
| `/api/health` | `GET` | _none_ | `200`: `{ env: string, dbType: "d1"\|"sqlite", timestamp: ISO, tests: { adapterQuery: {ok, isArray, length, firstRow}, rawD1?: {ok, typeOf, isArray, keys, hasResults, raw} } }` — always 200, errors wrapped in body | Public (bypass) |

**Edge runtime**: all 3 routes declare `export const runtime = 'edge'`.

### 2.1 Why no CRUD API routes

The project uses **Next.js Server Actions** for every mutation, not REST endpoints. See Section 8 below for the full Server Actions inventory (52 actions across 13 files).

---

## 3. قاعدة البيانات

**Source of truth**: `src/lib/db/schema.sql` — raw SQL, not an ORM. No migrations folder. Schema changes land as edits to `schema.sql` + idempotent `INSERT OR IGNORE` blocks in `src/lib/db/migrate.ts`.

Target dialects: **SQLite** (local dev via `better-sqlite3`) and **Cloudflare D1** (production).

### 3.1 Tables (27 tables + 1 VIEW)

#### 3.1.1 `tenants`
```
id TEXT PK DEFAULT (lower(hex(randomblob(16))))
name TEXT NOT NULL DEFAULT ''
slug TEXT UNIQUE
logo_path TEXT
is_active INTEGER NOT NULL DEFAULT 1
is_setup_complete INTEGER NOT NULL DEFAULT 0
created_at TEXT NOT NULL DEFAULT (datetime('now'))
updated_at TEXT NOT NULL DEFAULT (datetime('now'))
```

#### 3.1.2 `users`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
username TEXT NOT NULL
email TEXT
password_hash TEXT NOT NULL
full_name TEXT NOT NULL DEFAULT ''
phone TEXT
role TEXT NOT NULL DEFAULT 'viewer' CHECK IN ('owner','manager','accountant','operator','viewer')
is_active INTEGER NOT NULL DEFAULT 1
preferred_lang TEXT DEFAULT 'ar' CHECK IN ('ar','he')
must_change_password INTEGER NOT NULL DEFAULT 1
created_at, updated_at TEXT
UNIQUE(tenant_id, username)
INDEX idx_users_tenant ON (tenant_id)
```

#### 3.1.3 `clients`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
name TEXT NOT NULL
contact_person TEXT
phone, email, address, tax_id TEXT
equipment_daily_rate REAL
worker_daily_rate REAL
notes TEXT
is_active INTEGER NOT NULL DEFAULT 1
created_at, updated_at TEXT
INDEX idx_clients_tenant ON (tenant_id)
```

#### 3.1.4 `equipment_types`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
name_ar TEXT NOT NULL
name_he TEXT
description TEXT
sort_order INTEGER DEFAULT 0
is_active INTEGER NOT NULL DEFAULT 1
created_at TEXT
INDEX idx_equipment_types_tenant ON (tenant_id)
```

#### 3.1.5 `equipment`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
name TEXT NOT NULL
equipment_type_id TEXT NOT NULL → equipment_types(id)
identifier TEXT
status TEXT NOT NULL DEFAULT 'available' CHECK IN ('available','deployed','maintenance','retired')
insurance_expiry TEXT
license_expiry TEXT
last_maintenance TEXT
notes TEXT
is_active INTEGER NOT NULL DEFAULT 1
created_at, updated_at TEXT
INDEX idx_equipment_tenant ON (tenant_id)
INDEX idx_equipment_type ON (equipment_type_id)
```

#### 3.1.6 `vehicles`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
name TEXT NOT NULL
license_plate TEXT NOT NULL
type TEXT DEFAULT 'owned' CHECK IN ('owned','rented')
insurance_expiry, license_expiry TEXT
annual_insurance_cost, annual_license_cost REAL DEFAULT 0
notes TEXT
is_active INTEGER NOT NULL DEFAULT 1
created_at, updated_at TEXT
INDEX idx_vehicles_tenant ON (tenant_id)
```

#### 3.1.7 `workers`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
full_name TEXT NOT NULL
id_number TEXT
phone TEXT
daily_rate REAL
notes TEXT
is_active INTEGER NOT NULL DEFAULT 1
created_at, updated_at TEXT
UNIQUE(tenant_id, id_number)
INDEX idx_workers_tenant ON (tenant_id)
```

#### 3.1.8 `daily_logs`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
log_date TEXT NOT NULL
client_id TEXT NOT NULL → clients(id)
equipment_id TEXT NOT NULL → equipment(id)
vehicle_id TEXT → vehicles(id)
location, project_name TEXT
equipment_revenue REAL NOT NULL DEFAULT 0
notes TEXT
status TEXT NOT NULL DEFAULT 'draft' CHECK IN ('draft','confirmed','invoiced')
created_by TEXT NOT NULL → users(id)
created_at, updated_at TEXT
INDEX idx_daily_logs_tenant ON (tenant_id)
INDEX idx_daily_logs_date ON (log_date)
INDEX idx_daily_logs_client ON (client_id)
INDEX idx_daily_logs_status ON (status)
```

#### 3.1.9 `worker_assignments`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
daily_log_id TEXT NOT NULL → daily_logs(id) ON DELETE CASCADE
worker_id TEXT NOT NULL → workers(id)
daily_rate REAL NOT NULL
revenue REAL NOT NULL DEFAULT 0
notes TEXT
created_at TEXT
INDEX idx_wa_tenant ON (tenant_id)
INDEX idx_wa_log ON (daily_log_id)
```

#### 3.1.10 `fuel_records`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
record_date TEXT NOT NULL
vehicle_id TEXT NOT NULL → vehicles(id)
liters, price_per_liter, total_cost REAL NOT NULL
odometer_reading REAL
station_name, receipt_ref TEXT
payment_method TEXT DEFAULT 'cash' CHECK IN ('cash','credit_card','bank_transfer')
credit_card_id TEXT → credit_cards(id)
notes TEXT
created_by TEXT NOT NULL → users(id)
created_at TEXT
INDEX idx_fuel_tenant ON (tenant_id)
INDEX idx_fuel_date ON (record_date)
INDEX idx_fuel_vehicle ON (vehicle_id)
```

#### 3.1.11 `expenses`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
expense_date TEXT NOT NULL
category TEXT NOT NULL CHECK IN ('fuel','vehicle_insurance','vehicle_license','vehicle_maintenance','vehicle_rental','equipment_maintenance','worker_payment','office','phone','internet','other')
amount REAL NOT NULL
description TEXT
vehicle_id TEXT → vehicles(id)
equipment_id TEXT → equipment(id)
worker_id TEXT → workers(id)
payment_method TEXT DEFAULT 'cash' CHECK IN ('cash','credit_card','bank_transfer','check')
credit_card_id TEXT → credit_cards(id)
check_id TEXT → checks(id)
bank_account_id TEXT → bank_accounts(id)
receipt_ref, notes TEXT
created_by TEXT NOT NULL → users(id)
created_at TEXT
INDEX idx_expenses_tenant ON (tenant_id)
INDEX idx_expenses_date ON (expense_date)
INDEX idx_expenses_category ON (category)
```

#### 3.1.12 `invoices`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
invoice_number TEXT NOT NULL
client_id TEXT NOT NULL → clients(id)
period_start, period_end TEXT NOT NULL
total_equipment_days INTEGER DEFAULT 0
total_equipment_revenue REAL DEFAULT 0
total_worker_days INTEGER DEFAULT 0
total_worker_revenue REAL DEFAULT 0
subtotal REAL DEFAULT 0
vat_rate REAL DEFAULT 17.0
vat_amount REAL DEFAULT 0
total REAL DEFAULT 0
status TEXT NOT NULL DEFAULT 'draft' CHECK IN ('draft','sent','paid','partial','cancelled')
payment_due_date TEXT
paid_amount REAL DEFAULT 0
paid_date TEXT
notes TEXT
created_by TEXT NOT NULL → users(id)
created_at, updated_at TEXT
UNIQUE(tenant_id, invoice_number)
INDEX idx_invoices_tenant ON (tenant_id)
```

#### 3.1.13 `invoice_items`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
invoice_id TEXT NOT NULL → invoices(id) ON DELETE CASCADE
daily_log_id TEXT NOT NULL → daily_logs(id)
item_type TEXT NOT NULL CHECK IN ('equipment','worker')
description TEXT
quantity INTEGER DEFAULT 1
unit_price REAL NOT NULL
total REAL NOT NULL
created_at TEXT
INDEX idx_invoice_items_tenant ON (tenant_id)
```

#### 3.1.14 `budgets`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
budget_year INTEGER NOT NULL
budget_month INTEGER (nullable — NULL = yearly)
category TEXT NOT NULL CHECK IN (14 values: income_equipment/workers/other + expense_fuel/vehicle_insurance/vehicle_license/vehicle_maintenance/vehicle_rental/equipment_maintenance/worker_payment/office/phone/internet/other)
planned_amount REAL DEFAULT 0
notes TEXT
created_by TEXT NOT NULL → users(id)
created_at, updated_at TEXT
UNIQUE(tenant_id, budget_year, budget_month, category)
INDEX idx_budgets_tenant ON (tenant_id)
```

#### 3.1.15 `budget_alerts`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
budget_id TEXT NOT NULL → budgets(id)
alert_type TEXT NOT NULL CHECK IN ('warning_80','warning_90','exceeded','critical')
alert_message TEXT
is_read INTEGER NOT NULL DEFAULT 0
created_at TEXT
INDEX idx_budget_alerts_tenant ON (tenant_id)
```

#### 3.1.16 `bank_accounts`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
bank_name TEXT NOT NULL
branch_number TEXT
account_number TEXT NOT NULL
account_name TEXT
account_type TEXT DEFAULT 'checking' CHECK IN ('checking','savings','business')
currency TEXT DEFAULT 'ILS'
current_balance REAL NOT NULL DEFAULT 0
is_primary INTEGER NOT NULL DEFAULT 0
notes TEXT
is_active INTEGER NOT NULL DEFAULT 1
created_at, updated_at TEXT
INDEX idx_bank_accounts_tenant ON (tenant_id)
```

#### 3.1.17 `credit_cards`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
bank_account_id TEXT NOT NULL → bank_accounts(id)
card_name TEXT NOT NULL
last_four_digits TEXT NOT NULL
card_type TEXT DEFAULT 'visa' CHECK IN ('visa','mastercard','isracard','amex','diners','other')
credit_limit REAL DEFAULT 0
billing_day INTEGER NOT NULL DEFAULT 10
closing_day INTEGER NOT NULL DEFAULT 2
current_balance REAL NOT NULL DEFAULT 0
notes TEXT
is_active INTEGER NOT NULL DEFAULT 1
created_at, updated_at TEXT
INDEX idx_credit_cards_tenant ON (tenant_id)
```

#### 3.1.18 `standing_orders`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
bank_account_id TEXT NOT NULL → bank_accounts(id)
payee_name TEXT NOT NULL
amount REAL NOT NULL
frequency TEXT NOT NULL DEFAULT 'monthly' CHECK IN ('weekly','monthly','bimonthly','quarterly','yearly')
day_of_month INTEGER
category TEXT NOT NULL
description TEXT
start_date TEXT NOT NULL
end_date TEXT
is_active INTEGER NOT NULL DEFAULT 1
last_executed, next_execution TEXT
notes TEXT
created_at, updated_at TEXT
INDEX idx_standing_orders_tenant ON (tenant_id)
```

#### 3.1.19 `checks`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
check_number TEXT NOT NULL
bank_account_id TEXT NOT NULL → bank_accounts(id)
direction TEXT NOT NULL CHECK IN ('incoming','outgoing')
amount REAL NOT NULL
payee_or_payer TEXT NOT NULL
issue_date, due_date TEXT NOT NULL
status TEXT NOT NULL DEFAULT 'pending' CHECK IN ('pending','deposited','cleared','bounced','cancelled','post_dated')
category, description TEXT
linked_invoice_id TEXT → invoices(id)
linked_expense_id TEXT → expenses(id)
bounce_reason, notes TEXT
created_by TEXT NOT NULL → users(id)
created_at, updated_at TEXT
INDEX idx_checks_tenant ON (tenant_id)
INDEX idx_checks_due ON (due_date)
INDEX idx_checks_status ON (status)
```

#### 3.1.20 `financial_transactions`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
transaction_date TEXT NOT NULL
transaction_type TEXT NOT NULL CHECK IN (16 values: bank_deposit/withdrawal/transfer, credit_card_charge/payment, check_incoming/outgoing, standing_order, cash_in/out, invoice_payment, expense_payment, salary_payment, debt_given/received/repayment)
amount REAL NOT NULL
direction TEXT NOT NULL CHECK IN ('in','out')
bank_account_id TEXT → bank_accounts(id)
credit_card_id TEXT → credit_cards(id)
check_id TEXT → checks(id)
standing_order_id TEXT → standing_orders(id)
invoice_id TEXT → invoices(id)
expense_id TEXT → expenses(id)
counterparty, category, description, reference_number TEXT
is_reconciled INTEGER NOT NULL DEFAULT 0
reconciled_at TEXT
notes TEXT
created_by TEXT NOT NULL → users(id)
created_at TEXT
INDEX idx_ft_tenant ON (tenant_id)
INDEX idx_ft_date ON (transaction_date)
INDEX idx_ft_type ON (transaction_type)
INDEX idx_ft_reconciled ON (is_reconciled)
```

#### 3.1.21 `debts`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
debt_type TEXT NOT NULL CHECK IN ('owed_to_me','i_owe')
counterparty TEXT NOT NULL
counterparty_type TEXT DEFAULT 'other' CHECK IN ('worker','supplier','client','other')
worker_id TEXT → workers(id)
client_id TEXT → clients(id)
original_amount, remaining_amount REAL NOT NULL
issue_date TEXT NOT NULL
due_date TEXT
description TEXT
status TEXT NOT NULL DEFAULT 'active' CHECK IN ('active','partial','paid','written_off')
notes TEXT
created_by TEXT NOT NULL → users(id)
created_at, updated_at TEXT
INDEX idx_debts_tenant ON (tenant_id)
INDEX idx_debts_status ON (status)
```

#### 3.1.22 `debt_payments`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
debt_id TEXT NOT NULL → debts(id)
payment_date TEXT NOT NULL
amount REAL NOT NULL
payment_method TEXT DEFAULT 'cash' CHECK IN ('cash','bank_transfer','check','credit_card','salary_deduction')
transaction_id TEXT → financial_transactions(id)
notes TEXT
created_by TEXT NOT NULL → users(id)
created_at TEXT
INDEX idx_debt_payments_tenant ON (tenant_id)
```

#### 3.1.23 `bank_reconciliations`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
bank_account_id TEXT NOT NULL → bank_accounts(id)
reconciliation_date TEXT NOT NULL
statement_balance, system_balance REAL NOT NULL
difference REAL NOT NULL DEFAULT 0
status TEXT NOT NULL DEFAULT 'pending' CHECK IN ('pending','matched','discrepancy','resolved')
notes TEXT
reconciled_by TEXT NOT NULL → users(id)
created_at TEXT
INDEX idx_reconciliations_tenant ON (tenant_id)
```

#### 3.1.24 `reconciliation_items`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
reconciliation_id TEXT NOT NULL → bank_reconciliations(id) ON DELETE CASCADE
transaction_id TEXT → financial_transactions(id)
statement_description TEXT
statement_amount REAL NOT NULL
match_status TEXT NOT NULL DEFAULT 'unmatched' CHECK IN ('matched','unmatched','partial','extra_in_bank','extra_in_system')
notes TEXT
INDEX idx_reconciliation_items_tenant ON (tenant_id)
```

#### 3.1.25 `settings`
```
tenant_id TEXT NOT NULL → tenants(id)
key TEXT NOT NULL
value TEXT NOT NULL DEFAULT ''
description TEXT
updated_at TEXT
PRIMARY KEY (tenant_id, key)
```

#### 3.1.26 `audit_log`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
user_id TEXT NOT NULL → users(id)
action TEXT NOT NULL
entity_type TEXT NOT NULL
entity_id TEXT
old_values, new_values TEXT
ip_address TEXT
created_at TEXT
INDEX idx_audit_tenant ON (tenant_id)
INDEX idx_audit_entity ON (entity_type, entity_id)
```

#### 3.1.27 `notifications`
```
id TEXT PK
tenant_id TEXT NOT NULL → tenants(id)
user_id TEXT → users(id)
notification_type TEXT NOT NULL CHECK IN (11 values: insurance_expiry, license_expiry, budget_warning, budget_exceeded, low_balance, check_due, check_bounced, standing_order_due, invoice_overdue, debt_due, general)
title, message TEXT NOT NULL
severity TEXT NOT NULL DEFAULT 'info' CHECK IN ('info','warning','critical')
entity_type, entity_id TEXT
is_read INTEGER NOT NULL DEFAULT 0
created_at TEXT
INDEX idx_notifications_tenant ON (tenant_id)
INDEX idx_notifications_read ON (is_read)
```

### 3.2 VIEW

#### `daily_equipment_cost`
```sql
SELECT
  v.tenant_id, v.id AS vehicle_id, v.name AS vehicle_name,
  COALESCE((SELECT SUM(fr.total_cost)/NULLIF(COUNT(DISTINCT fr.record_date),0) FROM fuel_records fr WHERE fr.vehicle_id=v.id AND fr.record_date >= date('now','-3 months')), 0) AS avg_daily_fuel,
  ROUND(v.annual_insurance_cost/365.0, 2) AS daily_insurance,
  ROUND(v.annual_license_cost/365.0, 2) AS daily_license,
  COALESCE((SELECT SUM(e.amount)/90.0 FROM expenses e WHERE e.vehicle_id=v.id AND e.category='vehicle_maintenance' AND e.expense_date >= date('now','-3 months')), 0) AS avg_daily_maintenance
FROM vehicles v WHERE v.is_active = 1
```

### 3.3 Seed data (shipped in schema.sql)

```sql
INSERT INTO tenants (id, name, is_setup_complete) VALUES ('default', '', 0);

INSERT INTO users (id, tenant_id, username, password_hash, full_name, role, must_change_password) VALUES
  ('admin', 'default', 'admin', '$2b$12$19qWCLWoYoFBb/qGvRo6ie1MqqXLQKoranJV7uie32V4AaT0jPMfO', '', 'owner', 1);
-- default admin password: admin123  (must be changed on first login)

INSERT INTO settings (tenant_id, key, value, description) VALUES
  ('default', 'default_worker_daily_rate', '0', 'أجرة العامل اليومية الافتراضية'),
  ('default', 'default_equipment_daily_rate', '0', 'أجرة الوحدة اليومية الافتراضية'),
  ('default', 'client_worker_revenue', '0', 'ما يدفعه العميل مقابل العامل'),
  ('default', 'client_equipment_revenue', '0', 'ما يدفعه العميل مقابل الوحدة'),
  ('default', 'fuel_price_per_liter', '0', 'سعر لتر الوقود الحالي'),
  ('default', 'vat_rate', '17', 'نسبة الضريبة'),
  ('default', 'company_name', '', ...), ('default', 'company_phone', '', ...),
  ('default', 'company_address', '', ...), ('default', 'company_tax_id', '', ...),
  ('default', 'company_logo_path', '', ...legacy/empty),
  ('default', 'company_logo_base64', '', 'بيانات اللوغو base64'),
  ('default', 'company_logo_mime', '', 'نوع MIME لصورة اللوغو'),
  ('default', 'invoice_prefix', 'INV', ...),
  ('default', 'data_retention_months', '24', ...),
  ('default', 'low_balance_alert', '0', ...),
  ('default', 'budget_warning_threshold', '80', ...),
  ('default', 'equipment_label_ar', 'معدات', ...),
  ('default', 'equipment_label_he', 'ציוד', ...),
  ('default', 'is_setup_complete', 'false', ...);
-- 20 settings rows per tenant
```

---

## 4. الأدوار والصلاحيات

**Source**: `src/lib/auth/rbac.ts`

### 4.1 Roles

```
'owner' | 'manager' | 'accountant' | 'operator' | 'viewer'
```

### 4.2 Permissions matrix

```ts
export const PERMISSIONS = {
  settings:         ['owner'],
  'settings.users': ['owner'],
  finance:          ['owner', 'accountant'],
  'daily_log.write':['owner', 'manager', 'operator'],
  'daily_log.read': ['owner', 'manager', 'accountant', 'operator', 'viewer'],
  reports:          ['owner', 'manager', 'accountant'],
  invoices:         ['owner', 'accountant'],
  budget:           ['owner', 'accountant'],
  equipment:        ['owner', 'manager'],
  workers:          ['owner', 'manager'],
  help:             ['owner', 'manager', 'accountant', 'operator', 'viewer'],
}
```

11 permission keys × 5 roles.

### 4.3 API

```ts
hasPermission(role: Role, permission: string): boolean
requirePermission(role: Role, permission: string): void   // throws "Role 'X' lacks permission 'Y'"
```

### 4.4 How roles are enforced at runtime

- **Middleware** (`src/middleware.ts`): verifies JWT, injects `x-user-role` header. Does NOT gate by role.
- **Server Components** (pages/layouts): read `headers().get('x-user-role')` and call `hasPermission(...)`, redirect on deny.
- **Server Actions**: each action calls a local `require<Role>()` helper:
  - `requireOwner()` — owner only (settings actions)
  - `requireRole(['owner','manager'])` — equipment / vehicles / workers
  - `requireWriter()` = `['owner','manager','operator']` — daily-log / fuel / expenses
  - `requireFinanceRole()` = `['owner','accountant']` — finance / invoices / budget
- **Tenant isolation**: every action also checks `auth.tenantId === tenantId` from the call.

---

## 5. الصفحات

File → URL mapping. Route groups `(auth)`, `(dashboard)`, `(setup)` do NOT appear in URLs.

### 5.1 Auth

| File | URL | Runtime | Notes |
|---|---|---|---|
| `src/app/(auth)/login/page.tsx` | `/login` | edge (via `'use client'`) | Client form, POSTs to `/api/auth/login` |

### 5.2 Setup wizard

| File | URL | Runtime |
|---|---|---|
| `src/app/(setup)/setup/page.tsx` | `/setup` | edge |

### 5.3 Dashboard root

| File | URL | Runtime |
|---|---|---|
| `src/app/(dashboard)/page.tsx` | `/` | edge |
| `src/app/(dashboard)/daily-log/page.tsx` | `/daily-log` | edge |
| `src/app/(dashboard)/daily-log/[id]/page.tsx` | `/daily-log/:id` | edge |
| `src/app/(dashboard)/equipment/page.tsx` | `/equipment` | edge |
| `src/app/(dashboard)/vehicles/page.tsx` | `/vehicles` | edge |
| `src/app/(dashboard)/workers/page.tsx` | `/workers` | edge |
| `src/app/(dashboard)/fuel/page.tsx` | `/fuel` | edge |
| `src/app/(dashboard)/expenses/page.tsx` | `/expenses` | edge |
| `src/app/(dashboard)/invoices/page.tsx` | `/invoices` | edge |
| `src/app/(dashboard)/invoices/[id]/page.tsx` | `/invoices/:id` | edge |
| `src/app/(dashboard)/budget/page.tsx` | `/budget` | edge |
| `src/app/(dashboard)/help/page.tsx` | `/help` | edge |

### 5.4 Finance (8 pages)

| File | URL |
|---|---|
| `src/app/(dashboard)/finance/page.tsx` | `/finance` |
| `src/app/(dashboard)/finance/cash-flow/page.tsx` | `/finance/cash-flow` |
| `src/app/(dashboard)/finance/credit-cards/page.tsx` | `/finance/credit-cards` |
| `src/app/(dashboard)/finance/checks/page.tsx` | `/finance/checks` |
| `src/app/(dashboard)/finance/standing-orders/page.tsx` | `/finance/standing-orders` |
| `src/app/(dashboard)/finance/transactions/page.tsx` | `/finance/transactions` |
| `src/app/(dashboard)/finance/debts/page.tsx` | `/finance/debts` |
| `src/app/(dashboard)/finance/reconciliation/page.tsx` | `/finance/reconciliation` |

### 5.5 Reports (6 pages)

| File | URL |
|---|---|
| `src/app/(dashboard)/reports/page.tsx` | `/reports` |
| `src/app/(dashboard)/reports/accountant/page.tsx` | `/reports/accountant` |
| `src/app/(dashboard)/reports/budget-report/page.tsx` | `/reports/budget-report` |
| `src/app/(dashboard)/reports/cost-analysis/page.tsx` | `/reports/cost-analysis` |
| `src/app/(dashboard)/reports/fuel/page.tsx` | `/reports/fuel` |
| `src/app/(dashboard)/reports/workers/page.tsx` | `/reports/workers` |

### 5.6 Settings (5 pages)

| File | URL |
|---|---|
| `src/app/(dashboard)/settings/page.tsx` | `/settings` |
| `src/app/(dashboard)/settings/pricing/page.tsx` | `/settings/pricing` |
| `src/app/(dashboard)/settings/equipment-types/page.tsx` | `/settings/equipment-types` |
| `src/app/(dashboard)/settings/users/page.tsx` | `/settings/users` |
| `src/app/(dashboard)/settings/clients/page.tsx` | `/settings/clients` |

### 5.7 Layouts (7 total)

| File | Wraps |
|---|---|
| `src/app/layout.tsx` | Root (html, body, fonts, metadata — RTL Hebrew) |
| `src/app/(auth)/layout.tsx` | /login (dark centered shell) |
| `src/app/(setup)/layout.tsx` | /setup |
| `src/app/(dashboard)/layout.tsx` | All dashboard pages (Sidebar + Header, alerts, setup-complete guard) |
| `src/app/(dashboard)/finance/layout.tsx` | /finance/* (finance nav + role gate) |
| `src/app/(dashboard)/reports/layout.tsx` | /reports/* |
| `src/app/(dashboard)/settings/layout.tsx` | /settings/* (owner-only gate) |

### 5.8 Special

- `src/app/not-found.tsx` → custom 404
- All pages (edge) + layouts (edge) declare `export const runtime = 'edge'` except root layout and (auth)/layout which are Node by default.

---

## 6. Middleware

**Source**: `src/middleware.ts`

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';

const EXACT_BYPASS = new Set([
  '/login',
  '/setup',
  '/api/auth/login',
  '/api/health',
  '/favicon.ico',
  '/manifest.json',
  '/offline.html',
  '/sw.js',
]);
const PREFIX_BYPASS = ['/_next', '/api/public', '/icons/', '/workbox-'];
const STATIC_EXT = /\.(png|jpg|jpeg|svg|css|js|json|html|ico|webmanifest|xml|map|woff2?|txt)$/i;

function shouldBypass(pathname: string): boolean {
  if (EXACT_BYPASS.has(pathname)) return true;
  if (PREFIX_BYPASS.some((p) => pathname.startsWith(p))) return true;
  return STATIC_EXT.test(pathname);
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (shouldBypass(pathname)) return NextResponse.next();

  const token = request.cookies.get('auth-token')?.value;
  const payload = token ? await verifyToken(token) : null;

  if (!payload) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const headers = new Headers(request.headers);
  headers.set('x-user-id', payload.userId);
  headers.set('x-user-role', payload.role);
  headers.set('x-user-username', payload.username);
  headers.set('x-tenant-id', payload.tenantId);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
```

**Bypassed** (unauthenticated, public):
- Exact: `/login`, `/setup`, `/api/auth/login`, `/api/health`, `/favicon.ico`, `/manifest.json`, `/offline.html`, `/sw.js`
- Prefix: `/_next/*`, `/api/public/*`, `/icons/*`, `/workbox-*`
- Any static extension (images, CSS, JS, fonts, etc.)

**Protected** (redirect to `/login` if no valid JWT cookie):
- Everything else — `/`, `/daily-log`, `/expenses`, `/invoices`, `/finance/*`, `/reports/*`, `/settings/*`, `/api/auth/logout`, any other path.

**Header injection** (after auth passes):
- `x-user-id`, `x-user-role`, `x-user-username`, `x-tenant-id`

**Runtime**: Edge (implicit — Next.js middleware always runs on Edge). Uses `jose` for JWT verification (edge-compatible), never touches the DB.

---

## 7. الإعدادات

### 7.1 `wrangler.toml`

```toml
name = "smart-management"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".vercel/output/static"

[[d1_databases]]
binding = "DB"
database_name = "smart-management"
database_id = "c7dae71f-891d-4ec6-9a48-1af60ab45bb2"
```

### 7.2 `next.config.mjs`

```js
import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: { document: '/offline.html' },
});

// Cloudflare bindings for `next dev` — non-fatal on failure.
if (process.env.NODE_ENV === 'development') {
  try {
    const { setupDevPlatform } = await import('@cloudflare/next-on-pages/next-dev');
    await setupDevPlatform();
  } catch (err) {
    console.warn('[next-dev] setupDevPlatform skipped:', err?.message ?? err);
  }
}

const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  webpack: (config, { webpack, nextRuntime }) => {
    if (nextRuntime === 'edge') {
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(better-sqlite3|bindings|file-uri-to-path)$/,
        }),
      );
    }
    return config;
  },
};

export default withPWA(nextConfig);
```

**Key flags**:
- `bodySizeLimit: '5mb'` — supports base64 logo upload up to ~2 MB after encoding
- `serverComponentsExternalPackages: ['better-sqlite3']` — Node-runtime-only exclusion
- `webpack.IgnorePlugin` for edge runtime — stubs native modules so the dev-branch require(sqlite-adapter) doesn't drag `path` / `fs` into the edge bundle

### 7.3 `package.json` (main project)

```json
{
  "name": "smart-management",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "pages:build": "npx @cloudflare/next-on-pages",
    "pages:deploy": "wrangler pages deploy .vercel/output/static",
    "pages:dev": "npx wrangler pages dev .vercel/output/static"
  },
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "better-sqlite3": "^12.9.0",
    "jose": "^6.2.2",
    "next": "14.2.35",
    "next-intl": "^4.9.1",
    "next-pwa": "^5.6.0",
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "@cloudflare/next-on-pages": "^1.13.16",
    "@types/bcryptjs": "^2.4.6",
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@vitejs/plugin-react": "^6.0.1",
    "eslint": "^8",
    "eslint-config-next": "14.2.35",
    "postcss": "^8",
    "sharp": "^0.34.5",
    "tailwindcss": "^3.4.1",
    "typescript": "^5",
    "vitest": "^4.1.4",
    "wrangler": "^4.83.0"
  }
}
```

### 7.4 `.npmrc`

```
legacy-peer-deps=true
```

(Set because `@cloudflare/next-on-pages@1.13.16` declares a peer of Next 14.3–15.5.2, but the project pins `next@14.2.35`.)

### 7.5 `tsconfig.json`

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## 8. Server Actions inventory (52 actions)

The real mutation surface. Every action is `'use server'`, returns `{ success: true, ... }` or `{ success: false, error }`, and runs its own role/tenant gate before DB writes.

### 8.1 `src/app/(auth)/login/action.ts`
**DELETED in Phase A commit 755e5b8** — login/logout moved to `/api/auth/login` and `/api/auth/logout`.

### 8.2 `src/app/(setup)/setup/actions.ts` (4)
| Function | Line | Inputs |
|---|---|---|
| `changePasswordAction` | 77 | `(userId, currentPassword, newPassword)` |
| `saveCompanyAction` | 138 | `(tenantId, CompanyPayload)` — name/phone/address/taxId/logoBase64/logoFileName |
| `saveBusinessAction` | 184 | `(tenantId, BusinessPayload)` — equipmentLabelHe/Ar, types[] |
| `savePricingAction` | 240 | `(tenantId, PricingPayload)` — 5 rates |
| `completeSetup` | (exported) | `(tenantId)` — sets `is_setup_complete = 1` |

### 8.3 `src/app/(dashboard)/settings/actions.ts` (13)
| Function | Line | Gate | Note |
|---|---|---|---|
| `updateCompanyAction` | 89 | owner | Logo base64 handling |
| `updatePricingAction` | 153 | owner | |
| `updateEquipmentLabelAction` | 193 | owner | |
| `addEquipmentTypeAction` | 223 | owner | |
| `updateEquipmentTypeAction` | 253 | owner | |
| `deleteEquipmentTypeAction` | 285 | owner | |
| `addUserAction` | 350 | owner | **Always sets `must_change_password = 1`** |
| `updateUserAction` | 399 | owner | Updates fullName/phone/email/role only — does NOT touch must_change_password |
| `toggleUserAction` | 445 | owner | Flips `is_active`; self-protection |
| `addClientAction` | 499 | owner | |
| `updateClientAction` | 534 | owner | |
| `toggleClientAction` | 578 | owner | |
| `resetPasswordAction` | 604 | owner | Sets new password AND re-enables `must_change_password = 1` |

**No action to clear `must_change_password`** anywhere. Only `changePasswordAction` in setup/actions.ts clears it (line 111), and only as part of a self-service flow that requires the old password.

### 8.4 `src/app/(dashboard)/equipment/actions.ts` (3)
`addEquipmentAction` (81), `updateEquipmentAction` (118), `updateEquipmentStatusAction` (162). Gate: owner+manager.

### 8.5 `src/app/(dashboard)/vehicles/actions.ts` (3)
`addVehicleAction` (67), `updateVehicleAction` (101), `toggleVehicleAction` (142). Gate: owner+manager.

### 8.6 `src/app/(dashboard)/workers/actions.ts` (3)
`addWorkerAction` (54), `updateWorkerAction` (90), `toggleWorkerAction` (133). Gate: owner+manager.

### 8.7 `src/app/(dashboard)/daily-log/actions.ts` (3)
`addDailyLogAction` (135), `updateDailyLogAction` (180), `confirmLogAction` (238). Gate: owner+manager+operator. Operator restricted to their own logs (`created_by === auth.userId`).

### 8.8 `src/app/(dashboard)/fuel/actions.ts` (3)
`addFuelAction` (83), `updateFuelAction` (129), `deleteFuelAction` (177). Gate: owner+manager+operator.

### 8.9 `src/app/(dashboard)/expenses/actions.ts` (3)
`addExpenseAction` (116), `updateExpenseAction` (161), `deleteExpenseAction` (208). Gate: owner+manager+operator.

### 8.10 `src/app/(dashboard)/invoices/actions.ts` (4)
`searchLogsForInvoiceAction` (145), `generateInvoiceAction` (183), `updateInvoiceStatusAction` (326), `recordPaymentAction` (389). Gate: owner+accountant.

### 8.11 `src/app/(dashboard)/budget/actions.ts` (1)
`saveBudgetAction` (46) — upsert entire year/month via DELETE+batch(INSERT). Gate: owner+accountant.

### 8.12 `src/app/(dashboard)/finance/actions.ts` (14 + 6 shared)
| Function | Line |
|---|---|
| `addBankAccount` | 269 |
| `updateBankAccount` | 318 |
| `toggleBankAccount` | 370 |
| `addCreditCard` | 406 |
| `updateCreditCard` | 449 |
| `toggleCreditCard` | 496 |
| `addCheckAction` | 611 |
| `updateCheckAction` | 651 |
| `addStandingOrderAction` | 846 |
| `updateStandingOrderAction` | 883 |
| `addTransactionAction` | 1005 |
| `updateTransactionAction` | 1045 |
| `addDebtAction` | 1110 |
| `updateDebtAction` | 1155 |
| `createReconciliationAction` | 1228 |
| `updateReconciliationStatusAction` | 1284 |
| `addDebtPaymentAction` | 1312 |
| `deleteTransactionAction` | 1373 |
| `toggleStandingOrderAction` | 1396 |
| `updateCheckStatusAction` | 1417 |

Gate: owner+accountant (`requireFinanceRole`).

### 8.13 `src/app/(dashboard)/help/actions.ts` (1)
`resetSetupAction` (8) — owner only; sets `is_setup_complete = 0` and redirects to `/setup`. Data preserved.

### 8.14 How Server Actions are invoked

- **NOT** via `fetch` with JSON.
- **YES** via Next.js RSC flight protocol: `<form action={actionFn}>` or imported and called from a `'use client'` component.
- From a test script outside the browser, Server Actions are **not** reliably callable — they need the action-ID header that Next emits on page render. For automation, use the DB directly (wrangler D1 SQL) or drive the UI.

---

## 9. Testing harness (`tests/`)

Separate project at `C:\smart-management\tests\` with its own `package.json`:
- **Playwright** (E2E) + **Vitest** (API/unit)
- Config: `tests/playwright.config.ts`, `tests/vitest.config.ts`, `tests/tsconfig.json`
- Scripts: `npm run test | test:api | test:security | setup | teardown | check | users:create | users:verify | users:reset`
- Utilities in `tests/utils/` (api-client, auth-helpers, role-client, assertions, cleanup, config)
- Fixtures in `tests/fixtures/` (users, seed-data, payloads including XSS/SQLi)
- Does not modify the main project `package.json`.

---

## 10. Critical facts for automation

1. **No user-management API routes exist** — only `/api/auth/login`, `/api/auth/logout`, `/api/health`. User CRUD is Server-Actions-only.
2. **Server Actions cannot be invoked from plain fetch scripts** — they require the Next.js RSC flight protocol. Use wrangler D1 SQL or Playwright UI automation for test bootstrapping.
3. **`must_change_password = 0` has no admin path** — can only be cleared by the user themselves in the change-password flow. Test users must either (a) be inserted via raw SQL with `must_change_password = 0`, or (b) go through the change-password UI.
4. **Tenant is hardcoded to `'default'`** via `getTenantId()` in `src/lib/db/index.ts`. The schema supports multi-tenancy but the app has single-tenant behavior.
5. **Edge runtime everywhere** — all dashboard/setup pages + layouts declare `runtime = 'edge'`. Login page is `'use client'` (no runtime declaration). Middleware is always Edge. The webpack `IgnorePlugin` stubs `better-sqlite3` / `bindings` / `file-uri-to-path` in edge builds.
6. **D1 `.bind()` throws on zero args** — the adapter's `prepare()` helper skips `.bind()` when `params.length === 0`.
7. **D1 `.all()` returns `{ results, success, meta }`** — the adapter's `toArray()` defensively handles bare arrays and missing `.results` too.

---

_End of PROJECT_MAP.md_
