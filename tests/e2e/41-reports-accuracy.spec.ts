import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';
import {
  seedExpenses,
  seedFuelRecords,
  readReportNumber,
  parseNumber,
  currentMonthRange,
} from '../utils/report-seeders';

test.use({ storageState: storageStatePath('owner') });
test.setTimeout(120_000);

const { midMonth } = currentMonthRange();

/**
 * prod has existing data — we use `>=` for sums (not `===`).
 * Tests verify: "after adding X to category Y, the total includes at least X".
 */

test.describe('ProfitLoss Report — Aggregations', () => {
  test('after seeding N expenses, total_expenses >= baseline + seeded', async ({
    page,
  }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle').catch(() => {});
    const baseline = await readReportNumber(page, 'report-pl-total-expenses');
    console.log(`[PL] baseline expenses: ${baseline}`);

    const seeded = await seedExpenses(page, {
      count: 3,
      amount: 100,
      category: 'office',
      date: midMonth,
    });
    console.log(`[PL] seeded: ${seeded}`);

    await page.goto('/reports');
    await page.waitForLoadState('networkidle').catch(() => {});
    const after = await readReportNumber(page, 'report-pl-total-expenses');
    console.log(`[PL] after seed: ${after}`);

    expect(after).toBeGreaterThanOrEqual(baseline + seeded - 0.01);
  });

  test('net_profit = total_income - total_expenses (within rounding)', async ({
    page,
  }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle').catch(() => {});
    const income = await readReportNumber(page, 'report-pl-total-income');
    const expenses = await readReportNumber(page, 'report-pl-total-expenses');
    const net = await readReportNumber(page, 'report-pl-net-profit');

    console.log(`[PL] income=${income}, expenses=${expenses}, net=${net}`);
    expect(net).toBeCloseTo(income - expenses, 0);
  });

  test('margin_percent ≈ (net / income) * 100', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle').catch(() => {});
    const income = await readReportNumber(page, 'report-pl-total-income');
    const net = await readReportNumber(page, 'report-pl-net-profit');
    const margin = await readReportNumber(page, 'report-pl-margin-percent');

    console.log(`[PL] margin: ${margin}% (net=${net}/income=${income})`);

    if (income > 0) {
      const expected = (net / income) * 100;
      expect(margin).toBeCloseTo(expected, 0);
    } else {
      expect(margin).not.toBeNaN();
    }
  });
});

test.describe('Accountant Report — VAT Calculations', () => {
  test('total = subtotal + vat (within rounding)', async ({ page }) => {
    await page.goto('/reports/accountant');
    await page.waitForLoadState('networkidle').catch(() => {});

    const subtotal = await readReportNumber(page, 'report-accountant-subtotal');
    const vat = await readReportNumber(page, 'report-accountant-vat-total');
    const total = await readReportNumber(page, 'report-accountant-total');

    console.log(`[ACC] subtotal=${subtotal}, vat=${vat}, total=${total}`);
    expect(total).toBeCloseTo(subtotal + vat, 0);
  });

  test('vat ratio to subtotal is in a plausible range (>0, <25%)', async ({
    page,
  }) => {
    await page.goto('/reports/accountant');
    await page.waitForLoadState('networkidle').catch(() => {});

    const subtotal = await readReportNumber(page, 'report-accountant-subtotal');
    const vat = await readReportNumber(page, 'report-accountant-vat-total');

    console.log(`[ACC] subtotal=${subtotal}, vat=${vat}`);

    if (subtotal > 0) {
      const ratio = vat / subtotal;
      console.log(`[ACC] vat/subtotal: ${(ratio * 100).toFixed(2)}%`);
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThan(0.25);
    }
  });

  test('invoices_count is non-negative integer', async ({ page }) => {
    await page.goto('/reports/accountant');
    await page.waitForLoadState('networkidle').catch(() => {});
    const count = await readReportNumber(page, 'report-accountant-invoices-count');
    console.log(`[ACC] invoices count: ${count}`);
    expect(count).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(count)).toBe(true);
  });
});

test.describe('Fuel Report — Aggregations', () => {
  test('after seeding fuel: total_liters and total_cost increase correctly', async ({
    page,
  }) => {
    await page.goto('/reports/fuel');
    await page.waitForLoadState('networkidle').catch(() => {});
    const baselineLiters = await readReportNumber(
      page,
      'report-fuel-total-liters',
    );
    const baselineCost = await readReportNumber(page, 'report-fuel-total-cost');
    console.log(`[FUEL] baseline: ${baselineLiters}L / ₪${baselineCost}`);

    const { totalLiters, totalCost } = await seedFuelRecords(page, {
      count: 2,
      liters: 50,
      pricePerLiter: 7.0,
      date: midMonth,
    });
    console.log(`[FUEL] seeded: ${totalLiters}L / ₪${totalCost}`);

    await page.goto('/reports/fuel');
    await page.waitForLoadState('networkidle').catch(() => {});
    const afterLiters = await readReportNumber(page, 'report-fuel-total-liters');
    const afterCost = await readReportNumber(page, 'report-fuel-total-cost');
    console.log(`[FUEL] after: ${afterLiters}L / ₪${afterCost}`);

    expect(afterLiters).toBeGreaterThanOrEqual(
      baselineLiters + totalLiters - 0.01,
    );
    expect(afterCost).toBeGreaterThanOrEqual(baselineCost + totalCost - 0.01);
  });

  test('avg_price_per_liter ≈ total_cost / total_liters', async ({ page }) => {
    await page.goto('/reports/fuel');
    await page.waitForLoadState('networkidle').catch(() => {});

    const totalCost = await readReportNumber(page, 'report-fuel-total-cost');
    const totalLiters = await readReportNumber(page, 'report-fuel-total-liters');
    const avgPrice = await readReportNumber(
      page,
      'report-fuel-avg-price-per-liter',
    );

    console.log(
      `[FUEL] cost=${totalCost} / liters=${totalLiters} → avg=${avgPrice}`,
    );

    if (totalLiters > 0) {
      const expected = totalCost / totalLiters;
      expect(avgPrice).toBeCloseTo(expected, 1);
    } else {
      expect(avgPrice).toBe(0);
    }
  });
});

test.describe('Workers Report — Per-Worker Profit', () => {
  test('for first N rows: profit = revenue - cost', async ({ page }) => {
    await page.goto('/reports/workers');
    await page.waitForLoadState('networkidle').catch(() => {});

    const rows = page.locator('[data-testid="report-workers-row"]');
    const count = await rows.count();
    console.log(`[WORKERS] row count: ${count}`);

    test.skip(count === 0, 'No worker rows on prod');

    for (let i = 0; i < Math.min(count, 3); i++) {
      const row = rows.nth(i);
      const revenue = parseNumber(
        await row
          .locator('[data-testid="report-workers-row-revenue"]')
          .textContent(),
      );
      const cost = parseNumber(
        await row
          .locator('[data-testid="report-workers-row-cost"]')
          .textContent(),
      );
      const profit = parseNumber(
        await row
          .locator('[data-testid="report-workers-row-profit"]')
          .textContent(),
      );
      console.log(
        `[WORKERS] row ${i}: revenue=${revenue}, cost=${cost}, profit=${profit}`,
      );
      expect(profit).toBeCloseTo(revenue - cost, 0);
    }
  });

  test('totals = sum of row values', async ({ page }) => {
    await page.goto('/reports/workers');
    await page.waitForLoadState('networkidle').catch(() => {});

    const rows = page.locator('[data-testid="report-workers-row"]');
    const count = await rows.count();
    test.skip(count === 0, 'No worker rows');

    let sumRevenue = 0;
    let sumCost = 0;
    let sumProfit = 0;
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      sumRevenue += parseNumber(
        await row
          .locator('[data-testid="report-workers-row-revenue"]')
          .textContent(),
      );
      sumCost += parseNumber(
        await row
          .locator('[data-testid="report-workers-row-cost"]')
          .textContent(),
      );
      sumProfit += parseNumber(
        await row
          .locator('[data-testid="report-workers-row-profit"]')
          .textContent(),
      );
    }

    const totalRevenue = await readReportNumber(
      page,
      'report-workers-total-revenue',
    );
    const totalCost = await readReportNumber(
      page,
      'report-workers-total-cost',
    );
    const totalProfit = await readReportNumber(
      page,
      'report-workers-total-profit',
    );

    console.log(
      `[WORKERS] sum rows: rev=${sumRevenue}, cost=${sumCost}, profit=${sumProfit}`,
    );
    console.log(
      `[WORKERS] totals:    rev=${totalRevenue}, cost=${totalCost}, profit=${totalProfit}`,
    );

    expect(totalRevenue).toBeCloseTo(sumRevenue, 0);
    expect(totalCost).toBeCloseTo(sumCost, 0);
    expect(totalProfit).toBeCloseTo(sumProfit, 0);
  });
});

test.describe.skip('CostAnalysis Report — Daily Calculations (TODO)', () => {
  test('per-vehicle daily costs proper division', async () => {
    // TODO: requires understanding the daily-divisor (working days? 365? 30?)
  });
});

test.describe.skip('BudgetReport — Planned vs Actual (TODO)', () => {
  test('actual matches sum of expenses in category', async () => {
    // TODO: requires isolating prior data
  });
});
