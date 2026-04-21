import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';
import { testName } from '../utils/test-data';
import { findRowByText } from '../utils/master-helpers';
import {
  recordDebtPayment,
  todayISO,
  dateOffsetISO,
} from '../utils/finance-helpers';

test.use({ storageState: storageStatePath('owner') });
const M = 'debts' as const;

test.describe('Debts — Smoke', () => {
  test('الصפחה תפתחת', async ({ page }) => {
    await page.goto('/finance/debts');
    const owed = page.locator(`[data-testid="${M}-add-button-owed-to-me"]`);
    const iOwe = page.locator(`[data-testid="${M}-add-button-i-owe"]`);
    await expect(owed.or(iOwe).first()).toBeVisible();
  });
});

test.describe('Debts — CRUD', () => {
  test('add debt owed_to_me', async ({ page }) => {
    await page.goto('/finance/debts');
    await page
      .locator(`[data-testid="${M}-add-button-owed-to-me"]`)
      .click();
    await expect(page.locator(`[data-testid="${M}-form"]`)).toBeVisible();

    const counterparty = testName('debtor');
    await page
      .locator(`[data-testid="${M}-form-counterparty"]`)
      .fill(counterparty);
    await page
      .locator(`[data-testid="${M}-form-original-amount"]`)
      .fill('3000');
    await page
      .locator(`[data-testid="${M}-form-issue-date"]`)
      .fill(todayISO());
    const dueField = page.locator(`[data-testid="${M}-form-due-date"]`);
    if (await dueField.isVisible()) await dueField.fill(dateOffsetISO(30));

    await page.locator(`[data-testid="${M}-form-submit"]`).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    await expect(await findRowByText(page, M, counterparty)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('add payment to debt → status partial/paid', async ({ page }) => {
    await page.goto('/finance/debts');
    await page
      .locator(`[data-testid="${M}-add-button-owed-to-me"]`)
      .click();
    await expect(page.locator(`[data-testid="${M}-form"]`)).toBeVisible();

    const counterparty = testName('debt-pay');
    await page
      .locator(`[data-testid="${M}-form-counterparty"]`)
      .fill(counterparty);
    await page
      .locator(`[data-testid="${M}-form-original-amount"]`)
      .fill('1000');
    await page
      .locator(`[data-testid="${M}-form-issue-date"]`)
      .fill(todayISO());
    await page.locator(`[data-testid="${M}-form-submit"]`).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    // Partial payment
    const row = await findRowByText(page, M, counterparty);
    await row.locator(`[data-testid="${M}-row-add-payment"]`).click();

    const r1 = await recordDebtPayment(page, {
      amount: '400',
      paymentDate: todayISO(),
    });
    expect(r1.status).not.toBe('error');

    // Full remaining
    const row2 = await findRowByText(page, M, counterparty);
    await row2.locator(`[data-testid="${M}-row-add-payment"]`).click();
    const r2 = await recordDebtPayment(page, {
      amount: '600',
      paymentDate: todayISO(),
    });
    expect(r2.status).not.toBe('error');
  });
});
