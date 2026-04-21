# Smart Management — E2E Test Suite

Playwright end-to-end tests for [smart-management.pages.dev](https://smart-management.pages.dev).

## Coverage

| Phase | Module | Status |
|-------|--------|:--:|
| 2 | Auth, JWT, middleware | ✅ |
| 3 | RBAC matrix (5 roles × 29 pages) | ✅ |
| 4 | Cleanup infrastructure | ✅ |
| 5A | Equipment CRUD | ✅ |
| 5B | Master data (vehicles, workers, equipment-types, clients) | ✅ |
| 5C | Operations (fuel, expenses, daily-log) | ✅ |
| 5D | Financial modules (10 sub-managers) | ✅ |
| 6a | Business flows: invoice lifecycle + cancellation | ✅ |
| 6b | Business flows: equipment, budget, check lifecycles | ✅ |
| 7 | Reports smoke + accuracy | ✅ |
| 8 | Security (XSS, SQL injection, auth bypass) | ✅ |
| 9 | Defense layer (smoke, PWA, empty states) | ✅ |

All test data is `TEST_`-prefixed and removed by the global teardown via `wrangler d1 execute --remote`.

## Quick Start

```bash
cd tests
npm install
npx playwright install chromium

# Create local env from template
cp .env.example .env
# Edit .env with credentials (see below)
```

### First-time test users

The 4 non-owner roles are seeded into prod via:

```bash
# Owner credentials (admin) must already exist in .env
npm run users:seed
npm run users:verify
```

## Running Tests

```bash
# All tests
./node_modules/.bin/playwright test --reporter=list

# Specific spec
./node_modules/.bin/playwright test e2e/10-equipment

# Visual debug mode (opens Playwright UI)
./node_modules/.bin/playwright test --ui

# Headed (watch the browser)
./node_modules/.bin/playwright test --headed

# View last HTML report
./node_modules/.bin/playwright show-report

# Manual cleanup of TEST_ data
npm run test:cleanup
```

## Architecture

### Helpers

| File | Purpose |
|------|---------|
| `utils/master-helpers.ts` | Generic CRUD operations (add/edit/toggle/delete by text + form fill) across all modules |
| `utils/equipment-helpers.ts` | Equipment-specific status modal flow |
| `utils/daily-log-helpers.ts` | Worker assignments + log confirmation |
| `utils/finance-helpers.ts` | Bank-account prereq + invoice/debt payments + reconciliation step nav |
| `utils/flow-helpers.ts` | End-to-end business flows (build/confirm/invoice/pay/cancel) |
| `utils/prereq-seeder.ts` | Ensures FK dependencies exist (clients, workers, equipment) |
| `utils/report-seeders.ts` | Deterministic data + number parsing for report-accuracy tests |
| `utils/security-payloads.ts` | XSS + SQL injection payloads |
| `utils/test-data.ts` | `TEST_`-prefixed identifier generators |
| `utils/ui-helpers.ts` | `submitAndWait` with 300ms settle for Server Action revalidation race |

### Conventions

- **All write operations use `TEST_` prefix** — the cleanup script targets only those rows
- **`data-testid`** attributes for stable selectors (kebab-case, semantic naming)
- **Storage state caching** — one login per role at startup, reused across tests
- **Server-side cleanup** via `wrangler d1 execute --remote` after every run

## CI

GitHub Actions runs the full suite on every push to `main`/`master` and every PR — see [.github/workflows/test.yml](../.github/workflows/test.yml).

### Required Secrets

Add to GitHub repo → Settings → Secrets and variables → Actions:

| Secret | Description |
|--------|-------------|
| `OWNER_USERNAME` | Real owner username on prod (typically `admin`) |
| `OWNER_PASSWORD` | Owner password |
| `MANAGER_PASSWORD` | `test_manager` password |
| `ACCOUNTANT_PASSWORD` | `test_accountant` password |
| `OPERATOR_PASSWORD` | `test_operator` password |
| `VIEWER_PASSWORD` | `test_viewer` password |
| `CLOUDFLARE_API_TOKEN` | API token with `Account → D1 → Edit` permission |
| `CLOUDFLARE_ACCOUNT_ID` | From `wrangler.toml` |

Usernames for the 4 seeded roles are hardcoded in the workflow (deterministic). Only the owner username is a secret because it points at a real user account.

### Cloudflare API Token

1. Visit https://dash.cloudflare.com/profile/api-tokens
2. **Create Token** → **Custom Token**
3. Permissions: `Account → D1 → Edit`
4. Account Resources: Include → Specific → `smart-management`
5. Save and copy

### Workflow Behavior

- Cancels previous runs on the same branch when a new push arrives
- Caches Playwright browsers between runs (~2 min savings)
- On failure, uploads:
  - **HTML report** (artifact: `playwright-report-<run-id>`)
  - **Trace files** (artifact: `playwright-traces-<run-id>`) — open with `npx playwright show-trace`
- Retention: 7-14 days

### Manual Trigger

Actions tab → **E2E Tests** → **Run workflow** → choose branch.

## Bug Discoveries

This suite has caught real production bugs (now fixed in v1.0.1):

1. **D1 UNIQUE constraint detection** — Workers couldn't get clear error messages on duplicate ID numbers because D1 returns a different error format than SQLite (`D1_ERROR` vs `SQLITE_CONSTRAINT`).
2. **`/expenses` page client crash** — A `'use server'` const export was breaking React hydration with `TypeError: i.map is not a function`.

## Adding New Tests

1. Add `data-testid` attributes to source components first (one PR — UI only)
2. Deploy to staging
3. Write tests against production (separate PR)
4. Use `TEST_` prefix for any data created
5. Verify cleanup includes new tables/columns

## Troubleshooting

### "Browser not installed"

```bash
npx playwright install chromium
```

### "Unable to launch chromium" on WSL

```bash
sudo npx playwright install-deps chromium
```

### Tests time out / network errors

Verify production URL is reachable:

```bash
curl -I https://smart-management.pages.dev/login
```

### Cleanup didn't run

```bash
npm run test:cleanup
```

### Wrangler workerd platform mismatch (Windows native)

Run from WSL — `wrangler` and `@cloudflare/next-on-pages` need a Linux toolchain.

## License

Proprietary. Tests are bundled with the project under the same license.
