import { notFound } from 'next/navigation';
import BoundaryViewer from '@/components/boundary-viewer';
import { boundaryFor } from '@/lib/boundary-catalog';
import { readBoundaryMap } from '@/lib/boundary-library';
import { requireReviewAccess } from '@/lib/review-access';
export const metadata = {
  title: 'Boundary review | RP administration',
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireReviewAccess('rp', '/admin/boundaries/' + id);
  const agency = boundaryFor(id);
  if (!agency) notFound();
  const geo = await readBoundaryMap(id);
  return <BoundaryViewer agency={agency} geo={geo} />;
}
