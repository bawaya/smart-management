import { randomBytes } from 'node:crypto';

/**
 * توليد اسم اختباري يبدأ دايماً بـ TEST_
 * - prefix: وصف (مثلاً 'equip', 'worker', 'invoice')
 * - suffix: 6 hex chars عشوائية لتجنب التصادم
 */
export function testName(prefix: string): string {
  const suffix = randomBytes(3).toString('hex');
  return `TEST_${prefix}_${suffix}`;
}

/**
 * توليد ID اختباري للـ TEXT PKs في D1.
 */
export function testId(entity: string): string {
  const suffix = randomBytes(8).toString('hex');
  return `TEST_${entity}_${suffix}`;
}

/**
 * رقم فاتورة اختباري — TEST_INV_ + random
 * (invoice_number له UNIQUE constraint per tenant)
 */
export function testInvoiceNumber(): string {
  const suffix = randomBytes(4).toString('hex').toUpperCase();
  return `TEST_INV_${suffix}`;
}

/**
 * رقم شيك اختباري — طوله محدد 6-9 حرف عشان واقعي
 */
export function testCheckNumber(): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `TEST_${n}`;
}

/**
 * Guard: يرفض أي قيمة ما بتبدأ بـ TEST_
 * استخدمه قبل أي cleanup حتى لو بالغلط مرّرنا قيمة حقيقية.
 */
export function assertTestPrefix(value: string): void {
  if (!value.startsWith('TEST_')) {
    throw new Error(`Safety violation: value "${value}" does not start with TEST_`);
  }
}
