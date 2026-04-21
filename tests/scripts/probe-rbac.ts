import 'dotenv/config';
import { chromium, type BrowserContext } from '@playwright/test';
import { BASE_URL } from '../utils/config';
import { loginViaUI } from '../utils/login';

type ProbeCase = {
  role: 'viewer' | 'operator' | 'manager';
  path: string;
  shouldBeDenied: true;
};

const CASES: ProbeCase[] = [
  { role: 'viewer',   path: '/settings', shouldBeDenied: true },
  { role: 'operator', path: '/invoices', shouldBeDenied: true },
  { role: 'manager',  path: '/finance',  shouldBeDenied: true },
];

async function probeCase(ctx: BrowserContext, c: ProbeCase) {
  const page = await ctx.newPage();

  // نلتقط الاستجابة الأولى للمسار المطلوب
  let initialStatus: number | null = null;
  let initialLocation: string | null = null;
  page.on('response', async (r) => {
    const url = new URL(r.url());
    if (url.pathname === c.path && initialStatus === null) {
      initialStatus = r.status();
      initialLocation = r.headers()['location'] ?? null;
    }
  });

  const response = await page.goto(`${BASE_URL}${c.path}`, {
    waitUntil: 'networkidle',
  });
  const finalURL = page.url();
  const bodyText = (await page.locator('body').innerText())
    .slice(0, 300)
    .replace(/\s+/g, ' ')
    .trim();
  const hasError =
    /unauthorized|forbidden|permission|אסור|אין הרשאה|ממנوع|لا يمكن/i.test(
      bodyText,
    );

  console.log(`\n━━━ ${c.role} → ${c.path} ━━━`);
  console.log(`  Initial status : ${initialStatus ?? response?.status()}`);
  console.log(`  Initial Location: ${initialLocation ?? '(none)'}`);
  console.log(`  Final URL       : ${finalURL}`);
  console.log(`  Has error msg   : ${hasError ? 'YES' : 'NO'}`);
  console.log(`  Body snippet    : ${bodyText.slice(0, 150)}...`);

  await page.close();
}

async function main() {
  const browser = await chromium.launch();

  for (const c of CASES) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginViaUI(page, c.role);
    await page.close();
    await probeCase(ctx, c);
    await ctx.close();
  }

  await browser.close();
  console.log(
    '\n✓ Probe complete. Review output above to determine deny-behavior pattern.',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
