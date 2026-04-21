import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { BASE_URL, CREDS } from './utils/config.js';
import { buildAllStorageStates } from './utils/storage-state.js';

async function run(): Promise<void> {
  console.log('▶ Global setup');
  console.log(`  BASE_URL: ${BASE_URL}`);

  // تحقق من وجود creds
  const missing = Object.entries(CREDS)
    .filter(([, v]) => !v.username || !v.password)
    .map(([k]) => k);
  if (missing.length) {
    console.warn(`⚠  Missing credentials for: ${missing.join(', ')}`);
    console.warn('   Update tests/.env before running full suite.');
  }

  // health check
  try {
    const r = await fetch(`${BASE_URL}/login`);
    if (!r.ok) throw new Error(`Status ${r.status}`);
    console.log('✓ Site is reachable');
  } catch (e) {
    console.error('✗ Site unreachable:', (e as Error).message);
    throw e;
  }

  // Build storage states لكل دور — سريع (5 × login ≈ 15s) + يتم مرة واحدة قبل الـ run
  console.log('▶ Building storage states for all roles...');
  try {
    await buildAllStorageStates();
    console.log('✓ All 5 storage states ready');
  } catch (e) {
    console.error('✗ Failed to build storage states:', (e as Error).message);
    console.error('  تأكد من أن الـ 5 users يسجلوا دخول (npm run users:verify)');
    throw e;
  }

  console.log('✓ Setup complete');
}

// Playwright globalSetup entry
export default run;

// Direct invocation via `tsx global-setup.ts` (from npm run setup)
const isMain =
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
