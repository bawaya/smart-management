'use server';

import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import type { Role } from '@/lib/auth/rbac';
import { getDb, type BatchStatement } from '@/lib/db';
import {
  BUDGET_CATEGORIES,
  type BudgetCategory,
} from '@/lib/utils/budget-types';

export interface BudgetItem {
  category: string;
  amount: string;
}

export type BudgetMutationResult =
  | { success: true }
  | { success: false; error: string };

const BUDGET_ROLES: readonly Role[] = ['owner', 'accountant'];

async function requireBudgetRole(): Promise<
  { tenantId: string; userId: string; role: Role } | { error: string }
> {
  const token = cookies().get('auth-token')?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return { error: 'אין הרשאה' };
  const role = payload.role as Role;
  if (!BUDGET_ROLES.includes(role)) return { error: 'אין הרשאה' };
  return { tenantId: payload.tenantId, userId: payload.userId, role };
}

function generateId(): string {
  return randomBytes(16).toString('hex');
}

function normalizeAmount(v: string | undefined | null): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function isValidCategory(c: string): c is BudgetCategory {
  return (BUDGET_CATEGORIES as readonly string[]).includes(c);
}

export async function saveBudgetAction(
  tenantId: string,
  year: number,
  month: number | null,
  items: BudgetItem[],
): Promise<BudgetMutationResult> {
  const auth = await requireBudgetRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };

  if (!Number.isInteger(year) || year < 2000 || year > 3000) {
    return { success: false, error: 'שנה לא חוקית' };
  }
  if (month != null && (!Number.isInteger(month) || month < 1 || month > 12)) {
    return { success: false, error: 'חודש לא חוקי' };
  }

  const cleaned: Array<{ category: BudgetCategory; amount: number }> = [];
  const seen = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!isValidCategory(it.category)) continue;
    if (seen.has(it.category)) continue;
    seen.add(it.category);
    const amount = normalizeAmount(it.amount);
    if (amount > 0) cleaned.push({ category: it.category, amount });
  }

  const statements: BatchStatement[] = [];
  if (month == null) {
    statements.push({
      sql: 'DELETE FROM budgets WHERE tenant_id = ? AND budget_year = ? AND budget_month IS NULL',
      params: [tenantId, year],
    });
  } else {
    statements.push({
      sql: 'DELETE FROM budgets WHERE tenant_id = ? AND budget_year = ? AND budget_month = ?',
      params: [tenantId, year, month],
    });
  }

  for (const { category, amount } of cleaned) {
    statements.push({
      sql: 'INSERT INTO budgets (id, tenant_id, budget_year, budget_month, category, planned_amount, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      params: [generateId(), tenantId, year, month, category, amount, auth.userId],
    });
  }

  const db = getDb();
  await db.batch(statements);

  return { success: true };
}
