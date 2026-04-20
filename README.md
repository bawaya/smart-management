# ניהול חכם — Smart Management

## מה זה?

מערכת ERP לניהול חברות שירותי שטח — ציוד, עובדים, חשבוניות, תקציב וכספים.

## טכנולוגיות

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Cloudflare D1 (SQLite)
- PWA

## התקנה

```bash
npm install
npx tsx src/lib/db/migrate.ts
npm run dev
```

## כניסה ראשונה

- שם משתמש: `admin`
- סיסמה: `admin123`
- המערכת תנחה אותך דרך אשף ההגדרות

## Deploy to Cloudflare Pages

Dev uses better-sqlite3 over a local file; production runs on Cloudflare
Workers with a D1 binding. The adapter in `src/lib/db/index.ts` branches on
`NODE_ENV` — no call-site changes between the two environments.

```bash
# 1. Authenticate with Cloudflare
wrangler login

# 2. Create the D1 database (once per environment)
wrangler d1 create smart-management
# Copy the printed `database_id` into wrangler.toml (replace PLACEHOLDER_ID)

# 3. Apply the schema to the remote D1
wrangler d1 execute smart-management --file=src/lib/db/schema.sql --remote

# 4. Set JWT_SECRET as a Pages secret (required in production)
wrangler pages secret put JWT_SECRET

# 5. Build with @cloudflare/next-on-pages
#    (run on Linux / macOS / WSL — the CLI has known issues on native Windows)
npx @cloudflare/next-on-pages

# 6. Deploy
wrangler pages deploy .vercel/output/static
```

Notes:
- `wrangler.toml` already declares the D1 binding (`DB`), the
  `nodejs_compat` flag, and the Pages build output directory.
- `next.config.mjs` marks `better-sqlite3` as an external package so it's
  never bundled into the production output.
- No `export const runtime = 'edge'` is needed on pages;
  `@cloudflare/next-on-pages` converts Node.js-runtime routes automatically.

## רישיון

Proprietary — כל הזכויות שמורות
