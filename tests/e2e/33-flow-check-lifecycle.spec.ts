import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';
import { testName, testCheckNumber } from '../utils/test-data';
import {
  ensureTestBankAccount,
  todayISO,
  dateOffsetISO,
} from '../utils/finance-helpers';
import { changeCheckStatus, getCheckStatus } from '../utils/flow-helpers';

test.use({ storageState: storageStatePath('owner') });
test.setTimeout(120_000);

async function createIncomingCheck(
  page: Page,
  payerName: string,
): Promise<string> {
  await ensureTestBankAccount(page);
  await page.goto('/finance/checks');
  await page
    .locator('[data-testid="checks-add-button-incoming"]')
    .click();
  await expect(page.locator('[data-testid="checks-form"]')).toBeVisible({
    timeout: 5_000,
  });

  const bankSelect = page.locator('[data-testid="checks-form-bank-account-id"]');
  const firstBank = await bankSelect
    .locator('option')
    .nth(1)
    .getAttribute('value');
  if (!firstBank) throw new Error('No bank account available');

  const checkNum = testCheckNumber();
  await bankSelect.selectOption(firstBank);
  await page
    .locator('[data-testid="checks-form-check-number"]')
    .fill(checkNum);
  await page.locator('[data-testid="checks-form-amount"]').fill('3000');
  await page
    .locator('[data-testid="checks-form-payee-or-payer"]')
    .fill(payerName);
  await page
    .locator('[data-testid="checks-form-issue-date"]')
    .fill(todayISO());
  await page
    .locator('[data-testid="checks-form-due-date"]')
    .fill(dateOffsetISO(15));
  await page.locator('[data-testid="checks-form-submit"]').click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  return checkNum;
}

test.describe('Flow E — Check Lifecycle (happy path)', () => {
  test('incoming: pending → deposited → cleared', async ({ page }) => {
    const payer = testName('check-payer');
    const checkNum = await createIncomingCheck(page, payer);
    console.log(`[E] ✓ Check created: ${checkNum} / payer=${payer}`);

    const initial = await getCheckStatus(page, payer);
    console.log(`[E]   initial status: ${initial}`);

    // → deposited
    const r1 = await changeCheckStatus(page, payer, 'deposited');
    expect(r1.status, `→ deposited failed: ${r1.message}`).not.toBe('error');
    const afterDeposit = await getCheckStatus(page, payer);
    console.log(`[E] ✓ after deposit: ${afterDeposit}`);

    // → cleared
    const r2 = await changeCheckStatus(page, payer, 'cleared');
    expect(r2.status, `→ cleared failed: ${r2.message}`).not.toBe('error');
    const afterClear = await getCheckStatus(page, payer);
    console.log(`[E] ✓ after clear: ${afterClear}`);
    expect(afterClear.toLowerCase()).toMatch(/cleared|נפרע/i);
  });
});

test.describe('Flow E — Check Bounce (edge case)', () => {
  test('incoming: deposited → bounced with reason', async ({ page }) => {
    const payer = testName('check-bounce');
    const checkNum = await createIncomingCheck(page, payer);
    console.log(`[E-B] ✓ Check created: ${checkNum}`);

    const r1 = await changeCheckStatus(page, payer, 'deposited');
    expect(r1.status).not.toBe('error');

    const r2 = await changeCheckStatus(page, payer, 'bounced', {
      bounceReason: 'TEST_insufficient_funds',
    });
    expect(r2.status, `→ bounced failed: ${r2.message}`).not.toBe('error');

    const afterBounce = await getCheckStatus(page, payer);
    console.log(`[E-B] ✓ after bounce: ${afterBounce}`);
    expect(afterBounce.toLowerCase()).toMatch(/bounced|חזר|הוחזר/i);
  });

  test('bounced → cleared (documents recovery behavior)', async ({ page }) => {
    const payer = testName('check-bnc-clr');
    await createIncomingCheck(page, payer);

    await changeCheckStatus(page, payer, 'deposited');
    await changeCheckStatus(page, payer, 'bounced', {
      bounceReason: 'TEST_test',
    });

    const result = await changeCheckStatus(page, payer, 'cleared');
    console.log(
      `[E-B2] bounced → cleared: status=${result.status} (${result.message ?? 'no msg'})`,
    );

    const finalStatus = await getCheckStatus(page, payer);
    console.log(`[E-B2] final status: ${finalStatus}`);
    // Documenting — valid either way. Just assert finalStatus is readable.
    expect(finalStatus).toBeTruthy();
  });
});
