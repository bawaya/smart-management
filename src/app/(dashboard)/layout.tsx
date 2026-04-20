import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { getDb } from '@/lib/db';
import { getExpiryAlerts } from '@/lib/utils/expiry-alerts';

interface SettingRow {
  value: string;
}

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = headers();
  const userRole = requestHeaders.get('x-user-role') ?? '';
  const username = requestHeaders.get('x-user-username') ?? '';
  const tenantId = requestHeaders.get('x-tenant-id') ?? 'default';

  const db = getDb();
  const [companyRow, labelRow, setupRow] = await Promise.all([
    db.queryOne<SettingRow>(
      "SELECT value FROM settings WHERE tenant_id = ? AND key = 'company_name'",
      [tenantId],
    ),
    db.queryOne<SettingRow>(
      "SELECT value FROM settings WHERE tenant_id = ? AND key = 'equipment_label_he'",
      [tenantId],
    ),
    db.queryOne<SettingRow>(
      "SELECT value FROM settings WHERE tenant_id = ? AND key = 'is_setup_complete'",
      [tenantId],
    ),
  ]);

  if ((setupRow?.value ?? 'false') !== 'true') {
    redirect('/setup');
  }

  const companyName = companyRow?.value?.trim() || undefined;
  const equipmentLabel = labelRow?.value?.trim() || 'ציוד';

  const alerts = await getExpiryAlerts(tenantId);

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <Sidebar
        userRole={userRole}
        username={username}
        companyName={companyName}
        equipmentLabel={equipmentLabel}
        alertsCount={alerts.length}
      />
      <div className="md:pr-[260px] print:pr-0">
        <Header username={username} />
        <main className="p-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
