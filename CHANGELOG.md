# Changelog

All notable changes to Smart Management are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] — 2026-04-21

### Added

- **Comprehensive Playwright E2E test suite** across 30 specs:
  - Authentication, JWT validation, middleware (Phase 2)
  - RBAC matrix: 5 roles × 29 pages = 145 combinations (Phase 3)
  - Cleanup infrastructure with `TEST_` prefix safety guards (Phase 4)
  - Full CRUD coverage for 14 modules (Phase 5A–5D)
  - 5 end-to-end business flows: invoice lifecycle, cancellation, equipment lifecycle, budget cycle, check lifecycle (Phase 6)
  - Report accuracy with seeded deterministic data (Phase 7)
  - Security tests: XSS, SQL injection, auth bypass (Phase 8)
  - Defense layer: smoke tests, PWA verification, empty states (Phase 9)
- **GitHub Actions CI** workflow for automated test runs on every push/PR ([.github/workflows/test.yml](.github/workflows/test.yml))
- **`data-testid` coverage** across all UI components (~480 testids across 30 files) for stable test selectors
- **Centralized DB error helpers** ([src/lib/db/errors.ts](src/lib/db/errors.ts)) supporting both D1 and SQLite formats: `isUniqueConstraintError`, `isForeignKeyError`, `isNotNullError`

### Fixed

- **D1 UNIQUE constraint detection** — Cloudflare D1 returns errors as `D1_ERROR` instead of `SQLITE_CONSTRAINT`. Updated detection logic in workers, users, clients, and equipment-types actions to recognize both formats and surface user-friendly Hebrew error messages instead of unhandled throws.
- **`/expenses` page client crash** — `'use server'` files in Next.js can only export async functions. The `VALID_CATEGORIES` const exported from `expenses/actions.ts` was being replaced with a Server Action proxy on the client, breaking `.map()` calls (`TypeError: i.map is not a function`). Moved const + type to a separate non-server module ([expenses/categories.ts](src/app/(dashboard)/expenses/categories.ts)).

### Changed

- Added stable selectors (`data-testid`) without affecting UI behavior
- `tsconfig.json` excludes `tests/` from app typecheck (tests have their own tsconfig)

## [1.0.0] — earlier

Initial production release on Cloudflare Pages + D1.

---

## Notes

- For detailed test coverage, see [tests/README.md](tests/README.md)
- Production URL: `https://smart-management.pages.dev`
