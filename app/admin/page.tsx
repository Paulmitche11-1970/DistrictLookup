import { requireReviewAccess } from '@/lib/review-access';
import AgencyAdministration from '@/components/agency-administration';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'RP administration | RP Data' };
export default async function Page() {
  await requireReviewAccess('rp', '/admin');
  return <AgencyAdministration team />;
}
