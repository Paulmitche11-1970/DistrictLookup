import { requireReviewAccess } from '@/lib/review-access';
import { websiteRecords, websiteMedia } from '@/lib/website-store';
import WebsiteAdmin from '@/components/website-admin';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'RP Data website editor',
  robots: { index: false, follow: false },
};
export default async function Page() {
  await requireReviewAccess('rp', '/admin/website');
  return (
    <WebsiteAdmin
      initialRecords={websiteRecords()}
      initialMedia={websiteMedia()}
    />
  );
}
