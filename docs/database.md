# בסיס הנתונים

הסכימה המלאה ב-[src/lib/db/schema.sql](../src/lib/db/schema.sql). 27 טבלאות + 1 VIEW, SQLite compatible (פועל גם על better-sqlite3 וגם על Cloudflare D1).

## הפעלת Migration

```bash
npx tsx src/lib/db/migrate.ts
```

הסקריפט מוחק את `data/dev.db` הקיים (אם יש), יוצר מחדש מ-schema.sql, ומאמת את ה-seed data.

**פלט צפוי**: 27 טבלאות + 1 view + tenant ברירת מחדל + משתמש admin + 18 שורות settings.

## Multi-tenancy

כל הטבלאות הבסיסיות (פרט ל-`tenants` עצמה) כוללות `tenant_id TEXT NOT NULL REFERENCES tenants(id)`. זה מכין את המערכת ל-SaaS עתידי: tenant לכל לקוח, הפרדה מלאה בנתונים.

כרגע יש tenant יחיד עם `id='default'`. ה-utility `getTenantId()` ב-[lib/db/index.ts](../src/lib/db/index.ts) מחזיר `'default'` — בעתיד יחזיר מתוך ה-JWT.

**כל Server Action** מאמת ש-`tenantId` ב-parameter שווה ל-`tenantId` ב-JWT (`auth.tenantId !== tenantId` → return error). זה מונע cross-tenant attacks.

## טבלאות — רשימה מקובצת

### ליבה — Tenants & Users

**tenants** — חברות (tenants) במערכת.
- שדות: `id`, `name`, `slug`, `logo_path`, `is_active`, `is_setup_complete`
- כרגע תמיד 'default' — בעתיד tenant לכל לקוח SaaS.

**users** — משתמשים.
- שדות: `id`, `tenant_id`, `username`, `email`, `password_hash`, `full_name`, `phone`, `role`, `is_active`, `must_change_password`
- CHECK: `role IN ('owner','manager','accountant','operator','viewer')`
- UNIQUE: `(tenant_id, username)`
- אינדקסים: `idx_users_tenant`

### משאבים — Equipment, Vehicles, Workers, Clients

**clients** — חברות/לקוחות שמולם עובדים.
- שדות: `name`, `contact_person`, `phone`, `email`, `address`, `tax_id`, `equipment_daily_rate?`, `worker_daily_rate?`, `notes`
- תעריפים NULL = משתמש ב-defaults מ-settings.

**equipment_types** — סוגי ציוד דינמיים לכל tenant.
- שדות: `name_ar`, `name_he`, `description`, `sort_order`, `is_active`
- מוגדרים באשף ההגדרות.

**equipment** — פריטי ציוד.
- שדות: `name`, `equipment_type_id FK`, `identifier`, `status`, `insurance_expiry`, `license_expiry`, `last_maintenance`, `notes`
- CHECK status: `'available','deployed','maintenance','retired'`

**vehicles** — רכבים.
- שדות: `name`, `license_plate`, `type`, `insurance_expiry`, `license_expiry`, `annual_insurance_cost`, `annual_license_cost`, `notes`
- CHECK type: `'owned','rented'`

**workers** — עובדים.
- שדות: `full_name`, `id_number`, `phone`, `daily_rate?`, `notes`
- UNIQUE: `(tenant_id, id_number)` — מאפשר NULL (מספר עובדים בלי ת.ז).

### פעילות יומית — Daily Log

**daily_logs** — כל יום עבודה.
- שדות: `log_date`, `client_id FK`, `equipment_id FK`, `vehicle_id? FK`, `location`, `project_name`, `equipment_revenue`, `notes`, `status`, `created_by FK`
- CHECK status: `'draft','confirmed','invoiced'`
- אינדקסים: tenant + date + client + status

**worker_assignments** — עובדים ביום עבודה ספציפי.
- שדות: `daily_log_id FK ON DELETE CASCADE`, `worker_id FK`, `daily_rate` (עלות), `revenue` (הכנסה מלקוח), `notes`

### הוצאות ומימון

**fuel_records** — תדלוקים.
- שדות: `record_date`, `vehicle_id FK`, `liters`, `price_per_liter`, `total_cost`, `odometer_reading?`, `station_name?`, `receipt_ref?`, `payment_method`, `credit_card_id? FK`, `notes`
- CHECK payment_method: `'cash','credit_card','bank_transfer'`

**expenses** — הוצאות כלליות.
- שדות: `expense_date`, `category`, `amount`, `description`, `vehicle_id?`, `equipment_id?`, `worker_id?`, `payment_method`, `credit_card_id?`, `check_id?`, `bank_account_id?`, `receipt_ref`, `notes`, `created_by FK`
- CHECK category: 11 ערכים — fuel, vehicle_insurance, vehicle_license, vehicle_maintenance, vehicle_rental, equipment_maintenance, worker_payment, office, phone, internet, other

### חשבוניות

**invoices** — חשבוניות חודשיות.
- שדות: `invoice_number`, `client_id FK`, `period_start`, `period_end`, `total_equipment_days`, `total_equipment_revenue`, `total_worker_days`, `total_worker_revenue`, `subtotal`, `vat_rate`, `vat_amount`, `total`, `status`, `payment_due_date?`, `paid_amount?`, `paid_date?`, `notes`
- CHECK status: `'draft','sent','paid','partial','cancelled'`
- UNIQUE: `(tenant_id, invoice_number)`

**invoice_items** — שורות חשבונית.
- שדות: `invoice_id FK ON DELETE CASCADE`, `daily_log_id FK`, `item_type`, `description`, `quantity`, `unit_price`, `total`
- CHECK item_type: `'equipment','worker'`

### תקציב

**budgets** — ערכי תקציב מתוכננים.
- שדות: `budget_year`, `budget_month?` (NULL = שנתי), `category`, `planned_amount`, `notes`, `created_by FK`
- CHECK category: 14 ערכים — income_equipment, income_workers, income_other, expense_*
- UNIQUE: `(tenant_id, budget_year, budget_month, category)`

**budget_alerts** — התראות חריגה (עתידי, כרגע לא בשימוש פעיל).

### חשבונות פיננסיים

**bank_accounts** — חשבונות בנק.
- שדות: `bank_name`, `branch_number`, `account_number`, `account_name`, `account_type`, `currency`, `current_balance`, `is_primary`, `notes`

**credit_cards** — כרטיסי אשראי.
- שדות: `bank_account_id FK`, `card_name`, `last_four_digits`, `card_type`, `credit_limit`, `billing_day` (1-31), `closing_day` (1-31), `current_balance`, `notes`

**standing_orders** — הוראות קבע.
- שדות: `bank_account_id FK`, `payee_name`, `amount`, `frequency`, `day_of_month?`, `category`, `description`, `start_date`, `end_date?`, `last_executed?`, `next_execution?`, `notes`
- CHECK frequency: `'weekly','monthly','bimonthly','quarterly','yearly'`

**checks** — שיקים (נכנסים/יוצאים).
- שדות: `check_number`, `bank_account_id FK`, `direction`, `amount`, `payee_or_payer`, `issue_date`, `due_date`, `status`, `category?`, `description?`, `linked_invoice_id? FK`, `linked_expense_id? FK`, `bounce_reason?`, `notes`, `created_by FK`
- CHECK direction: `'incoming','outgoing'`
- CHECK status: `'pending','deposited','cleared','bounced','cancelled','post_dated'`

**financial_transactions** — כל תנועה כספית.
- שדות: 16 סוגי transaction_type (bank_deposit, credit_card_charge, check_incoming, invoice_payment, ...), `amount`, `direction` (in/out), קשרים אופציונליים ל-bank_accounts / credit_cards / checks / standing_orders / invoices / expenses, `counterparty`, `category`, `description`, `reference_number`, `is_reconciled`, `reconciled_at?`, `notes`, `created_by FK`

**debts** — חובות והלוואות.
- שדות: `debt_type`, `counterparty`, `counterparty_type`, `worker_id?`, `client_id?`, `original_amount`, `remaining_amount`, `issue_date`, `due_date?`, `description`, `status`, `notes`, `created_by FK`
- CHECK debt_type: `'owed_to_me','i_owe'`
- CHECK status: `'active','partial','paid','written_off'`

**debt_payments** — תשלומי חוב.
- שדות: `debt_id FK`, `payment_date`, `amount`, `payment_method`, `transaction_id? FK`, `notes`, `created_by FK`

**bank_reconciliations** — התאמות בנק.
- שדות: `bank_account_id FK`, `reconciliation_date`, `statement_balance`, `system_balance`, `difference`, `status`, `notes`, `reconciled_by FK`
- CHECK status: `'pending','matched','discrepancy','resolved'`

**reconciliation_items** — פריטי התאמה (עתידי, כרגע שמור).

### מערכת

**settings** — הגדרות key/value לכל tenant.
- PRIMARY KEY: `(tenant_id, key)`
- 18 מפתחות ב-seed: default_worker_daily_rate, default_equipment_daily_rate, client_worker_revenue, client_equipment_revenue, fuel_price_per_liter, vat_rate, company_name, company_phone, company_address, company_tax_id, company_logo_path, invoice_prefix, data_retention_months, low_balance_alert, budget_warning_threshold, equipment_label_ar, equipment_label_he, is_setup_complete

**audit_log** — לוג פעולות (עתידי, כרגע שמור).

**notifications** — התראות (עתידי, כרגע שמור).

### VIEW: daily_equipment_cost

חישוב עלות יומית של כל רכב — ממוצע דלק (3 חודשים) + ביטוח יומי (שנתי/365) + רישיון יומי + תחזוקה (3 חודשים). משמש בתקרירי "תמחור חכם".

## תרשים קשרים (ERD פשוט)

```
tenants (1)
   │
   ├── users (רב)
   │     └── created_by ב: daily_logs, invoices, expenses, fuel, checks, debts, ...
   │
   ├── clients (רב)
   │     ├── daily_logs (רב)
   │     ├── invoices (רב)
   │     └── debts (אופציונלי)
   │
   ├── equipment_types (רב)
   │     └── equipment (רב)
   │
   ├── equipment (רב) ──┐
   │                    ├── daily_logs (רב)
   │                    └── expenses (אופציונלי)
   │
   ├── vehicles (רב) ───┐
   │                    ├── daily_logs (אופציונלי)
   │                    ├── fuel_records (רב)
   │                    └── expenses (אופציונלי)
   │
   ├── workers (רב)
   │     ├── worker_assignments (רב)
   │     ├── expenses (אופציונלי)
   │     └── debts (אופציונלי)
   │
   ├── daily_logs (רב)
   │     ├── worker_assignments (רב, ON DELETE CASCADE)
   │     └── invoice_items (דרך FK)
   │
   ├── invoices (רב)
   │     └── invoice_items (רב, ON DELETE CASCADE)
   │
   ├── bank_accounts (רב)
   │     ├── credit_cards (רב)
   │     ├── standing_orders (רב)
   │     ├── checks (רב)
   │     ├── financial_transactions (אופציונלי)
   │     └── bank_reconciliations (רב)
   │
   ├── debts (רב)
   │     └── debt_payments (רב)
   │
   ├── budgets (רב)
   ├── financial_transactions (רב)
   ├── settings (key/value)
   ├── audit_log, notifications (עתידי)
```

## Seed Data

בסוף schema.sql יש 3 INSERT-ים:

1. **tenants** — `id='default'`, `name=''`, `is_setup_complete=0`.
2. **users** — `username='admin'`, `password_hash='PLACEHOLDER_HASH'` (מוחלף על ידי `generate-hash.ts`), `role='owner'`, `must_change_password=1`.
3. **settings** — 18 שורות עם ערכי default ריקים/אפס (מלבד VAT=17, budget_warning=80, equipment labels='מעدات'/'ציוד', invoice_prefix='INV', data_retention=24).

### generate-hash.ts

הסקריפט `src/lib/db/generate-hash.ts` מחליף את `'PLACEHOLDER_HASH'` ב-schema.sql ב-hash של `admin123` (bcrypt, 12 rounds). מריצים אותו פעם אחת בהתקנה ראשונה.

```bash
npx tsx src/lib/db/generate-hash.ts
```

אחרי הרצה, ה-script מסרב לרוץ שוב (לא מוצא את ה-PLACEHOLDER) — הגנה מפני דריסה.

## אינדקסים

לכל טבלה גדולה יש אינדקס על `tenant_id` (למיחד השאילתות לפי tenant). בנוסף:
- `daily_logs`: `log_date`, `client_id`, `status`.
- `fuel_records`: `record_date`, `vehicle_id`.
- `expenses`: `expense_date`, `category`.
- `checks`: `due_date`, `status`.
- `financial_transactions`: `transaction_date`, `transaction_type`, `is_reconciled`.
- `audit_log`: `(entity_type, entity_id)`.

## Foreign Key Behavior

רוב ה-FK-ים **בלי** `ON DELETE`, כלומר `NO ACTION` (ברירת מחדל) — SQLite דוחה DELETE שיגרום יתמות.

חריגים:
- `worker_assignments.daily_log_id` → `ON DELETE CASCADE` (מחיקת רישום מוחקת את שיוכי העובדים).
- `invoice_items.invoice_id` → `ON DELETE CASCADE`.
- `reconciliation_items.reconciliation_id` → `ON DELETE CASCADE`.

לכן, למשל, מחיקת סוג ציוד תיכשל אם יש ציוד שמצביע עליו — השגיאה נתפסת ב-actions ומוצגת למשתמש כ"לא ניתן למחוק — הסוג בשימוש".
