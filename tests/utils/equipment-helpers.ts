import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { submitAndWait, waitForServerAction } from './ui-helpers.js';

export type EquipmentStatusValue =
  | 'available'
  | 'deployed'
  | 'maintenance'
  | 'retired';

export type EquipmentInput = {
  name: string;
  equipment_type_id?: string; // optional — يختار الأول لو موجود
  identifier?: string;
  status?: 'available' | 'deployed' | 'maintenance' | 'retired';
  insurance_expiry?: string; // ISO date YYYY-MM-DD
  license_expiry?: string;
  last_maintenance?: string;
  notes?: string;
};

export async function openAddEquipmentForm(page: Page): Promise<void> {
  await page.locator('[data-testid="equipment-add-button"]').click();
  await expect(page.locator('[data-testid="equipment-form"]')).toBeVisible({
    timeout: 5_000,
  });
}

export async function fillEquipmentForm(
  page: Page,
  data: EquipmentInput,
): Promise<void> {
  await page.locator('[data-testid="equipment-form-name"]').fill(data.name);

  // equipment type dropdown — الـ first option defaulted by React useState;
  // override only if caller specified one.
  const typeSelect = page.locator('[data-testid="equipment-form-type"]');
  if (data.equipment_type_id) {
    await typeSelect.selectOption(data.equipment_type_id);
  }

  if (data.identifier !== undefined) {
    await page
      .locator('[data-testid="equipment-form-identifier"]')
      .fill(data.identifier);
  }
  if (data.status) {
    await page
      .locator('[data-testid="equipment-form-status"]')
      .selectOption(data.status);
  }
  if (data.insurance_expiry !== undefined) {
    await page
      .locator('[data-testid="equipment-form-insurance-expiry"]')
      .fill(data.insurance_expiry);
  }
  if (data.license_expiry !== undefined) {
    await page
      .locator('[data-testid="equipment-form-license-expiry"]')
      .fill(data.license_expiry);
  }
  if (data.last_maintenance !== undefined) {
    await page
      .locator('[data-testid="equipment-form-last-maintenance"]')
      .fill(data.last_maintenance);
  }
  if (data.notes !== undefined) {
    await page.locator('[data-testid="equipment-form-notes"]').fill(data.notes);
  }
}

export async function submitEquipmentForm(page: Page) {
  return submitAndWait(page, '[data-testid="equipment-form-submit"]');
}

export async function addEquipment(page: Page, data: EquipmentInput) {
  await openAddEquipmentForm(page);
  await fillEquipmentForm(page, data);
  const result = await submitEquipmentForm(page);
  await waitForServerAction(page);
  return result;
}

export async function findEquipmentRow(page: Page, name: string) {
  return page
    .locator('[data-testid="equipment-row"]:visible')
    .filter({ hasText: name })
    .first();
}

export async function openEditByName(page: Page, name: string) {
  const row = await findEquipmentRow(page, name);
  await row.locator('[data-testid="equipment-row-edit"]').click();
  await expect(page.locator('[data-testid="equipment-form"]')).toBeVisible({
    timeout: 5_000,
  });
}

/**
 * يغيّر status عبر QuickStatusModal.
 * UI pattern: click-to-submit — clicking a status option IS the submit action.
 * No separate submit button, no notes field.
 */
export async function changeStatusByName(
  page: Page,
  name: string,
  newStatus: 'available' | 'deployed' | 'maintenance' | 'retired',
): Promise<{ status: 'success' | 'error' | 'unknown'; message: string | null }> {
  const row = await findEquipmentRow(page, name);
  await row.locator('[data-testid="equipment-row-status-change"]').click();

  const modal = page.locator('[data-testid="equipment-status-modal"]');
  await expect(modal).toBeVisible({ timeout: 5_000 });

  // Click-to-submit — the option click triggers updateEquipmentStatusAction directly.
  const option = modal.locator(
    `[data-testid="equipment-status-option-${newStatus}"]`,
  );
  await option.click();

  await waitForServerAction(page);

  // Success: modal closes (unmounted) + toast-success appears on parent
  const successToast = page.locator('[data-testid="toast-success"]');
  const errorDiv = page.locator('[data-testid="equipment-status-error"]');

  try {
    await Promise.race([
      modal.waitFor({ state: 'hidden', timeout: 5_000 }).then(() => 'success'),
      errorDiv
        .waitFor({ state: 'visible', timeout: 5_000 })
        .then(() => 'error'),
    ]);
  } catch {
    /* fall through */
  }

  if (await errorDiv.isVisible().catch(() => false)) {
    return { status: 'error', message: await errorDiv.textContent() };
  }
  if (await modal.isHidden().catch(() => false)) {
    const msg = await successToast
      .textContent()
      .catch(() => null);
    return { status: 'success', message: msg };
  }
  return { status: 'unknown', message: null };
}
