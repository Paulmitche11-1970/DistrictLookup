import { notFound } from 'next/navigation';
import { requireReviewAccess } from '@/lib/review-access';
import { inArpeeville } from '@/lib/agency-scope';
import { publicContent, state } from '@/lib/store';
import { designs } from '@/lib/designs';
import Lookup from '@/components/lookup';
import LookupVariant from '@/components/lookup-variants';
import AdminConsole from '@/components/admin-console';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = {
  title: 'Arpeeville | RP Data',
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ design: string }>;
  searchParams: Promise<{ design?: string }>;
}) {
  const { design } = await params;
  if (design === 'administration') {
    await requireReviewAccess('rp', '/arpeeville/administration');
    return <AdminConsole sandbox agencyId="arpeeville" />;
  }
  const preview = design === 'preview';
  if (preview) await requireReviewAccess('rp', '/arpeeville/preview');
  const content = inArpeeville(() =>
    preview ? state().draft : publicContent(),
  );
  const requested = (await searchParams).design;
  const current = ['lookup', 'embed', 'preview'].includes(design)
    ? designs.find(
        (d) => d.id === (requested || content.agency.lookupDesign || 'classic'),
      )
    : designs.find((d) => d.path.endsWith('/' + design));
  if (!current) notFound();
  return current.id === 'classic' ? (
    <Lookup content={content} preview={preview} embedded={design === 'embed'} />
  ) : (
    <LookupVariant
      content={content}
      design={current.id}
      preview={preview}
      embedded={design === 'embed'}
    />
  );
}
