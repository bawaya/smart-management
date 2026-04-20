import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import { UsersManager, type UserRow } from './UsersManager';

export const runtime = 'edge';

export default async function UsersPage() {
  const requestHeaders = headers();
  const tenantId = requestHeaders.get('x-tenant-id') ?? 'default';
  const currentUserId = requestHeaders.get('x-user-id') ?? '';

  const db = getDb();
  const users = await db.query<UserRow>(
    'SELECT id, username, full_name, email, phone, role, is_active, must_change_password FROM users WHERE tenant_id = ? ORDER BY is_active DESC, username',
    [tenantId],
  );

  return (
    <UsersManager
      tenantId={tenantId}
      currentUserId={currentUserId}
      users={users}
    />
  );
}
