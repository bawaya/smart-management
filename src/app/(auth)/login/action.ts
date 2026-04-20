'use server';

import { redirect } from 'next/navigation';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, destroySession } from '@/lib/auth/session';
import { getDb, getTenantId } from '@/lib/db';

export type LoginResult =
  | { success: true; mustChangePassword: boolean; isSetupComplete: boolean }
  | { success: false; error: string };

const INVALID_CREDENTIALS = 'اسم المستخدم أو كلمة المرور غلط';

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  must_change_password: number;
}

interface SettingRow {
  value: string;
}

export async function loginAction(formData: FormData): Promise<LoginResult> {
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!username || !password) {
    return { success: false, error: INVALID_CREDENTIALS };
  }

  const db = getDb();
  const tenantId = getTenantId();

  const user = await db.queryOne<UserRow>(
    'SELECT id, username, password_hash, role, must_change_password FROM users WHERE tenant_id = ? AND username = ? AND is_active = 1',
    [tenantId, username],
  );

  if (!user) {
    return { success: false, error: INVALID_CREDENTIALS };
  }

  const passwordOk = await verifyPassword(password, user.password_hash);
  if (!passwordOk) {
    return { success: false, error: INVALID_CREDENTIALS };
  }

  await createSession(user.id, user.role, user.username, tenantId);

  const setupRow = await db.queryOne<SettingRow>(
    "SELECT value FROM settings WHERE tenant_id = ? AND key = 'is_setup_complete'",
    [tenantId],
  );

  return {
    success: true,
    mustChangePassword: user.must_change_password === 1,
    isSetupComplete: (setupRow?.value ?? 'false') === 'true',
  };
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/login');
}
