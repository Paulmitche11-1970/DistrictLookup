import {
  requireAgencyReviewAccess,
  hasReviewAccess,
  hasAgencySendingAccess,
} from '@/lib/review-access';
import { agencySendingPath } from '@/lib/agency-preview-token';
import { inArpeeville } from '@/lib/agency-scope';
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
    <DesignGallery
      content={inArpeeville(publicContent)}
      staff={staff}
      sendingPath={staff ? agencySendingPath('arpeeville') : undefined}
    />
  );
}
