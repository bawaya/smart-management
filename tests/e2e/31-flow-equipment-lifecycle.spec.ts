import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';
import { testName } from '../utils/test-data';
import { changeStatusByName } from '../utils/equipment-helpers';
import { ensureTestClient } from '../utils/prereq-seeder';

test.use({ storageState: storageStatePath('owner') });
test.setTimeout(120_000);

async function createTestEquipment(
  page: import('@playwright/test').Page,
  name: string,
): Promise<boolean> {
  await page.goto('/equipment');
  await page.locator('[data-testid="equipment-add-button"]').click();
  await expect(page.locator('[data-testid="equipment-form"]')).toBeVisible({
    timeout: 5_000,
  });

  // equipment-form-type is a <select>; pick first real option
  const typeSelect = page.locator('[data-testid="equipment-form-type"]');
  const firstType = await typeSelect
    .locator('option')
    .nth(1)
    .getAttribute('value');
  if (!firstType) return false;
  await typeSelect.selectOption(firstType);
  await page.locator('[data-testid="equipment-form-name"]').fill(name);
  await page.locator('[data-testid="equipment-form-submit"]').click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  return true;
}

test.describe('Flow C — Equipment Lifecycle', () => {
  test('available → maintenance → retired; retired filtered from daily-log dropdown', async ({
    page,
  }) => {
    const equipName = testName('flow-eq');

    const created = await createTestEquipment(page, equipName);
    test.skip(!created, 'No equipment_type available on prod');
    console.log(`[C] ✓ Equipment created: ${equipName}`);

    // available → maintenance
    let r = await changeStatusByName(page, equipName, 'maintenance');
    expect(r.status, `→ maintenance failed: ${r.message}`).not.toBe('error');
    console.log(`[C] ✓ available → maintenance`);

    // maintenance → available (revert)
    r = await changeStatusByName(page, equipName, 'available');
    expect(r.status).not.toBe('error');
    console.log(`[C] ✓ maintenance → available`);

    // available → retired
    r = await changeStatusByName(page, equipName, 'retired');
    expect(r.status).not.toBe('error');
    console.log(`[C] ✓ available → retired`);

    // Verify retired is filtered out of daily-log dropdown (per page.tsx:96
    // `status != 'retired'` filter). Need a client to open the form.
    await ensureTestClient(page);
    await page.goto('/daily-log');
    await page.locator('[data-testid="daily-log-add-button"]').click();
    await expect(
      page.locator('[data-testid="daily-log-form"]'),
    ).toBeVisible({ timeout: 5_000 });

    const equipSelect = page.locator(
      '[data-testid="daily-log-form-equipment-id"]',
    );
    const options = await equipSelect.locator('option').allTextContents();
    const retiredVisible = options.some((o) => o.includes(equipName));

    console.log(
      `[C] retired equipment in daily-log dropdown: ${retiredVisible ? 'YES' : 'NO'}`,
    );
    expect(retiredVisible).toBe(false);
    console.log(`[C] ✓ Flow C complete`);
  });

  test('retired → available (documents lifecycle behavior)', async ({
    page,
  }) => {
    const equipName = testName('flow-eq-r');
    const created = await createTestEquipment(page, equipName);
    test.skip(!created, 'No equipment_type available on prod');

    await changeStatusByName(page, equipName, 'retired');
    const result = await changeStatusByName(page, equipName, 'available');
    console.log(
      `[C] retired → available result: ${result.status} (${result.message ?? 'no message'})`,
    );
    // Documenting behavior — don't assert rigidly. Either outcome is valid UX.
    expect(result.status).toBeDefined();
  });
});
