import { NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { getDb, getTenantId } from '@/lib/db';

export const runtime = 'edge';

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

export type LoginResponse =
  | { success: true; mustChangePassword: boolean; isSetupComplete: boolean }
  | { success: false; error: string };

export async function POST(request: Request): Promise<NextResponse<LoginResponse>> {
  let payload: { username?: unknown; password?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: INVALID_CREDENTIALS },
      { status: 400 },
    );
  }

  const username =
    typeof payload.username === 'string' ? payload.username.trim() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';

  if (!username || !password) {
    return NextResponse.json(
      { success: false, error: INVALID_CREDENTIALS },
      { status: 400 },
    );
  }

  const db = getDb();
  const tenantId = getTenantId();

  const user = await db.queryOne<UserRow>(
    'SELECT id, username, password_hash, role, must_change_password FROM users WHERE tenant_id = ? AND username = ? AND is_active = 1',
    [tenantId, username],
  );

  if (!user) {
    return NextResponse.json(
      { success: false, error: INVALID_CREDENTIALS },
      { status: 401 },
    );
  }

  const passwordOk = await verifyPassword(password, user.password_hash);
  if (!passwordOk) {
    return NextResponse.json(
      { success: false, error: INVALID_CREDENTIALS },
      { status: 401 },
    );
  }

  await createSession(user.id, user.role, user.username, tenantId);

  const setupRow = await db.queryOne<SettingRow>(
    "SELECT value FROM settings WHERE tenant_id = ? AND key = 'is_setup_complete'",
    [tenantId],
  );

  return NextResponse.json({
    success: true,
    mustChangePassword: user.must_change_password === 1,
    isSetupComplete: (setupRow?.value ?? 'false') === 'true',
  });
}
