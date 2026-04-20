# ניהול חכם — תיעוד טכני

רשימת כל מסמכי התיעוד של המערכת. מומלץ להתחיל מ-[setup-guide](setup-guide.md) ואז [architecture](architecture.md).

## מסמכי תיעוד

| מסמך | תוכן |
|------|------|
| [setup-guide.md](setup-guide.md) | מדריך התקנה והפעלה מקומית |
| [architecture.md](architecture.md) | בנייה מערכת — מבנה תיקיות, Tech Stack, זרימת בקשה |
| [database.md](database.md) | 27 טבלאות + 1 VIEW, קשרים, אינדקסים, seed data |
| [auth-and-security.md](auth-and-security.md) | JWT, RBAC, זרימת login, 4 שכבות הגנה |
| [modules.md](modules.md) | 12 מודולים — מה יש, קבצים, actions, הרשאות |
| [api-actions.md](api-actions.md) | Reference של כל ה-Server Actions (~64) |
| [pwa.md](pwa.md) | Progressive Web App — manifest, service worker, offline |
| [changelog.md](changelog.md) | יומן שינויים מלא — 12 sprints עד v1.0.0 |

## למבקרים חדשים

אם אתה מצטרף לפרויקט, הסדר המומלץ:

1. **[setup-guide](setup-guide.md)** — הפעל את המערכת מקומית תוך 5 דקות.
2. **[architecture](architecture.md)** — הבן את הבניין הכללי (15 דקות).
3. **[database.md](database.md)** — עיין ב-schema ובקשרים (10 דקות).
4. **[auth-and-security.md](auth-and-security.md)** — הבן איך המערכת מגינה על עצמה (10 דקות).
5. **[modules.md](modules.md)** — למד מה יש בכל מודול (20 דקות).
6. **[api-actions.md](api-actions.md)** — התייעץ אתו כשצריך להבין action ספציפי.

## מבט-על מהיר

- **Tech Stack**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + better-sqlite3 (dev) / Cloudflare D1 (prod).
- **ארכיטקטורה**: Server Components by default, Server Actions לכל mutation, Middleware לאימות.
- **הרשאות**: 5 תפקידים (owner/manager/accountant/operator/viewer) × 11 הרשאות.
- **Multi-tenancy**: כל הטבלאות הרלוונטיות כוללות `tenant_id` — מוכן ל-SaaS בעתיד.
- **PWA**: אפשר להתקין על מובייל, עובד offline.
