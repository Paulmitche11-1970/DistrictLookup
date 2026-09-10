import { requireReviewAccess, hasReviewAccess } from '@/lib/review-access';
import { notFound } from 'next/navigation';
import DesignGallery from '@/components/design-gallery';
import { publicContent } from '@/lib/store';
import { instanceFor } from '@/lib/instances';
import { inAgency } from '@/lib/agency-scope';
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
  await requireReviewAccess(
    instance.id === 'martinez' ? 'martinez' : 'rp',
    '/' + instance.id,
  );
  return (
    <DesignGallery
      content={inAgency(instance.id, publicContent)}
      staff={await hasReviewAccess('rp')}
    />
  );
}
