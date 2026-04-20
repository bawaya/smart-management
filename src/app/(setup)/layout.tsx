import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth/jwt';
import { SetupProvider } from './setup-context';

export default async function SetupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const token = cookies().get('auth-token')?.value;
  const payload = token ? await verifyToken(token) : null;

  if (!payload) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <SetupProvider userId={payload.userId} tenantId={payload.tenantId}>
        {children}
      </SetupProvider>
    </div>
  );
}
