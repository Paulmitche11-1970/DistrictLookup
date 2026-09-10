import { redirect } from 'next/navigation';
import { session } from '@/lib/security';
import { state } from '@/lib/store';
import Lookup from '@/components/lookup';
import LookupVariant from '@/components/lookup-variants';
import { designs } from '@/lib/designs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ design?: string }>;
}) {
  const s = await session();
  if (!s || s.stage !== 'full' || !s.admin.totp_active)
    redirect('/admin/login');
  const requested = (await searchParams).design;
  const content = state().draft;
  const design =
    designs.find((item) => item.id === requested)?.id ||
    content.agency.lookupDesign ||
    'classic';
  return design === 'classic' ? (
    <Lookup content={content} preview />
  ) : (
    <LookupVariant content={content} design={design} preview />
  );
}
