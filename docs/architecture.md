# ארכיטקטורה

## Tech Stack

| שכבה | טכנולוגיה |
|------|----------|
| Framework | Next.js 14.2 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 3 |
| Database (dev) | better-sqlite3 (מקומי, קובץ) |
| Database (prod) | Cloudflare D1 (SQLite compatible) — מוטמע, ראה [cloudflare-migration.md](cloudflare-migration.md) |
| Auth | jose (JWT) + bcryptjs (hashing) |
| Testing | Vitest (יחידה) |
| PWA | next-pwa (Service Worker + manifest) |
| Icons build | sharp (SVG → PNG) |

**Server runtime** (local dev): Node.js עם better-sqlite3. Middleware רץ ב-Edge (רק verify JWT).
**Server runtime** (production CF Pages): Workers/Edge עם D1 — `@cloudflare/next-on-pages` + `nodejs_compat` compatibility flag ממירים את ה-Node runtime פונקציות אוטומטית.

## Database Layer (SmartDb)

המערכת חשופה לקוד ה-application דרך ממשק אחיד בשם `SmartDb` (מוגדר ב-[src/lib/db/types.ts](../src/lib/db/types.ts)). ה-adapter הנכון נבחר לפי `NODE_ENV`:

```
Application (48 call sites) ──┐
                              │ db.query / queryOne / run / batch / exec
                              ▼
                       SmartDb interface
                              │
             ┌────────────────┴────────────────┐
             ▼                                 ▼
    SqliteSmartDb                         D1SmartDb
   (sqlite-adapter.ts)                 (d1-adapter.ts)
   better-sqlite3                   Cloudflare D1 via
   → data/dev.db (dev)              getRequestContext()
                                    → env.DB (prod)
```

### SmartDb methods

| Method | תיאור |
|--------|-------|
| `query<T>(sql, params?)` | SELECT → `Promise<T[]>` |
| `queryOne<T>(sql, params?)` | SELECT של שורה יחידה → `Promise<T \| null>` |
| `run(sql, params?)` | INSERT/UPDATE/DELETE → `Promise<{changes, lastInsertRowid}>` |
| `batch(statements)` | רשימת `{sql, params}` מבוצעים אטומית — מחליף transactions ל-D1 |
| `exec(sql)` | SQL גולמי (ל-migrations) |

דוגמה:
```ts
const db = getDb();
const rows = await db.query<{ id: string; name: string }>(
  'SELECT id, name FROM clients WHERE tenant_id = ? AND is_active = 1',
  [tenantId],
);

await db.batch([
  { sql: 'INSERT INTO daily_logs (...) VALUES (?, ...)', params: [...] },
  { sql: 'INSERT INTO worker_assignments (...) VALUES (?, ...)', params: [...] },
]);
```

### `getDb()` — בחירת ה-adapter

הפונקציה משתמשת ב-`require()` בתוך ענפי `if (NODE_ENV === 'production')` כדי שh-webpack ימחק את ה-adapter הלא-רלוונטי ב-tree-shaking. ב-dev — רק SqliteSmartDb ב-bundle. ב-prod — רק D1SmartDb. `better-sqlite3` (native) לעולם לא נכנס ל-bundle של production.

### `generateId()` — IDs ידידותיים ל-Edge

[src/lib/utils/id.ts](../src/lib/utils/id.ts) מגדיר:
```ts
export function generateId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}
```

`crypto` הוא global ב-Node 19+, Cloudflare Workers, וכל Edge runtime. מחזיר 32 תווי hex (128 bits מ-UUID v4 בלי מקפים) — תואם למה ש-`randomBytes(16).toString('hex')` החזיר לפני ההעברה.

## מבנה תיקיות

```
src/
├── app/                         # Next.js App Router
│   ├── layout.tsx               # Root layout — <html lang="he" dir="rtl">, fonts, metadata
│   ├── not-found.tsx            # עמוד 404 מותאם אישית
│   ├── globals.css              # Tailwind directives + body font
│   ├── (auth)/                  # route group — אימות
│   │   ├── layout.tsx           # רקע כהה, ממורכז
│   │   └── login/
│   │       ├── page.tsx         # דף הכניסה
│   │       └── action.ts        # loginAction + logoutAction
│   ├── (setup)/                 # route group — אשף הגדרות ראשוני
│   │   ├── layout.tsx           # אימות סשן
│   │   ├── setup-context.tsx    # SetupProvider + useSetupSession
│   │   └── setup/
│   │       ├── page.tsx         # Wizard 5 שלבים
│   │       ├── actions.ts       # 5 setup actions
│   │       └── steps/           # Step1..Step5 components
│   └── (dashboard)/             # route group — כל הדפים הפנימיים
│       ├── layout.tsx           # קורא headers, מושך settings, מרכיב Sidebar+Header
│       ├── page.tsx             # Dashboard ראשי
│       ├── loading.tsx          # Loading state
│       ├── daily-log/           # יומן עבודה
│       ├── equipment/
│       ├── vehicles/
│       ├── workers/
│       ├── fuel/
│       ├── expenses/
│       ├── invoices/
│       ├── budget/
│       ├── finance/             # 8 sub-routes
│       ├── reports/             # 6 תת-דוחות
│       ├── settings/            # 5 תת-דפים
│       └── help/
├── components/
│   ├── layout/                  # Sidebar, Header, sidebar-state
│   └── ui/                      # AlertsBanner, LoadingSpinner
├── lib/
│   ├── auth/                    # jwt.ts, password.ts, session.ts, rbac.ts
│   ├── db/                      # index.ts (DB adapter), schema.sql, migrate.ts, generate-hash.ts
│   └── utils/                   # cached helpers — expiry-alerts, dashboard-stats, budget-calculations, etc.
└── middleware.ts                # JWT verification + x-user-* headers injection
```

**Route groups** — סוגריים `(...)` לא משפיעים על ה-URL. הם משמשים רק לקבוצת route עם layout משותף:
- `(auth)/login` → `/login`
- `(setup)/setup` → `/setup`
- `(dashboard)/daily-log` → `/daily-log`

## זרימת בקשה

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────────┐
│ Next.js Middleware (middleware.ts)      │
│ - קורא cookie: auth-token               │
│ - verifyToken (jose, HS256)             │
│ - לא תקין → redirect /login             │
│ - תקין → מזריק headers:                  │
│     x-user-id                           │
│     x-user-role                         │
│     x-user-username                     │
│     x-tenant-id                         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Server Component (page.tsx)             │
│ - headers().get('x-user-role')          │
│ - hasPermission(role, 'xxx') → redirect?│
│ - מושך DB: getDb().prepare(...).all()   │
│ - מרכיב props ל-Client Component        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Client Component (FooManager.tsx)       │
│ 'use client'                            │
│ - state (useState), filters (useMemo)   │
│ - Modals, forms                         │
│ - onClick → קורא ל-Server Action        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Server Action (actions.ts)              │
│ 'use server'                            │
│ - requireRole / requireOwner            │
│ - validation                            │
│ - DB mutation (עם transaction במקרה הצורך) │
│ - מחזיר {success: true/false}           │
└──────────────┬──────────────────────────┘
               │
               ▼
   Client עושה router.refresh() לעדכון
```

## Server Components vs Client Components

### Server Components (default)

**מאפיינים**:
- רצים רק על השרת, ה-HTML מגיע ללקוח מוכן.
- יכולים לגשת ישירות ל-DB, קבצים, וסביבת השרת.
- לא יכולים להשתמש ב-hooks (`useState`, `useEffect`), event handlers או browser APIs.
- ה-bundle של הלקוח לא כולל אותם → JS קטן יותר.

**מתי**: כל דף שמושך נתונים מ-DB. כמעט כל `page.tsx` במערכת.

**דוגמה**: `app/(dashboard)/daily-log/page.tsx` — קורא headers, מושך logs+assignments+clients+equipment+vehicles+workers, ומעביר ל-`DailyLogManager`.

### Client Components (`'use client'`)

**מאפיינים**:
- רצים בדפדפן עם React רגיל.
- יכולים להשתמש ב-hooks, event handlers, localStorage, window APIs.
- חייבים לקבל כל הנתונים כ-props (אי אפשר לגשת ישירות ל-DB).

**מתי**:
- אינטראקטיביות (forms, modals, dropdowns).
- state מקומי (filters, view toggles).
- Hebrew-aware components (AlertsBanner — dismissal state).
- כל קובץ `FooManager.tsx`, `FooForm.tsx`, וכו'.

**דוגמה**: `app/(dashboard)/daily-log/DailyLogManager.tsx` — מקבל את כל הנתונים כ-props מה-page, מציג טבלה + modals, קורא ל-Server Actions על submit.

### הגבלה חשובה

Client Component **לא יכול לייבא** מקובץ ש-transitively משתמש ב-`node:fs`/`node:path`/better-sqlite3. לכן:
- `budget-types.ts` מופרד מ-`budget-calculations.ts` — הראשון types בלבד, השני מכיל DB.
- ה-Client משתמש ב-`budget-types`, השרת ב-`budget-calculations`.

## Server Actions

כל mutation במערכת עוברת דרך Server Action — קבצים עם `'use server'` בראש.

**יתרונות**:
- אין endpoints ידניים (`/api/...`) — פונקציות נקראות ישירות מה-Client.
- Type safety מלא — הפרמטרים והתוצאה TypeScript end-to-end.
- Next.js מטפל ב-serialization והעברת הנתונים.

**מבנה טיפוסי של action**:

```ts
'use server';

export async function addSomethingAction(
  tenantId: string,
  data: SomethingPayload,
): Promise<SomethingMutationResult> {
  // 1. אימות תפקיד
  const auth = await requireRole(['owner', 'manager']);
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) return { success: false, error: 'אין הרשאה' };

  // 2. Validation
  const cleanField = data.field?.trim() ?? '';
  if (!cleanField) return { success: false, error: 'שדה חובה' };

  // 3. (אופציונלי) אימות foreign keys שייכים ל-tenant
  if (!(await belongsToTenant(tenantId, data.fkId))) {
    return { success: false, error: 'ID לא חוקי' };
  }

  // 4. Transaction אם יש יותר מפעולה אחת
  const db = getDb();
  await db.exec('BEGIN');
  try {
    // INSERT / UPDATE / DELETE
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }

  return { success: true };
}
```

Ref מלא: [api-actions.md](api-actions.md).

## Routing — Route Groups

Next.js 14 App Router משתמש ב-file-system routing:
- `app/foo/page.tsx` → `/foo`
- `app/foo/[id]/page.tsx` → `/foo/:id`
- `app/(group)/foo/page.tsx` → `/foo` (ה-group לא בנתיב)

**השימוש ב-groups במערכת**:
- `(auth)` — עמוד login עם layout כהה ממורכז
- `(setup)` — אשף הגדרות עם context provider
- `(dashboard)` — כל הדפים הפנימיים, מוגנים על ידי layout שבודק headers

ל-route groups יכולים להיות גם `layout.tsx` משל עצמם. `(dashboard)/layout.tsx` הוא הלב של ה-UI הפנימי — Sidebar + Header + main content.

## React.cache() — Server-side Deduplication

`React.cache()` ממוחשב request-level. כל הקריאות לאותה פונקציה עם אותם פרמטרים במהלך render יחיד מחזירות את אותה התוצאה.

**השימושים במערכת**:

| פונקציה | קובץ | איפה נקראת |
|---------|------|------------|
| `getExpiryAlerts` | lib/utils/expiry-alerts.ts | dashboard/layout + dashboard/page + AlertsBanner |
| `getDashboardStats` | lib/utils/dashboard-stats.ts | dashboard/page |
| `getRecentActivity` | lib/utils/dashboard-stats.ts | dashboard/page |
| `getActualAmounts` | lib/utils/budget-calculations.ts | budget + report-calculations |
| `getMonthlyActualsForYear` | lib/utils/budget-calculations.ts | budget (yearly view) + budget-report |
| `getCashFlowProjection` | lib/utils/cash-flow-calculations.ts | finance/cash-flow |
| `getProfitLossData` | lib/utils/report-calculations.ts | reports/ + reports/accountant |
| `getAccountantReportData` | lib/utils/report-calculations.ts | reports/accountant |
| `getFuelReportData` | lib/utils/report-calculations.ts | reports/fuel |
| `getWorkersReportData` | lib/utils/report-calculations.ts | reports/workers |
| `getCompanyInfo` | lib/utils/company-info.ts | reports/* + invoices/[id] |

**דוגמה**: `getExpiryAlerts` נקראת פעמיים ב-request של dashboard (layout ל-alertsCount ב-Sidebar, page ל-AlertsBanner). בזכות `cache()` ה-query ל-DB רץ פעם אחת בלבד.

**הסיבה שזה שומר על ביצועים**: אין N+1 queries אפילו כשכמה components מבקשים את אותם הנתונים.
