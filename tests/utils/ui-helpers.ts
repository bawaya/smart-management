import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * ينتظر الـ Server Action + revalidation + DOM re-render.
 * networkidle يغطي الطلبات، لكن revalidatePath يأخذ tick إضافي بعد ذلك قبل
 * ما الـ RSC flight يعود والـ list يُعاد render. 300ms settle time يتغلب
 * على الـ flakiness في معظم الحالات.
 */
export async function waitForServerAction(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {
    /* best-effort */
  });
  await page.waitForTimeout(300);
}

/**
 * يضغط submit ويستنى النتيجة (نجاح أو فشل).
 * يرجع 'success' أو 'error' + النص إن وجد.
 */
export async function submitAndWait(
  page: Page,
  submitSelector: string,
): Promise<{
  status: 'success' | 'error' | 'unknown';
  message: string | null;
}> {
  await page.locator(submitSelector).click();

  const successToast = page.locator('[data-testid="toast-success"]');
  const errorToast = page.locator('[data-testid="toast-error"]');
  const formError = page.locator('[data-testid="equipment-form-error"]');

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
    // لا toast ولا error — ممكن الـ form سكّر صامت
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

/**
 * يعدّ rows في list بالـ testid المحدّد.
 */
export async function countRows(
  page: Page,
  listTestId: string,
  rowTestId: string,
): Promise<number> {
  const list = page.locator(`[data-testid="${listTestId}"]:visible`);
  return list.locator(`[data-testid="${rowTestId}"]`).count();
}

/**
 * يتحقق إن row فيه النص المطلوب موجود في list.
 */
export async function expectRowWithText(
  page: Page,
  rowTestId: string,
  text: string,
): Promise<Locator> {
  const row = page
    .locator(`[data-testid="${rowTestId}"]:visible`)
    .filter({ hasText: text });
  await expect(row.first()).toBeVisible({ timeout: 10_000 });
  return row.first();
}

/**
 * Dismiss أي toast ظاهر (لتجنب تداخل بين tests).
 */
export async function dismissToasts(page: Page): Promise<void> {
  await page.evaluate(() => {
    document
      .querySelectorAll('[data-testid^="toast-"]')
      .forEach((el) => el.remove());
  });
}
