import { headers } from 'next/headers';
import { HelpContent } from './HelpContent';

export default async function HelpPage() {
  const userRole = headers().get('x-user-role') ?? '';
  return <HelpContent isOwner={userRole === 'owner'} />;
}
