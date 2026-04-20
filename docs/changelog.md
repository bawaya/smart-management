# יומן שינויים

כל השינויים המשמעותיים למערכת מתועדים בקובץ הזה. המיפוי הוא לפי semver (`MAJOR.MINOR.PATCH`).

---

## [1.1.0] — 2026-04-20 — Cloudflare Migration

העברה מ-better-sqlite3 (Node.js בלבד) ל-Cloudflare D1 (Edge-ready) דרך adapter משותף. בלי שינוי ב-UI, ב-business logic, או ב-schema. פרטים מלאים: [cloudflare-migration.md](cloudflare-migration.md).

### Phase A — Code Changes (6 commits)

- **Commit 1** — Cloudflare infrastructure: `wrangler.toml`, `SmartDb` interface, `SqliteSmartDb` + `D1SmartDb` adapters, `@cloudflare/next-on-pages` + `wrangler` dev deps, `pages:*` npm scripts, `setupDevPlatform` ב-next.config.
- **Commit 2** — Transactions → `batch()`: החלפת 8 מקומות `BEGIN/COMMIT/ROLLBACK` ב-`db.batch([...])` (daily-log, budget, invoices, finance). הוספת pre-checks ב-SELECT איפה שנדרש לוודא רשומה קיימת לפני UPDATE.
- **Commit 3** — לוגו → base64: ניתוב `node:fs` → שני settings חדשים (`company_logo_base64`, `company_logo_mime`). schema seed נגע (18 → 20 שורות settings).
- **Commit 4** — API migration: ~193 call sites מ-`prepare().bind().all/first/run()` ל-`db.query/queryOne/run`. הוסר `prepare()` + `Statement` מה-SmartDb interface. הרצה מקבילית של 4 subagents.
- **Commit 5** — Edge compat + docs: `node:crypto` `randomBytes` → Web Crypto `crypto.randomUUID()` (shared `src/lib/utils/id.ts`). `serverComponentsExternalPackages: ['better-sqlite3']` ב-next.config. `src/env.d.ts` עם `CloudflareEnv`. `README.md` עם פקודות ה-deploy.
- **Commit 6** — תיעוד + cleanup: מסמך זה, `cloudflare-migration.md`, עדכון architecture.md.

### מה לא נעשה (נדרש לפני production)

- **לא רץ `@cloudflare/next-on-pages` build** — ה-CLI לא עובד ב-Windows native (issue ידוע). הפעלה נדרשת על Linux/macOS/WSL.
- **לא רץ `wrangler d1 create`** — דורש אישור חשבון Cloudflare של המשתמש.
- **לא הוגדר JWT_SECRET ב-Pages secrets** — דורש אישור משתמש.

אלו שלבי Phase B — מפורטים ב-README וב-cloudflare-migration.md.

### Verified

- `npm run build`: green
- `npx tsc --noEmit`: clean
- `npx vitest run`: 127/127

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
