import { inViewerAgency } from '@/lib/client-preview-access';
import { ClientPreviewStatus } from '@/components/client-preview-status';
import { clientPreviewPassword } from '@/lib/client-preview-token';
import {
  requireAgencyReviewAccess,
  hasReviewAccess,
  hasAgencySendingAccess,
} from '@/lib/review-access';
import { agencySendingPath } from '@/lib/agency-preview-token';
import { notFound } from 'next/navigation';
import DesignGallery from '@/components/design-gallery';
import { publicContent } from '@/lib/store';
import { instanceFor } from '@/lib/instances';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Props = { params: Promise<{ agency: string }> };
export async function generateMetadata({ params }: Props) {
  return {
    title: `${instanceFor((await params).agency)?.shortName || 'Agency'} design collection | RP Data`,
  };
}
export default async function Page({ params }: Props) {
  const instance = instanceFor((await params).agency);
  if (!instance) notFound();
  await requireAgencyReviewAccess(instance.id, '/' + instance.id);
  const staff =
    (await hasReviewAccess('rp')) &&
    !(await hasAgencySendingAccess(instance.id));
  return (
    <>
      <ClientPreviewStatus agencyId={instance.id} />
      <DesignGallery
        content={await inViewerAgency(instance.id, publicContent)}
        staff={staff}
        sendingPath={staff ? agencySendingPath(instance.id) : undefined}
        previewPassword={staff ? clientPreviewPassword(instance.id) : undefined}
      />
    </>
  );
}
