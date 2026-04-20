# יומן שינויים

כל השינויים המשמעותיים למערכת מתועדים בקובץ הזה. המיפוי הוא לפי semver (`MAJOR.MINOR.PATCH`).

---

## [1.0.0] — 2026-04-20

שחרור ראשון של המערכת. 12 sprints, ~65 Server Actions, 27 טבלאות DB, 12 מודולים פונקציונליים. כיסוי מלא של תחומי ERP: לקוחות, ציוד, רכבים, עובדים, יומן עבודה, חשבוניות, תקציב, כספים, דוחות.

### Sprint 1 — Foundation & Auth

- סקאפולד של Next.js 14 App Router + TypeScript + Tailwind CSS.
- Schema ראשוני: `tenants`, `users`, `settings`, `clients`.
- JWT auth (`jose`) + password hashing (`bcryptjs` 12 rounds).
- Middleware לאימות JWT + injection של `x-user-*` headers.
- `/login` page עם `loginAction` ו-`logoutAction`.
- Route groups: `(auth)`, `(setup)`, `(dashboard)`.
- RTL + Hebrew fonts (Heebo) ב-`app/layout.tsx`.

### Sprint 2 — Setup Wizard & RBAC

- אשף הגדרות ראשוני ב-5 שלבים: סיסמה, חברה, עסק, תמחור, ציוד.
- `must_change_password` flow.
- RBAC: 5 תפקידים (`owner`, `manager`, `accountant`, `operator`, `viewer`) × 11 הרשאות.
- `hasPermission` + `requirePermission` ב-`lib/auth/rbac.ts`.
- Page-level gates ב-layouts של קבוצות routes.
- Action-level gates: `requireOwner`, `requireRole(...)`, `requireWriter`, `requireFinanceRole`.

### Sprint 3 — Equipment & Vehicles

- Schema: `equipment_types`, `equipment`, `vehicles`.
- CRUD מלא לשני המודולים (add/update/toggle).
- Status field ל-equipment (active/maintenance/inactive).
- תאריכי טסט/רישיון/ביטוח לרכבים.
- `getExpiryAlerts` utility (`React.cache()`) — 30 ימים קדימה.

### Sprint 4 — Workers & Daily Log

- Schema: `workers`, `daily_logs`, `worker_assignments`.
- יומן עבודה — הליבה של המערכת.
- שיבוץ עובדים (N workers per log).
- Operator-ownership: operator רואה/עורך רק את הרישומים שלו.
- Status flow: draft → confirmed (confirm = freeze הרישום).

### Sprint 5 — Fuel & Expenses

- Schema: `fuel_records`, `expenses`.
- CRUD לתדלוקים (עם odometer + ליטרים + עלות).
- Expenses כלליות עם קטגוריות + FK אופציונלי ל-vehicle/equipment/worker.

### Sprint 6 — Invoices

- Schema: `invoices`, `invoice_items`.
- Two-step flow: `searchLogsForInvoiceAction` → `GenerateInvoiceModal` → `generateInvoiceAction`.
- מסמן logs מאושרים כ-`invoiced=1` כדי שלא יופיעו שוב.
- Print-friendly invoice page עם `@media print` CSS (לא jsPDF — בעיות RTL).
- Payment tracking: `recordPaymentAction`, `updateInvoiceStatusAction`.

### Sprint 7 — Budget

- Schema: `budgets`, `budget_alerts`.
- יעדים חודשיים ושנתיים לפי קטגוריות.
- Monthly view + Yearly view (pivot table).
- `getActualAmounts` + `getMonthlyActualsForYear` utilities.
- הפרדת `budget-types.ts` מ-`budget-calculations.ts` — client components יכולים לייבא types בלי לגרור better-sqlite3.

### Sprint 8 — Finance (חלק 1)

- Schema: `bank_accounts`, `credit_cards`, `standing_orders`, `checks`.
- דפים: `/finance/accounts`, `/finance/credit-cards`, `/finance/standing-orders`, `/finance/checks`.
- Toggle + CRUD לכל ישות.
- הוראות קבע — ייצור אוטומטי של transactions בזמן הרצה (לא cron).

### Sprint 9 — Finance (חלק 2)

- Schema: `financial_transactions`, `debts`, `debt_payments`, `bank_reconciliations`, `reconciliation_items`.
- דפים: `/finance/transactions`, `/finance/debts`, `/finance/reconciliation`.
- תנועות ידניות + התאמת בנק (draft → final).
- מעקב חובות עם תשלומים חלקיים.
- `/finance/cash-flow` — תחזית 90 יום (`getCashFlowProjection` cached utility).

### Sprint 10 — Reports

- 6 דוחות: `/reports`, `/reports/profit-loss`, `/reports/accountant`, `/reports/fuel`, `/reports/workers`, `/reports/budget`.
- Cached utilities: `getProfitLossData`, `getAccountantReportData`, `getFuelReportData`, `getWorkersReportData`, `getCompanyInfo`.
- Print-friendly לכל דוח (CSS `@media print`, לא PDF library).
- דוח רואה-חשבון עם ניתוח קטגוריות + מס.

### Sprint 11 — PWA & Polish

- `next-pwa` integration: `manifest.json`, service worker אוטומטי, `offline.html`.
- `scripts/generate-pwa-icons.mjs` — יוצר 3 PNG מ-SVG (`sharp`).
- Middleware bypass ל-`/manifest.json`, `/offline.html`, `/sw.js`, `/icons/*`, `/workbox-*`.
- Loading states (`loading.tsx`) + Error boundaries.
- RTL polish בטבלאות, dropdowns, modals.
- Help page + FAQ + Reset Setup (owner-only).

### Sprint 12 — Multi-tenancy & Hardening

- כל הטבלאות קיבלו `tenant_id` (חוץ מ-`tenants` עצמה).
- Tenant isolation: כל action בודק `auth.tenantId === tenantId`.
- `assertBelongsToTenant(tenantId, table, id)` לאימות FK-ים.
- Audit log (`audit_log` table) — מתעד login, logout, mutations רגישות.
- Unit tests ב-Vitest: `password.test.ts`, `rbac.test.ts`, `jwt.test.ts`.
- תיעוד מלא (`docs/` directory — הקובץ הזה).

---

## בעיות ידועות / TODO לאחר v1.0.0

- **Cloudflare D1 adapter** — `src/lib/db/index.ts` כרגע better-sqlite3 בלבד. נדרש adapter layer ל-production.
- **Background sync** — יומן עבודה offline עדיין לא נתמך (mutations דורשות רשת).
- **Push notifications** — לא מוטמעות. מועמד טוב: alerts על תפוגות רישיונות.
- **Mobile-specific UI** — עובד במובייל, אבל לא מותאם אישית (כל הטבלאות scroll אופקי).
- **Bulk imports** — אין ייבוא CSV של עובדים/ציוד. נדרש לחברות עם עשרות פריטים.
- **Internationalization** — `next-intl` בתלויות אך לא בשימוש. היום רק עברית.

---

## Changelog format

- `[VERSION] — YYYY-MM-DD` לכל שחרור.
- סדר: `Added` / `Changed` / `Fixed` / `Removed` / `Security` במקום שרלוונטי.
- בגרסה הראשונה שילבנו הכל תחת Sprints 1-12 במקום קטגוריות, כי הכל Added.
