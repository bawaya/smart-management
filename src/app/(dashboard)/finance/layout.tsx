import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { type Role, hasPermission } from '@/lib/auth/rbac';
import { FinanceNav } from './FinanceNav';

export default async function FinanceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const userRole = (headers().get('x-user-role') ?? '') as Role;

  if (!hasPermission(userRole, 'finance')) {
    redirect('/');
  }

  return (
    <div className="space-y-4">
      <FinanceNav />
      <div>{children}</div>
    </div>
  );
}
