import { notFound, redirect } from 'next/navigation';
import { inAgency } from '@/lib/agency-scope';
import { instanceFor, adminPath } from '@/lib/instances';
import { session } from '@/lib/security';
import AdminConsole from '@/components/admin-console';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function Page({
  params,
}: {
  params: Promise<{ agency: string }>;
}) {
  const instance = instanceFor((await params).agency);
  if (!instance) notFound();
  if (instance.sandbox) redirect('/arpeeville/administration');
  const s = await inAgency(instance.id, session);
  const base = adminPath(instance.id);
  if (!s) redirect(base + '/login');
  if (s.stage === 'enroll') redirect(base + '/enroll');
  if (s.stage !== 'full' || !s.admin.totp_active) redirect(base + '/verify');
  return <AdminConsole agencyId={instance.id} />;
}
