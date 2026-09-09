import { redirect } from 'next/navigation';
import { session } from '@/lib/security';
import { state } from '@/lib/store';
import Lookup from '@/components/lookup';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function Page() {
  const s = await session();
  if (!s || s.stage !== 'full' || !s.admin.totp_active)
    redirect('/admin/login');
  return <Lookup content={state().draft} preview />;
}
