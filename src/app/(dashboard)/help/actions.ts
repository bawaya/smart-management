'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth/jwt';
import { getDb } from '@/lib/db';

export async function resetSetupAction(): Promise<void> {
  const token = cookies().get('auth-token')?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) throw new Error('אין הרשאה');
  if (payload.role !== 'owner') throw new Error('אין הרשאה');

  const db = getDb();
  await db
    .prepare(
      "UPDATE settings SET value = 'false', updated_at = datetime('now') WHERE tenant_id = ? AND key = 'is_setup_complete'",
    )
    .bind(payload.tenantId)
    .run();
  await db
    .prepare(
      "UPDATE tenants SET is_setup_complete = 0, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(payload.tenantId)
    .run();

  redirect('/setup');
}
