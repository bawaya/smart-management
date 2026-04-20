# אימות ואבטחה

## זרימת Login

```
Client (login page, use client)
    │ POST formData: {username, password}
    ▼
loginAction (app/(auth)/login/action.ts, 'use server')
    │
    ├── DB: SELECT ... WHERE tenant_id=? AND username=? AND is_active=1
    │   (tenantId = getTenantId() = 'default' כרגע)
    │
    ├── verifyPassword(plain, password_hash)  → bcrypt compare
    │
    ├── createSession(userId, role, username, tenantId)
    │       ├── signToken(payload) → JWT (HS256, exp=1h)   → cookie 'auth-token'
    │       └── signRefreshToken(payload) → JWT exp=7d     → cookie 'refresh-token'
    │
    ├── DB: SELECT value FROM settings WHERE key='is_setup_complete'
    │
    └── return { success: true, mustChangePassword, isSetupComplete }
           │
           ▼
    Client: אם mustChangePassword || !isSetupComplete → router.push('/setup')
           אחרת → router.push('/')
```

כל כישלון (משתמש לא נמצא, סיסמה לא נכונה) מחזיר **אותה הודעה** — `"שם המשתמש או הסיסמה שגויים"` — כדי למנוע enumeration של משתמשים.

## JWT

**ספרייה**: `jose` (Edge-compatible, תומך ב-Cloudflare Workers).

**אלגוריתם**: HS256 (symmetric, secret משותף).

**Payload**:
```ts
{
  userId: string,
  role: 'owner'|'manager'|'accountant'|'operator'|'viewer',
  username: string,
  tenantId: string,
  iat: number,  // נחתם אוטומטית על ידי jose
  exp: number   // setExpirationTime
}
```

**שני tokens**:
- `auth-token`: access token, תוקף שעה (`ACCESS_TOKEN_TTL = '1h'`).
- `refresh-token`: refresh token, תוקף 7 ימים.

**Secret**: נקרא מ-`process.env.JWT_SECRET` בכל קריאה (דינאמי). בפיתוח יש fallback ל-`'dev-only-insecure-secret-change-me'`. ב-production חובה JWT_SECRET — אם חסר, הפונקציה זורקת exception.

**Auto-refresh**: `getSession()` (ב-`lib/auth/session.ts`) בודק קודם את ה-access token. אם פג תוקף אך ה-refresh token תקין, מחתים access חדש ומעדכן את ה-cookie. נעשה עם try/catch כי `cookies().set()` חוקי רק ב-Server Action או Route Handler — אם נקרא מ-Server Component, ה-catch בולע את השגיאה והסשן נשאר תקין ל-request זה בלבד.

**Logout**: `destroySession()` מוחק שני ה-cookies.

## Password Hashing

**ספרייה**: `bcryptjs` (JS pure, ל-Edge runtime compatibility).

**Rounds**: 12 (איזון סביר בין ביצועים לעמידות).

**API**:
```ts
await hashPassword(plain);        // returns $2b$12$...
await verifyPassword(plain, hash); // returns boolean
```

**בדיקות**: `src/lib/auth/__tests__/password.test.ts` — 3 tests (hash שונה מהמקור, verify חיובי, verify שלילי).

## Middleware — השער הראשון

**קובץ**: `src/middleware.ts`.

**סינון נתיבים (matcher)**:
```ts
matcher: ['/((?!_next/static|_next/image).*)']
```

**Bypass list — לא דורשים auth**:
- Exact: `/login`, `/setup`, `/favicon.ico`, `/manifest.json`, `/offline.html`, `/sw.js`.
- Prefix: `/_next/*`, `/api/public/*`, `/icons/*`, `/workbox-*`.
- Extensions: `.png|.jpg|.jpeg|.svg|.css|.js|.json|.html|.ico|.webmanifest|.xml|.map|.woff2?|.txt`.

**עבור נתיבים שלא ב-bypass**:
1. קורא cookie `auth-token`.
2. קורא ל-`verifyToken(token)`.
3. אם null → `NextResponse.redirect('/login')`.
4. אם תקין → מזריק ל-request headers:
   - `x-user-id`
   - `x-user-role`
   - `x-user-username`
   - `x-tenant-id`
5. `NextResponse.next({ request: { headers } })`.

**חשוב**: ה-Middleware רץ ב-Edge runtime — jose עובד, better-sqlite3 לא. לכן ה-Middleware לא ניגש ל-DB ישירות. רק בודק JWT.

## RBAC — Role-Based Access Control

**קובץ**: `src/lib/auth/rbac.ts`.

### 5 תפקידים

| תפקיד | תיאור |
|-------|-------|
| `owner` | בעלים — גישה מלאה לכל המערכת. |
| `manager` | מנהל — גישה ליומן, ציוד, רכבים, עובדים, דוחות. אין גישה להגדרות או כספים. |
| `accountant` | רואה חשבון — גישה לחשבוניות, כספים, תקציב, דוחות. אין גישה ליומן או ציוד. |
| `operator` | מפעיל שדה — יכול לרשום ביומן (את הרישומים של עצמו בלבד). |
| `viewer` | צופה — קריאה בלבד ביומן ובעזרה. |

### 11 הרשאות × 5 תפקידים

| Permission | owner | manager | accountant | operator | viewer |
|-----------|-------|---------|------------|----------|--------|
| `settings` | ✓ | | | | |
| `settings.users` | ✓ | | | | |
| `finance` | ✓ | | ✓ | | |
| `daily_log.write` | ✓ | ✓ | | ✓ | |
| `daily_log.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `reports` | ✓ | ✓ | ✓ | | |
| `invoices` | ✓ | | ✓ | | |
| `budget` | ✓ | | ✓ | | |
| `equipment` | ✓ | ✓ | | | |
| `workers` | ✓ | ✓ | | | |
| `help` | ✓ | ✓ | ✓ | ✓ | ✓ |

### API

```ts
export function hasPermission(role: Role, permission: string): boolean;
export function requirePermission(role: Role, permission: string): void;  // זורק
```

**בדיקות**: `src/lib/auth/__tests__/rbac.test.ts` — 5 tests.

## 4 שכבות הגנה (Defense in Depth)

### שכבה 1: Middleware
כל request (פרט ל-bypass) מתאמת את ה-JWT. בלי cookie תקין → redirect ל-login.

### שכבה 2: Page-level gate
ב-Server Component של כל page רגיש:
```tsx
const userRole = headers().get('x-user-role') as Role;
if (!hasPermission(userRole, 'finance')) {
  redirect('/');
}
```

ב-layout של קבוצת routes — הגנה אחת מספיקה לכל הקבוצה (למשל `finance/layout.tsx`).

### שכבה 3: Action-level gate
בכל Server Action — לא סומכים על page gate. הפונקציה יכולה להיקרא מ-fetch ידני.

```ts
async function requireRole(allowed: readonly Role[]) {
  const token = cookies().get('auth-token')?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return { error: 'אין הרשאה' };
  if (!allowed.includes(payload.role as Role)) return { error: 'אין הרשאה' };
  return { tenantId: payload.tenantId, userId: payload.userId, role: payload.role };
}
```

**variants** ב-actions שונים:
- `requireOwner()` — רק owner (settings actions).
- `requireRole(['owner', 'manager'])` — עבור equipment, vehicles, workers.
- `requireWriter()` — `['owner', 'manager', 'operator']` עבור daily_log, fuel, expenses.
- `requireFinanceRole()` — `['owner', 'accountant']` עבור finance, invoices, budget.
- `requireInvoiceRole()` — same as finance.
- `requireBudgetRole()` — same.

### שכבה 4: Tenant Isolation

כל action בודק `auth.tenantId !== tenantId` שמגיע מה-parameter. מונע user של tenant A לגעת בנתוני tenant B.

בנוסף, actions שמקבלות FK-ים (vehicle_id, equipment_id, worker_id) מאמתות שהם שייכים ל-tenant:
```ts
async function assertBelongsToTenant(tenantId, table, id): Promise<boolean>;
```

## הגנה על פעולות רגישות

### `must_change_password = 1`

מסומן כברירת מחדל על admin ועל משתמשים חדשים שנוצרים דרך "ניהול משתמשים" או "איפוס סיסמה".

**זרימה**:
1. משתמש נכנס עם סיסמה זמנית.
2. `loginAction` מחזיר `mustChangePassword: true`.
3. ה-Client עושה `router.push('/setup')`.
4. אשף ההגדרות — שלב 1 מבקש סיסמה חדשה.
5. `changePasswordAction` מחליף את ה-hash + מעדכן `must_change_password = 0`.

### Operator-ownership

operator יכול לערוך או לאשר רק רישומים יומיים שהוא בעצמו יצר:
```ts
if (auth.role === 'operator' && existing.created_by !== auth.userId) {
  return { success: false, error: 'אין הרשאה לערוך רישום של אחר' };
}
```

מיושם ב-3 מקומות:
1. `daily-log/[id]/page.tsx` — redirect ל-`/daily-log`.
2. `updateDailyLogAction` — rejection.
3. `confirmLogAction` — rejection.
4. `DailyLogManager.canEditLog()` — מסתיר את כפתור "עריכה".

### Self-protection בניהול משתמשים

- owner לא יכול להשבית את עצמו (`toggleUserAction`).
- owner לא יכול להוריד את עצמו מ-`owner` (`updateUserAction` — `if userId===auth.userId && role!=='owner'`).

### Reset Setup

`resetSetupAction` (ב-help/actions.ts) זמין רק ל-owner. מחזיר את `is_setup_complete` ל-`false` ועושה redirect ל-`/setup`. הנתונים הקיימים נשמרים — רק ה-flag מתאפס.

## Cookies

```ts
{
  httpOnly: true,                                    // לא נגיש ל-JS בדפדפן
  secure: process.env.NODE_ENV === 'production',     // HTTPS בלבד ב-prod
  sameSite: 'lax',                                   // מונע רוב ה-CSRF
  path: '/',
  maxAge: 3600 / 604800                              // access / refresh
}
```

**לא SameSite=strict** — כדי לאפשר ניווט חוצה-origin (אם משתמש לוחץ לינק לאפליקציה מ-gmail למשל).

## Body Size Limit

Server Actions מוגבלות ל-5MB ב-`next.config.mjs` (`serverActions.bodySizeLimit: '5mb'`). זה כדי לתמוך בהעלאת לוגו עד 2MB (base64 ~2.7MB + overhead).
