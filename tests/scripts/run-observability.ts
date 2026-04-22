/**
 * Orchestrator: seed → test → cleanup, with cleanup guaranteed to run
 * even when tests fail.
 *
 * Exit code = the test-stage exit code, so CI still knows whether the
 * observability tests passed. The cleanup stage is best-effort; failure
 * there is logged but does not overwrite the test result.
 */

import { execSync } from 'node:child_process';

function runStage(name: string, cmd: string): number {
  console.log(`\n▶ [${name}] ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`✓ [${name}] ok`);
    return 0;
  } catch (e: unknown) {
    const status =
      typeof e === 'object' && e !== null && 'status' in e
        ? (e as { status?: number }).status ?? 1
        : 1;
    console.error(`✗ [${name}] exit ${status}`);
    return status;
  }
}

const seedExit = runStage(
  'seed',
  'npx tsx scripts/seed-observability-user.ts',
);
if (seedExit !== 0) {
  console.error(
    '\n✗ Seed failed — aborting (no user was created, no cleanup needed).',
  );
  process.exit(seedExit);
}

const testExit = runStage(
  'tests',
  './node_modules/.bin/playwright test -c playwright.config.observability.ts',
);

const cleanupExit = runStage(
  'cleanup',
  'npx tsx scripts/cleanup-observability-user.ts',
);
if (cleanupExit !== 0) {
  console.error(
    '\n⚠ Cleanup stage had issues — rerun manually:\n    npm run obs:cleanup',
  );
}

process.exit(testExit);
