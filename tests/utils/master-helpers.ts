import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { submitAndWait, waitForServerAction } from './ui-helpers.js';

type SubmitResult = {
  status: 'success' | 'error' | 'unknown';
  message: string | null;
};

/**
 * Generic helper for master-data modules that follow the Phase 5B pattern:
 * - <module>-add-button → opens <module>-form
 * - Form fields: <module>-form-<field>
 * - <module>-form-submit / -cancel / -error
 * - List: <module>-list / -row / -empty
 * - Row actions: <module>-row-edit / -row-toggle / -row-delete
 * - Toggle modal: <module>-toggle-modal / -toggle-confirm / -toggle-cancel / -toggle-error
 */

export type ModuleName =
  | 'vehicles'
  | 'workers'
  | 'equipment-types'
  | 'clients'
  | 'fuel'
  | 'expenses'
  | 'daily-log'
  | 'invoices'
  | 'budget'
  | 'bank-accounts'
  | 'credit-cards'
  | 'checks'
  | 'standing-orders'
  | 'transactions'
  | 'debts'
  | 'reconciliation';

export async function openAddForm(page: Page, module: ModuleName): Promise<void> {
  await page.locator(`[data-testid="${module}-add-button"]`).click();
  await expect(page.locator(`[data-testid="${module}-form"]`)).toBeVisible({
    timeout: 5_000,
  });
}

/**
 * Fill form fields by testid. Keys are field suffixes (e.g. 'name', 'phone', 'daily-rate').
 * Auto-detects input type (select/textarea/input) and uses the right method.
 * Fieldsets (like vehicles-form-type radios) require manual handling — pass { type: 'radio', value: ... }.
 */
export async function fillFormFields(
  page: Page,
  module: ModuleName,
  fields: Record<string, string | { type: 'radio'; value: string }>,
): Promise<void> {
  for (const [field, value] of Object.entries(fields)) {
    const testid = `${module}-form-${field}`;
    // Use .first() to tolerate cases where modal + inline edit briefly coexist
    // (e.g. equipment-types where the same testid could theoretically appear twice).
    const locator = page.locator(`[data-testid="${testid}"]`).first();

    if (typeof value === 'object' && value.type === 'radio') {
      const radio = locator.locator(`input[type="radio"][value="${value.value}"]`);
      // sr-only radios (visually hidden) can't be clicked normally because the
      // wrapping <label> intercepts pointer events. force:true bypasses that.
      await radio.check({ force: true });
      continue;
    }

    const tag = await locator
      .evaluate((el) => el.tagName.toLowerCase())
      .catch(() => 'input');

    if (tag === 'select') {
      await locator.selectOption(value as string);
    } else {
      await locator.fill(value as string);
    }
  }
}

export async function submitForm(
  page: Page,
  module: ModuleName,
): Promise<SubmitResult> {
  const submitBtn = page.locator(`[data-testid="${module}-form-submit"]`);

  // If the button is disabled (e.g. empty required field client-side gate),
  // we can't click it — treat that as 'unknown' (submit never happened).
  const isDisabled = await submitBtn.isDisabled().catch(() => false);
  if (isDisabled) {
    return { status: 'unknown', message: null };
  }

  await submitBtn.click();

  const successToast = page.locator('[data-testid="toast-success"]');
  const errorToast = page.locator('[data-testid="toast-error"]');
  const formError = page.locator(`[data-testid="${module}-form-error"]`);

  try {
    await Promise.race([
      successToast
        .waitFor({ state: 'visible', timeout: 5_000 })
        .then(() => 'success'),
      errorToast
        .waitFor({ state: 'visible', timeout: 5_000 })
        .then(() => 'error'),
      formError
        .waitFor({ state: 'visible', timeout: 5_000 })
        .then(() => 'error'),
    ]);
  } catch {
    await waitForServerAction(page);
  }

  if (await successToast.isVisible().catch(() => false)) {
    return { status: 'success', message: await successToast.textContent() };
  }
  if (await errorToast.isVisible().catch(() => false)) {
    return { status: 'error', message: await errorToast.textContent() };
  }
  if (await formError.isVisible().catch(() => false)) {
    return { status: 'error', message: await formError.textContent() };
  }
  return { status: 'unknown', message: null };
}

export async function cancelForm(page: Page, module: ModuleName): Promise<void> {
  await page.locator(`[data-testid="${module}-form-cancel"]`).click();
  await expect(page.locator(`[data-testid="${module}-form"]`)).toBeHidden({
    timeout: 5_000,
  });
}

/**
 * Returns a locator for the row with the given text. Waits up to 15s for the
 * row to appear — Server Action revalidatePath can take an extra tick after
 * networkidle before the RSC flight re-renders the list.
 */
export async function findRowByText(page: Page, module: ModuleName, text: string) {
  const locator = page
    .locator(`[data-testid="${module}-list"]:visible`)
    .locator(`[data-testid="${module}-row"]`)
    .filter({ hasText: text })
    .first();
  await expect(locator).toBeVisible({ timeout: 15_000 });
  return locator;
}

export async function editByText(
  page: Page,
  module: ModuleName,
  text: string,
): Promise<void> {
  const row = await findRowByText(page, module, text);
  await row.locator(`[data-testid="${module}-row-edit"]`).click({ timeout: 5_000 });
  // -form-submit is present in every edit variant (modal with form wrapper +
  // equipment-types inline edit). Safer than waiting on -form-name, since
  // different modules use different name-field suffixes (e.g. workers uses
  // -form-full-name, clients uses -form-name).
  await expect(
    page.locator(`[data-testid="${module}-form-submit"]`).first(),
  ).toBeVisible({ timeout: 5_000 });
}

/**
 * Toggle active status via confirmation modal.
 * Returns the modal result (success/error/unknown).
 */
export async function toggleByText(
  page: Page,
  module: ModuleName,
  text: string,
): Promise<{ status: 'success' | 'error' | 'unknown'; message: string | null }> {
  const row = await findRowByText(page, module, text);
  await row.locator(`[data-testid="${module}-row-toggle"]`).click();

  const modal = page.locator(`[data-testid="${module}-toggle-modal"]`);
  await expect(modal).toBeVisible({ timeout: 5_000 });

  const result = await submitAndWait(page, `[data-testid="${module}-toggle-confirm"]`);
  await waitForServerAction(page);
  return result;
}

/**
 * Hard delete (equipment-types only). Other modules use toggleByText.
 */
export async function deleteByText(
  page: Page,
  module: ModuleName,
  text: string,
): Promise<{ status: 'success' | 'error' | 'unknown'; message: string | null }> {
  const row = await findRowByText(page, module, text);
  await row.locator(`[data-testid="${module}-row-delete"]`).click();

  const modal = page.locator(`[data-testid="${module}-delete-modal"]`);
  const hasModal = await modal.isVisible({ timeout: 2_000 }).catch(() => false);
  if (hasModal) {
    const result = await submitAndWait(
      page,
      `[data-testid="${module}-delete-confirm"]`,
    );
    await waitForServerAction(page);
    return result;
  }

  await waitForServerAction(page);
  return { status: 'success', message: null };
}

/**
 * Count visible rows in a module list.
 */
export async function countRows(page: Page, module: ModuleName): Promise<number> {
  return page
    .locator(`[data-testid="${module}-list"]:visible`)
    .locator(`[data-testid="${module}-row"]`)
    .count();
}

/**
 * Check if row is marked active via data-<module>-active="1" attribute
 * (added in Phase 5B-1 as unified attribute).
 */
export async function isRowActive(
  page: Page,
  module: ModuleName,
  text: string,
): Promise<boolean> {
  const row = await findRowByText(page, module, text);
  const attr = await row.getAttribute(`data-${module}-active`);
  return attr === '1';
}

/**
 * Full add helper: open + fill + submit.
 */
export async function addEntry(
  page: Page,
  module: ModuleName,
  fields: Record<string, string | { type: 'radio'; value: string }>,
) {
  await openAddForm(page, module);
  await fillFormFields(page, module, fields);
  const result = await submitForm(page, module);
  await waitForServerAction(page);
  return result;
}
