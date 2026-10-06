import {
  inViewerAgency,
  hasClientPreviewAccess,
} from '@/lib/client-preview-access';
import { ClientPreviewStatus } from '@/components/client-preview-status';
import { notFound } from 'next/navigation';
import {
  requireReviewAccess,
  requireAgencyReviewAccess,
} from '@/lib/review-access';
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
    if (await hasClientPreviewAccess('arpeeville'))
      return <AdminConsole agencyId={'arpeeville'} clientPreview />;
    await requireAgencyReviewAccess('arpeeville', '/arpeeville/administration');
    return <AdminConsole sandbox agencyId="arpeeville" />;
  }
  const clientPreview = await hasClientPreviewAccess('arpeeville');
  const preview = design === 'preview' && !clientPreview;
  if (preview) await requireReviewAccess('rp', '/arpeeville/preview');
  const content = await inViewerAgency('arpeeville', () =>
    preview ? state().draft : publicContent(),
  );
  const requested = (await searchParams).design;
  const current = ['lookup', 'embed', 'preview'].includes(design)
    ? designs.find(
        (d) => d.id === (requested || content.agency.lookupDesign || 'classic'),
      )
    : designs.find((d) => d.path.endsWith('/' + design));
  if (!current) notFound();
  return (
    <>
      <ClientPreviewStatus agencyId={'arpeeville'} />
      {current.id === 'classic' ? (
        <Lookup
          content={content}
          preview={preview}
          embedded={design === 'embed'}
        />
      ) : (
        <LookupVariant
          content={content}
          design={current.id}
          preview={preview}
          embedded={design === 'embed'}
        />
      )}
    </>
  );
}
