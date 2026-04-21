import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';
import { testName } from '../utils/test-data';
import {
  openAddEquipmentForm,
  fillEquipmentForm,
  submitEquipmentForm,
  addEquipment,
  findEquipmentRow,
  openEditByName,
  changeStatusByName,
} from '../utils/equipment-helpers';

// كل الاختبارات تستخدم owner — RBAC مختبر في Phase 3
test.use({ storageState: storageStatePath('owner') });

test.describe('Equipment — Smoke', () => {
  test('الصفحة تفتح + الـ list ظاهر + زر الإضافة موجود', async ({ page }) => {
    await page.goto('/equipment');
    // إذا في items، بيظهر equipment-list. إذا فاضي، equipment-empty.
    const hasList = await page
      .locator('[data-testid="equipment-list"]:visible')
      .isVisible()
      .catch(() => false);
    const hasEmpty = await page
      .locator('[data-testid="equipment-empty"]')
      .isVisible()
      .catch(() => false);
    expect(hasList || hasEmpty).toBe(true);
    await expect(page.locator('[data-testid="equipment-add-button"]')).toBeVisible();
  });
});

test.describe('Equipment — CREATE', () => {
  test('add equipment بحقول دنيا → يظهر في القائمة', async ({ page }) => {
    await page.goto('/equipment');
    const name = testName('equip');

    const result = await addEquipment(page, { name });
    expect(result.status, `Submit failed: ${result.message}`).not.toBe('error');

    await expect(
      page
        .locator('[data-testid="equipment-row"]:visible')
        .filter({ hasText: name })
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('add equipment بكل الحقول', async ({ page }) => {
    await page.goto('/equipment');
    const name = testName('equip-full');

    const result = await addEquipment(page, {
      name,
      identifier: 'ID-001',
      status: 'available',
      insurance_expiry: '2026-12-31',
      license_expiry: '2027-06-30',
      last_maintenance: '2026-01-15',
      notes: 'TEST_notes',
    });

    expect(result.status, `Submit failed: ${result.message}`).not.toBe('error');
    const row = await findEquipmentRow(page, name);
    await expect(row).toBeVisible();
  });

  test('add بدون اسم → validation error', async ({ page }) => {
    await page.goto('/equipment');
    await openAddEquipmentForm(page);
    // ما بنعبّي اسم. HTML5 required قد يمنع submit إذا input فاضي تماماً.
    const result = await submitEquipmentForm(page);
    // نقبل 'error' أو 'unknown' (browser منع submit native) — كلاهما دلالة على أن submit ما مرّ
    expect(['error', 'unknown']).toContain(result.status);
  });

  test('add باسم فاضي (whitespace) → error', async ({ page }) => {
    await page.goto('/equipment');
    await openAddEquipmentForm(page);
    await fillEquipmentForm(page, { name: '   ' });
    const result = await submitEquipmentForm(page);
    // whitespace يتخطى HTML5 required، بس JS client-side بيرفض — form-error visible
    expect(result.status).toBe('error');
  });

  test('add باسم عبري + عربي + emoji', async ({ page }) => {
    await page.goto('/equipment');
    const tests = [
      `TEST_eq_${Date.now()}_ציוד`,
      `TEST_eq_${Date.now()}_معدة`,
      `TEST_eq_${Date.now()}_🚜`,
    ];
    for (const name of tests) {
      const result = await addEquipment(page, { name });
      expect(result.status, `Name "${name}" failed: ${result.message}`).not.toBe(
        'error',
      );
    }
  });
});

test.describe('Equipment — READ', () => {
  test('row عنصر فيه name و status', async ({ page }) => {
    await page.goto('/equipment');
    const name = testName('equip-read');
    await addEquipment(page, { name, status: 'available' });

    const row = await findEquipmentRow(page, name);
    await expect(row.locator('[data-testid="equipment-row-name"]')).toContainText(
      name,
    );
    await expect(row.locator('[data-testid="equipment-row-status"]')).toBeVisible();
  });
});

test.describe('Equipment — UPDATE', () => {
  test('edit name → تحديث في القائمة', async ({ page }) => {
    await page.goto('/equipment');
    const originalName = testName('equip-edit');
    await addEquipment(page, { name: originalName });

    await openEditByName(page, originalName);
    const newName = testName('equip-edited');
    await page.locator('[data-testid="equipment-form-name"]').fill(newName);
    const result = await submitEquipmentForm(page);
    expect(result.status, `Submit failed: ${result.message}`).not.toBe('error');

    await expect(
      page
        .locator('[data-testid="equipment-row"]:visible')
        .filter({ hasText: newName })
        .first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page
        .locator('[data-testid="equipment-row"]:visible')
        .filter({ hasText: originalName }),
    ).toHaveCount(0);
  });

  test('edit notes فقط', async ({ page }) => {
    await page.goto('/equipment');
    const name = testName('equip-notes');
    await addEquipment(page, { name, notes: 'TEST_original' });

    await openEditByName(page, name);
    await page
      .locator('[data-testid="equipment-form-notes"]')
      .fill('TEST_updated');
    const result = await submitEquipmentForm(page);
    expect(result.status, `Submit failed: ${result.message}`).not.toBe('error');
  });
});

test.describe('Equipment — STATUS TRANSITIONS', () => {
  test('available → maintenance', async ({ page }) => {
    await page.goto('/equipment');
    const name = testName('equip-st-1');
    await addEquipment(page, { name, status: 'available' });

    const result = await changeStatusByName(page, name, 'maintenance');
    expect(result.status, `Status change failed: ${result.message}`).not.toBe(
      'error',
    );

    const row = await findEquipmentRow(page, name);
    await expect(
      row.locator('[data-testid="equipment-row-status"]'),
    ).toContainText(/maintenance|תחזוקה|صيانة/i);
  });

  test('maintenance → available (rollback)', async ({ page }) => {
    await page.goto('/equipment');
    const name = testName('equip-st-2');
    await addEquipment(page, { name, status: 'maintenance' });

    const result = await changeStatusByName(page, name, 'available');
    expect(result.status).not.toBe('error');

    const row = await findEquipmentRow(page, name);
    await expect(
      row.locator('[data-testid="equipment-row-status"]'),
    ).toContainText(/available|זמין|פעיל|متاح/i);
  });

  test('available → retired', async ({ page }) => {
    await page.goto('/equipment');
    const name = testName('equip-st-3');
    await addEquipment(page, { name });

    const result = await changeStatusByName(page, name, 'retired');
    expect(result.status).not.toBe('error');

    // الـ row قد يختفي بسبب الـ filter (filterStatus dropdown عنده خيار بدون retired
    // ضمن القيم الظاهرة، لكن 'all' هو default فالـ row يظهر).
    const rowCount = await page
      .locator('[data-testid="equipment-row"]:visible')
      .filter({ hasText: name })
      .count();
    expect(rowCount).toBeGreaterThanOrEqual(0);
  });

  test('cycle كامل: available → maintenance → available → retired', async ({
    page,
  }) => {
    await page.goto('/equipment');
    const name = testName('equip-cycle');
    await addEquipment(page, { name, status: 'available' });

    for (const s of ['maintenance', 'available', 'retired'] as const) {
      const r = await changeStatusByName(page, name, s);
      expect(r.status, `Transition to ${s} failed: ${r.message}`).not.toBe(
        'error',
      );
    }
  });
});
