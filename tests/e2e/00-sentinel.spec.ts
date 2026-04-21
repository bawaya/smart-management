import { test, expect } from '@playwright/test';
import {
  assertTestPrefix,
  testName,
  testId,
  testInvoiceNumber,
  testCheckNumber,
} from '../utils/test-data';

test.describe('Sentinel — Test Data Safety Guards', () => {
  test('assertTestPrefix يسمح بـ TEST_ فقط', () => {
    expect(() => assertTestPrefix('TEST_equip_abc')).not.toThrow();
    expect(() => assertTestPrefix('real_data')).toThrow(/Safety violation/);
    expect(() => assertTestPrefix('')).toThrow();
    expect(() => assertTestPrefix('test_lowercase')).toThrow(); // lowercase مرفوض
  });

  test('testName يولّد prefix صحيح + unique', () => {
    const names = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const n = testName('equip');
      expect(n).toMatch(/^TEST_equip_[a-f0-9]{6}$/);
      names.add(n);
    }
    expect(names.size).toBe(100); // لا تصادم
  });

  test('testId يولّد prefix صحيح + unique', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const id = testId('worker');
      expect(id).toMatch(/^TEST_worker_[a-f0-9]{16}$/);
      ids.add(id);
    }
    expect(ids.size).toBe(100);
  });

  test('testInvoiceNumber — TEST_INV_ prefix', () => {
    const n = testInvoiceNumber();
    expect(n).toMatch(/^TEST_INV_[A-F0-9]{8}$/);
  });

  test('testCheckNumber — TEST_ prefix + 6 digits', () => {
    const n = testCheckNumber();
    expect(n).toMatch(/^TEST_\d{6}$/);
  });
});
