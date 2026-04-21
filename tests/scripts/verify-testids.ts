import 'dotenv/config';
import { chromium } from '@playwright/test';
import { BASE_URL } from '../utils/config.js';
import { loginViaUI } from '../utils/login.js';

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginViaUI(page, 'owner');

  await page.goto(`${BASE_URL}/equipment`, { waitUntil: 'networkidle' });

  const ids = await page.$$eval('[data-testid]', els =>
    els.map(e => e.getAttribute('data-testid'))
  );

  const unique = [...new Set(ids)].sort();
  console.log(`Found ${ids.length} elements with ${unique.length} unique testids:`);
  unique.forEach(id => console.log(`  ${id}`));

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
