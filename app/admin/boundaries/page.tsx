import BoundaryLibrary from '@/components/boundary-library';
import { requireReviewAccess } from '@/lib/review-access';
import {
  boundaryAgencies,
  boundaryCategories,
  boundaryImportDate,
} from '@/lib/boundary-catalog';
export const metadata = {
  title: 'Boundary library | RP administration',
  robots: { index: false, follow: false },
};
export default async function Page() {
  await requireReviewAccess('rp', '/admin/boundaries');
  return (
    <BoundaryLibrary
      agencies={boundaryAgencies}
      categories={boundaryCategories}
      importedAt={boundaryImportDate}
    />
  );
}
