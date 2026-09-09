import { redirect } from 'next/navigation';
import { session } from '@/lib/security';
import AdminConsole from '@/components/admin-console';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function Page() {
  const s = await session();
  if (!s) redirect('/admin/login');
  if (s.stage === 'enroll') redirect('/admin/enroll');
  if (s.stage !== 'full' || !s.admin.totp_active) redirect('/admin/verify');
  return <AdminConsole />;
}
