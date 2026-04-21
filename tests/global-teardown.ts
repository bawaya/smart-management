import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { cleanupTestData } from './scripts/cleanup-test-data.js';

async function run(): Promise<void> {
  console.log('\n▶ Global teardown — cleaning up TEST_ data...');
  try {
    await cleanupTestData();
    console.log('✓ Teardown complete');
  } catch (e) {
    // لا نفشل الـ teardown — الاختبارات خلصت بنجاح
    console.warn(
      '⚠ Cleanup encountered issues (non-fatal):',
      (e as Error).message,
    );
  }
}

// Playwright globalTeardown entry
export default run;

// Direct invocation via `tsx global-teardown.ts` (npm run teardown)
const isMain =
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  run().catch((e) => {
    console.error(e);
    process.exit(0);
  });
}
