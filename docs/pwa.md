# Progressive Web App (PWA)

המערכת מותקנת כ-PWA — ניתן להוסיף למסך הבית במובייל/דסקטופ, רצה כאפליקציה עצמאית, ותומכת offline בסיסי.

## מה זה PWA?

אפליקציית web שהדפדפן מזהה כ-installable אם יש לה:
1. `manifest.json` תקף עם icons.
2. Service Worker רשום.
3. Served over HTTPS (או localhost).

Chrome/Edge/Safari מציגים באופן אוטומטי הזמנה "Install app".

---

## מבנה

### `public/manifest.json`

```json
{
  "name": "ניהול חכם",
  "short_name": "ניהול חכם",
  "description": "הניהול החכם לעסק שלך",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f0f1a",
  "theme_color": "#f59e0b",
  "dir": "rtl",
  "lang": "he",
  "orientation": "any",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

**שדות חשובים**:
- `display: standalone` — האפליקציה נפתחת בלי address bar, מרגיש כמו native app.
- `dir: rtl`, `lang: he` — Hebrew-first.
- `start_url: /` — ה-entry point אחרי התקנה (Middleware יעביר ל-`/login` אם אין session).
- `background_color` — מוצג בעת splash screen לפני שה-JS נטען.
- `theme_color` — צבע ה-address bar במובייל.
- `purpose: maskable` — ה-OS יכול לחתוך את האייקון בצורה שונה (עיגול ב-Android).

**טעינה**: `<link rel="manifest" href="/manifest.json" />` ב-`app/layout.tsx`.

### `public/sw.js` + `public/workbox-*.js`

נוצרים אוטומטית בזמן `npm run build` ע"י `next-pwa`. לא ב-git (מופיעים ב-`.gitignore`).

**תפקיד ה-SW**:
- Pre-cache של static assets (`_next/static/*`).
- Runtime cache של requests.
- Offline fallback: כל ניווט שנכשל בגלל אין-רשת מחזיר `/offline.html`.

### `public/offline.html`

דף HTML סטטי מוטמע — מוצג כש-SW מחזיר fallback. עיצוב מינימלי, כפתור "נסה שוב" שקורא ל-`location.reload()`.

### `public/icons/`

3 PNG-ים (192×192, 512×512, maskable 512×512) שנוצרים מה-לוגו ב-`public/logo.svg` ע"י `scripts/generate-pwa-icons.mjs` (משתמש ב-`sharp`).

---

## תצורה — `next.config.mjs`

```js
import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/offline.html',
  },
});

export default withPWA(nextConfig);
```

**משמעות**:
- `dest: 'public'` — ה-SW נכתב ל-`public/sw.js` (סומים לשורש ה-URL).
- `register: true` — next-pwa מוסיף אוטומטית `navigator.serviceWorker.register('/sw.js')` ב-layout.
- `skipWaiting: true` — SW חדש תופס שליטה מיד במקום להמתין לסגירת כל ה-tabs.
- `disable: ... === 'development'` — SW כבוי ב-`npm run dev` כדי למנוע caching שמפריע ל-hot-reload.
- `fallbacks.document: '/offline.html'` — offline page.

---

## התקנה במובייל

### Android (Chrome)
1. פותחים את האתר ב-Chrome.
2. הדפדפן מציג באנר "Install app" (או 3-dots menu → "Install app").
3. לוחצים "Install" — האייקון נוסף ל-launcher.

### iOS (Safari)
1. פותחים את האתר ב-Safari.
2. Share menu → "Add to Home Screen" (iOS לא מציג באנר אוטומטי).
3. האייקון נוסף ל-home screen.

**הערה על iOS**: Safari תומך ב-PWA אבל מוגבל יותר — חלק מ-APIs לא עובדים (push notifications, background sync). למערכת שלנו זה מספיק — כל הפעולות דורשות רשת פרט ל-offline page.

### Desktop (Chrome/Edge)
1. בצד ימין של address bar — אייקון "Install".
2. לחיצה → popup אישור → האפליקציה נפתחת כחלון נפרד.

---

## זרימת offline

```
User navigates to /dashboard
    │
    ▼
SW intercepts fetch
    │
    ▼
Is there network?
    ├── Yes → Forward to Next.js server
    └── No  → SW returns cached offline.html
```

**חשוב**: רק ניווטים (navigate requests) מופנים ל-`offline.html`. Server Actions / API calls שנכשלים מחזירים שגיאת רשת ל-React — ה-Client צריך להציג הודעה מתאימה.

**מה לא מוטמע**:
- Background sync (לקבל daily log offline ולעדכן כש-online).
- Push notifications.
- אלו הורחקו מ-scope של v1.0.0 בגלל מורכבות (כל action הוא mutation ודורש DB transaction).

---

## Bypass של ה-Middleware

הקבצים של PWA חייבים להיות נגישים ללא authentication — אחרת ה-manifest לא נטען וה-SW לא נרשם:

```ts
// middleware.ts
const EXACT_BYPASS = new Set([
  '/login',
  '/setup',
  '/favicon.ico',
  '/manifest.json',        // ← PWA
  '/offline.html',         // ← PWA
  '/sw.js',                // ← PWA
]);
const PREFIX_BYPASS = ['/_next', '/api/public', '/icons/', '/workbox-'];
```

**בעיה היסטורית**: לפני Sprint 11 המערכת redirectה את `/manifest.json` ל-`/login` בגלל ש-middleware רץ על הכל. זה שבר PWA install. התיקון: `EXACT_BYPASS`.

---

## עדכון גרסה

כש-service worker חדש נרשם (אחרי `npm run build` ו-deploy):
1. הדפדפן מזהה SW חדש (שינוי בתוכן של `/sw.js`).
2. בגלל `skipWaiting: true` — ה-SW הישן מוחלף מיד.
3. בטאב הבא — האפליקציה מתחיל עם ה-assets החדשים.

**Cache busting**: next-pwa מוסיף hash לכל asset (`/_next/static/[hash]/...`). ה-SW יודע לזהות שינויים ו-fetch מחדש אוטומטית.

---

## איך לבדוק PWA ידנית

**Chrome DevTools** → Application tab:
- Manifest: לוודא שנטען ללא שגיאות, icons מוצגים.
- Service Workers: לבדוק `/sw.js` רשום עם status "activated and is running".
- Cache Storage: לראות אילו assets cached.

**Lighthouse PWA audit**:
1. DevTools → Lighthouse → PWA category.
2. הציון אמור להיות 90+.

---

## ייצור מחדש של icons

אם מחליפים לוגו:
1. להחליף את `public/logo.svg`.
2. להריץ:
   ```bash
   node scripts/generate-pwa-icons.mjs
   ```
3. הסקריפט משתמש ב-`sharp` לפעולה גרפית: padding + background + רינדור ל-PNG בשלושה גדלים.
4. לעשות commit לקבצים ב-`public/icons/`.
