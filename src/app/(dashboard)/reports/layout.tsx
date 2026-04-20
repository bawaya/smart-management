import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { type Role, hasPermission } from '@/lib/auth/rbac';
import { ReportsNav } from './ReportsNav';

export default async function ReportsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const userRole = (headers().get('x-user-role') ?? '') as Role;

  if (!hasPermission(userRole, 'reports')) {
    redirect('/');
  }

  return (
    <div className="space-y-4">
      <ReportsNav />
      <div>{children}</div>
    </div>
  );
}
