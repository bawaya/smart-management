import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { SettingsNav } from './SettingsNav';

export const runtime = 'edge';

interface SettingRow {
  value: string;
}

export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = headers();
  const userRole = requestHeaders.get('x-user-role') ?? '';
  const tenantId = requestHeaders.get('x-tenant-id') ?? 'default';

  if (userRole !== 'owner') {
    redirect('/');
  }

  const db = getDb();
  const labelRow = await db.queryOne<SettingRow>(
    "SELECT value FROM settings WHERE tenant_id = ? AND key = 'equipment_label_he'",
    [tenantId],
  );

  const equipmentLabel = labelRow?.value?.trim() || 'ציוד';

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">הגדרות</h1>
      <div className="flex flex-col md:flex-row gap-6">
        <SettingsNav equipmentLabel={equipmentLabel} />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
