# מדריך התקנה והפעלה

## דרישות מקדימות

- **Node.js 20+** (LTS). בדיקה: `node --version`.
- **npm 10+** (מגיע עם Node). בדיקה: `npm --version`.
- **Git** (לקלון רפו).
- **Windows / macOS / Linux** — המערכת Cross-platform. במדריך הזה השלבים ב-Windows (bash / Git Bash), המקבילות ל-Unix זהות פרט ל-path separators.
- **RAM**: 4GB+ (better-sqlite3 הוא native module — קומפילציה ראשונה יכולה לדרוש יותר).
- **Build tools**: `windows-build-tools` / `xcode-select` / `build-essential` — נדרשים ל-better-sqlite3. npm יתקין אוטומטית אם חסר.

---

## שלב 1 — קלון הרפו

```bash
git clone <repo-url> smart-management
cd smart-management
```

## שלב 2 — Install dependencies

```bash
npm install
```

זה יתקין:
- `next@14.2`
- `better-sqlite3` (native, יקומפל במהלך ההתקנה)
- `bcryptjs`, `jose`, `sharp`, `next-pwa`, `tailwindcss`, `typescript`, `vitest`
- ועוד (ראה [package.json](../package.json))

**אם better-sqlite3 נכשל**: בדוק שיש build tools. ב-Windows:
```bash
npm install --global windows-build-tools   # legacy — או להתקין Visual Studio Build Tools ידנית
```

## שלב 3 — Environment variables

צור קובץ `.env.local` בשורש:

```bash
JWT_SECRET="generate-a-strong-random-string-at-least-32-chars"
```

**ליצירת secret חזק**:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

**חשוב**:
- ב-production המערכת **זורקת exception** אם `JWT_SECRET` חסר.
- ב-development יש fallback ל-`'dev-only-insecure-secret-change-me'`, אבל גם בפיתוח עדיף להגדיר secret ייחודי כדי לא לאבד session-ים בין פרויקטים מקומיים.

## שלב 4 — מיגרציה של DB

```bash
npx tsx src/lib/db/migrate.ts
```

זה יוצר את הקובץ `data/app.db` (אם לא קיים) ומריץ את `src/lib/db/schema.sql` — 27 טבלאות + 1 VIEW + seed data.

**ה-seed כולל**:
- `tenant_id='default'`.
- משתמש `admin` עם סיסמה `admin123` ו-`must_change_password=1`.
- ערכי settings בסיסיים (company_name ריק, vat_rate=17, `is_setup_complete=0`).

## שלב 5 — ייצור אייקוני PWA (אופציונלי)

```bash
node scripts/generate-pwa-icons.mjs
```

זה יוצר 3 PNG-ים ב-`public/icons/` מתוך `public/logo.svg` (`sharp`). קובצי `.png` של הפרויקט כבר commitד בריפו, אז לא חייבים להריץ מחדש פרט לשינוי הלוגו.

## שלב 6 — הפעלת ה-dev server

```bash
npm run dev
```

הדף יעלה ב-`http://localhost:3000`.

---

## כניסה ראשונה

1. נווט ל-`http://localhost:3000` — תועבר ל-`/login` (middleware).
2. הכנס:
   - **שם משתמש**: `admin`
   - **סיסמה**: `admin123`
3. בגלל ש-`must_change_password=1` ו-`is_setup_complete=0`, תועבר אוטומטית ל-`/setup`.
4. אשף ההגדרות — 5 שלבים:
   - שלב 1: סיסמה חדשה (חובה; 8+ תווים).
   - שלב 2: פרטי החברה (שם, ח.פ., כתובת, טלפון).
   - שלב 3: פרטי עסק (לוגו עד 2MB, פרטי בנק).
   - שלב 4: תמחור (שכר לשעה/יום, מע"מ).
   - שלב 5: סוגי ציוד התחלתיים.
5. בסיום — ניתוב ל-Dashboard.

---

## פקודות שימושיות

| פקודה | תיאור |
|-------|-------|
| `npm run dev` | Dev server עם hot reload (port 3000). |
| `npm run build` | Production build. |
| `npm start` | מריץ את ה-production build (אחרי `build`). |
| `npm run lint` | ESLint (next lint). |
| `npx vitest` | בדיקות יחידה (vitest). |
| `npx tsx src/lib/db/migrate.ts` | מריץ מיגרציה של DB. |
| `node scripts/generate-pwa-icons.mjs` | מחדש PWA icons. |

---

## קבצים חשובים בסביבת הריצה

- `data/app.db` — קובץ ה-SQLite (לא ב-git). נוצר ע"י `migrate.ts`.
- `data/*.db-journal`, `*.db-wal`, `*.db-shm` — קבצי SQLite journal/WAL (גם לא ב-git).
- `.next/` — build cache של Next (לא ב-git).
- `.env.local` — secret (לא ב-git).
- `public/sw.js`, `public/workbox-*.js` — נוצרים ע"י next-pwa בזמן build.

---

## איפוס נתונים

למחוק את ה-DB ולהתחיל מחדש:

```bash
rm data/app.db data/app.db-*
npx tsx src/lib/db/migrate.ts
```

**או** דרך ה-UI: עמוד `/help` → "Reset Setup" (שומר נתונים, רק מאפס את `is_setup_complete`).

---

## Deploy ל-production

### אופציה A — Node.js server (VPS)

```bash
npm run build
NODE_ENV=production JWT_SECRET="..." npm start
```

ב-VPS צריך לוודא:
- `data/` כתיב (למעשה כל הדיסק).
- Reverse-proxy (nginx/caddy) עם HTTPS — ה-cookies מוגדרים `secure: true` ב-production.
- Backups של `data/app.db` (cron).

### אופציה B — Cloudflare Pages + D1 (מתוכנן)

better-sqlite3 לא רץ ב-Workers runtime. למעבר ל-production יש לעבור ל-Cloudflare D1:
1. Migration: להחליף את `src/lib/db/index.ts` ב-adapter של D1.
2. Schema: להעלות את `schema.sql` ל-D1 דרך `wrangler d1 execute`.
3. Environment: להגדיר `JWT_SECRET` ב-Cloudflare secrets.
4. לקמפל עם `@cloudflare/next-on-pages`.

זה לא מוטמע עדיין — נשמר כ-TODO ב-[changelog.md](changelog.md).

---

## פתרון בעיות נפוצות

| תקלה | פתרון |
|------|-------|
| `Cannot find module 'better-sqlite3'` | `npm rebuild better-sqlite3` |
| `JWT_SECRET is required in production` | להגדיר ב-`.env.local` (ראה שלב 3) |
| `admin/admin123` לא עובד | להריץ שוב `migrate.ts`; אולי DB קיימת ממיגרציה ישנה — מחוק `data/app.db` |
| PWA לא מתקינה | לוודא שהאתר ב-HTTPS (pwa דורשת secure context), פרט ל-`localhost` שחריג |
| שגיאות TypeScript חדשות | `npm run build` ל-full type-check, עדכון `tsconfig.json` אם צריך |
