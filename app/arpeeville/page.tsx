import { requireReviewAccess } from '@/lib/review-access';
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
  await requireReviewAccess('rp', '/arpeeville');
  return <DesignGallery content={inArpeeville(publicContent)} staff />;
}
