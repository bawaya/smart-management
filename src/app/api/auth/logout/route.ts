import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth/session';

export const runtime = 'edge';

export async function POST(): Promise<NextResponse<{ success: true }>> {
  await destroySession();
  return NextResponse.json({ success: true });
}
