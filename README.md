# Smart Management — ERP for Equipment & Worker Operations

> A multi-tenant SaaS-ready ERP system for managing equipment, workers, daily logs, invoicing, and finance — built on Next.js 14 + Cloudflare Pages + D1.

[![E2E Tests](https://github.com/bawaya/smart-management/actions/workflows/test.yml/badge.svg)](https://github.com/bawaya/smart-management/actions/workflows/test.yml)
[![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)]()
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)]()

---

## Features

- **Multi-role access** — Owner, Manager, Accountant, Operator, Viewer
- **Equipment & Vehicle Management** — track lifecycle, maintenance, retirement
- **Daily Logs** — record work with worker assignments and revenue tracking
- **Smart Invoicing** — auto-generate invoices from confirmed daily logs with VAT
- **Comprehensive Finance** — bank accounts, credit cards, checks, standing orders, transactions, debts, reconciliation
- **Budget Tracking** — yearly/monthly budgets with planned vs actual analysis
- **Reports** — profit/loss, accountant view, cost analysis, fuel, workers, budget
- **PWA** — installable on mobile/desktop
- **RTL-first** — designed for Hebrew, also supports Arabic

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, Edge Runtime) |
| UI | React 18 + Tailwind CSS |
| Database | Cloudflare D1 (SQLite-compatible) |
| Auth | bcrypt + JWT (`jose`) + httpOnly cookies |
| Hosting | Cloudflare Pages + Workers |
| Testing | Playwright E2E (see [tests/README.md](tests/README.md)) |
| CI | GitHub Actions |

## Architecture

- **Edge-first** — all routes use `runtime = 'edge'`
- **Server Actions** — all CRUD via async actions (no separate REST API)
- **Multi-tenant scaffolding** — single `default` tenant active; design supports activation
- **Schema** — 27+ tables, FK-aware, with UNIQUE constraints
- **D1 adapter pattern** — `SmartDb` interface allows swapping between D1 (prod) and `better-sqlite3` (local dev) without call-site changes

## Documentation

- **[CHANGELOG.md](CHANGELOG.md)** — version history
- **[tests/README.md](tests/README.md)** — testing guide and CI setup

## Development

```bash
# Install
npm install

# Local dev (uses better-sqlite3 over a local file)
npm run dev

# Build
npm run build

# Lint + typecheck
npm run lint
npx tsc --noEmit
```

### First-time setup

```bash
# Apply schema locally
npx tsx src/lib/db/migrate.ts

# Default credentials (change on first login):
#   username: admin
#   password: admin123
```

## Deployment

> Run from WSL on Windows hosts — `@cloudflare/next-on-pages` and `wrangler` need a Linux/macOS toolchain.

```bash
# 1. Authenticate (once)
wrangler login

# 2. Create the D1 database (once per environment)
wrangler d1 create smart-management
# Copy the printed database_id into wrangler.toml

# 3. Apply schema to remote D1
wrangler d1 execute smart-management --file=src/lib/db/schema.sql --remote

# 4. Set JWT_SECRET (required in production)
wrangler pages secret put JWT_SECRET

# 5. Build for Cloudflare Pages
npx @cloudflare/next-on-pages

# 6. Deploy
npx wrangler pages deploy .vercel/output/static --project-name=smart-management
```

## Testing

The project includes a comprehensive Playwright E2E suite covering:

- Authentication & JWT validation
- RBAC across all roles and pages
- Full CRUD for 14+ modules
- 5 end-to-end business flows
- Report accuracy with seeded data
- Security (XSS, SQL injection, auth bypass)
- Smoke tests for every page
- PWA manifest

```bash
cd tests
npm install
npx playwright install chromium
./node_modules/.bin/playwright test --reporter=list
```

See **[tests/README.md](tests/README.md)** for the full guide and CI setup.

## Status

- **Version**: 1.0.1
- **Production URL**: `https://smart-management.pages.dev`

## License

Proprietary. All rights reserved.

---

*Built by Mohammad Bawaya · Maintained on Cloudflare Pages*
