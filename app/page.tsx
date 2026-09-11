import { requireReviewAccess } from '@/lib/review-access';
import InstanceDirectory from '@/components/instance-directory';
import { publicContent } from '@/lib/store';
import { boundaryDirectoryEntries } from '@/lib/boundary-catalog';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'RP Data Voter Lookup Instances' };
export default async function Home() {
  await requireReviewAccess('rp', '/');
  return (
    <InstanceDirectory
      content={publicContent()}
      boundaries={boundaryDirectoryEntries}
    />
  );
}
