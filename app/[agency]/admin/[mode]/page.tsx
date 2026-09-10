import { notFound } from 'next/navigation';
import { instanceFor } from '@/lib/instances';
import AuthForm from '@/components/auth-form';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: {
  params: Promise<{ agency: string; mode: string }>;
}) {
  const { agency, mode } = await params;
  const instance = instanceFor(agency);
  if (
    !instance ||
    instance.sandbox ||
    !['login', 'setup', 'enroll', 'verify'].includes(mode)
  )
    notFound();
  return (
    <AuthForm
      agencyId={instance.id}
      mode={mode as 'login' | 'setup' | 'enroll' | 'verify'}
    />
  );
}
