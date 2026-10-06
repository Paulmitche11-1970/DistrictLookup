import { inViewerAgency } from '@/lib/client-preview-access';
import { ClientPreviewStatus } from '@/components/client-preview-status';
import { clientPreviewPassword } from '@/lib/client-preview-token';
import {
  requireAgencyReviewAccess,
  hasReviewAccess,
  hasAgencySendingAccess,
} from '@/lib/review-access';
import { agencySendingPath } from '@/lib/agency-preview-token';
import { publicContent } from '@/lib/store';
import DesignGallery from '@/components/design-gallery';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = {
  title: 'Arpeeville design collection | RP Data',
  robots: { index: false, follow: false },
};
export default async function Page() {
  await requireAgencyReviewAccess('arpeeville', '/arpeeville');
  const staff =
    (await hasReviewAccess('rp')) &&
    !(await hasAgencySendingAccess('arpeeville'));
  return (
    <>
      <ClientPreviewStatus agencyId={'arpeeville'} />
      <DesignGallery
        content={await inViewerAgency('arpeeville', publicContent)}
        staff={staff}
        sendingPath={staff ? agencySendingPath('arpeeville') : undefined}
        previewPassword={
          staff ? clientPreviewPassword('arpeeville') : undefined
        }
      />
    </>
  );
}
