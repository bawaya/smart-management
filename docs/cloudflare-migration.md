# מדריך העברה ל-Cloudflare

המערכת עברה מ-better-sqlite3 (Node.js) ל-Cloudflare D1 (Edge) בשישה commits ב-Phase A. הקובץ הזה מסכם **מה** השתנה, **מה לא**, **איך** זה עובד בפועל, ו**איך** להריץ את ה-deploy (Phase B).

## מה השתנה

| שכבה | לפני | אחרי |
|------|------|------|
| Database (prod) | better-sqlite3 | Cloudflare D1 (דרך `SmartDb` adapter) |
| Transactions | `BEGIN`/`COMMIT`/`ROLLBACK` | `db.batch([...])` — 8 מקומות |
| אחסון לוגו | `node:fs` (`data/logos/`) | base64 ב-`settings` (`company_logo_base64` + `company_logo_mime`) |
| ייצור IDs | `node:crypto` `randomBytes` | `crypto.randomUUID()` (Web Crypto) — `src/lib/utils/id.ts` |
| DB API | `prepare(sql).bind(...).all/first/run()` | `query/queryOne/run/batch/exec` — ~193 קריאות |

## מה לא השתנה

- **UI** — כל ה-components והעיצוב זהים.
- **Business logic** — כל Server Action מחזיר את אותה תוצאה לאותו input.
- **Schema** — אותם 27 טבלאות + VIEW. נוספו שני settings חדשים (`company_logo_base64`, `company_logo_mime`), אבל schema רגיל אותו דבר.
- **RBAC** — 5 תפקידים × 11 הרשאות, אותו מטריצה.
- **JWT** — `jose` (HS256) ממשיך כמו שהיה.
- **PWA** — manifest.json + service worker זהים.
- **Tests** — 127 בדיקות, אין שינוי. משתמשות ב-better-sqlite3 ישירות (לא ב-SmartDb).

## איך זה עובד

### שני adapters מאחורי ממשק אחד

```
Application code (48 call sites)
   │
   │  db.query / queryOne / run / batch / exec
   ▼
SmartDb interface  (src/lib/db/types.ts)
   │
   ├── dev  → SqliteSmartDb  (src/lib/db/sqlite-adapter.ts)
   │          better-sqlite3 → data/dev.db
   │
   └── prod → D1SmartDb      (src/lib/db/d1-adapter.ts)
              getRequestContext().env.DB → Cloudflare D1
```

### `getDb()` — ענף לפי `NODE_ENV`

```ts
export function getDb(): SmartDb {
  if (process.env.NODE_ENV === 'production') {
    // require → DCE-friendly, כדי שwebpack לא יכניס את sqlite-adapter ל-bundle
    const { createD1SmartDb } = require('./d1-adapter');
    return createD1SmartDb();
  }
  const { createSqliteSmartDb } = require('./sqlite-adapter');
  return createSqliteSmartDb();
}
```

**למה `require` ולא `import`?**
Next.js (Webpack) מחליף `process.env.NODE_ENV` ב-literal בזמן build. כש-`require` נמצא בתוך ענף `if (literal === 'production')`, ה-branch השני נהפך ל-dead code ונמחק (tree-shaking). כך:
- ב-build של dev: רק `sqlite-adapter.ts` בבאנדל. אין `@cloudflare/next-on-pages`.
- ב-build של prod: רק `d1-adapter.ts` בבאנדל. אין `better-sqlite3`.

בנוסף: ב-`next.config.mjs` הוגדר:
```js
experimental: {
  serverComponentsExternalPackages: ['better-sqlite3'],
}
```
כשכבה נוספת של הגנה — גם אם קוד כלשהו מייבא better-sqlite3 בטעות, הוא יסומן כ-external ולא ייכלל ב-bundle של ה-Edge.

### D1 transactions = `db.batch()`

ל-D1 אין `BEGIN`/`COMMIT`/`ROLLBACK` כמו SQLite רגיל — במקום זה יש `db.batch([stmt1, stmt2, ...])` שמבוצע אטומית.

שמונה מקומות עברו המרה:
- `daily-log/actions.ts` — 2 transactions (add + update יומן עם worker_assignments)
- `budget/actions.ts` — 1 transaction (DELETE ישן + INSERT חדש)
- `invoices/actions.ts` — 2 transactions (generate + cancel)
- `finance/actions.ts` — 3 transactions (bank account add/update + debt payment)

הערה על קריאה בתוך batch: `batch()` לא חושף תוצאות לכל statement. כשצריך לוודא שרשומה נמצאה לפני עדכון (`result.changes === 0`) — מבוצע `SELECT` ל-existence check **לפני** ה-batch. הדוגמא: `updateInvoiceStatusAction` cancel, `updateBankAccount`.

### לוגו → base64

קודם היה:
```
data/logos/<tenantId>.png → writeFile → הנתיב נשמר ב-settings('company_logo_path')
```

עכשיו:
```
Base64 string → UPDATE settings SET value = ? WHERE key = 'company_logo_base64'
MIME type     → UPDATE settings SET value = ? WHERE key = 'company_logo_mime'
```

`getCompanyInfo()` בונה `data:${mime};base64,${data}` URL — אותו חוזה API ל-consumers (חשבוניות, דוחות).

**מגבלה**: 2MB תמונה → ~2.67MB base64. עדיין בתוך מגבלת `bodySizeLimit: '5mb'` של Server Actions.

## שלבי Deploy (Phase B)

חייבים לרוץ על **Linux / macOS / WSL** — `@cloudflare/next-on-pages` CLI משוטר ב-Windows native.

```bash
# 1. התחברות ל-Cloudflare (OAuth בדפדפן)
wrangler login

# 2. יצירת D1 database
wrangler d1 create smart-management
# העתק את ה-database_id שמודפס → wrangler.toml
# החלף את "PLACEHOLDER_ID"

# 3. הרצת schema על ה-D1 המרוחק
wrangler d1 execute smart-management --file=src/lib/db/schema.sql --remote

# 4. הגדרת JWT_SECRET
wrangler pages secret put JWT_SECRET
# (יבקש ממך הדבק secret חדש — השתמש ב:
#  node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")

# 5. build באמצעות next-on-pages (Linux/macOS/WSL)
npx @cloudflare/next-on-pages

# 6. deploy
wrangler pages deploy .vercel/output/static
```

לאחר deploy, הגישה ל-URL שמודפס (`<project>.pages.dev`) — הדף הראשון יוביל ל-`/login`.

## הערות חשובות

### `nodejs_compat` compatibility flag

ב-`wrangler.toml`:
```toml
compatibility_flags = ["nodejs_compat"]
```

מאפשר:
- `Buffer` (בשימוש ב-settings/actions.ts לולידציה של גודל לוגו).
- `process.env` (ל-`JWT_SECRET`).
- חבילות JS-pure שמסתמכות על Node APIs (כמו `bcryptjs`).

**לא מאפשר**: modules native עם קבצי `.node` (זו הסיבה ש-better-sqlite3 מוחרג מה-bundle).

### אין `export const runtime = 'edge'`

ניסינו להוסיף — זה שבר את ה-build כי Webpack התחיל לאגד את better-sqlite3 ל-entry של Edge ונכשל ברזולוציה של `path`. ההסבר: `@cloudflare/next-on-pages` + `nodejs_compat` ממיר route-ים עם runtime=Node.js אוטומטית ל-Workers. אין צורך להצהיר על runtime=edge ב-page-level.

ה-middleware הוא חריג — הוא רץ ב-Edge בכל מקרה (זה default של Next), משתמש ב-`jose` (edge-compatible) ולא ניגש ל-DB.

### אילו מודולים בטוחים ב-runtime?

- `bcryptjs` — pure JS, עובד ב-Workers ✓
- `jose` — edge-compatible מעצם הגדרה ✓
- `next-pwa` — build-time בלבד (יוצר `sw.js`, לא רץ ב-server) ✓
- `sharp` — build-time בלבד (icons generation), לא ב-runtime path ✓
- `better-sqlite3` — **לא בטוח**; מוחרג דרך `serverComponentsExternalPackages` + `getDb()` branching ✓

### חזרה אחורה

אם צריך לחזור מ-D1 ל-better-sqlite3 (לצורכי debug או ocalhost):
- `NODE_ENV=development` מפעיל אוטומטית את ה-SQLite branch
- `npm run dev` — עובד כרגיל, על `data/dev.db`
- אין השפעה על production

### מגבלות D1 לעומת better-sqlite3

- **אין transactions מרובות statement** — רק `batch()` (כבר עברנו).
- **Latency**: D1 רץ באזור אחד, יכול להיות ~10-50ms מה-Worker (תלוי באיפור ה-Worker). לעומת better-sqlite3 ש-in-process (<1ms).
- **Row size**: D1 מאפשר עד ~2MB per row (שלנו עד 2.7MB לוגו בגודל המקסימלי — עדיין בתוך המגבלה).
- **Concurrency**: D1 תומך במספר קוראים בו-זמנית; SQLite מקומי (WAL) גם.

## סיכום

Phase A (קוד) הושלם. המערכת מוכנה ל-Cloudflare Pages — חסר רק להריץ את הפקודות ב-Phase B עם אישור משתמש ל-Cloudflare account.
