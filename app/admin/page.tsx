import { requireReviewAccess } from '@/lib/review-access';
import AgencyAdministration from '@/components/agency-administration';
import { instances } from '@/lib/instances';
import { agencySendingPath } from '@/lib/agency-preview-token';
import { clientPreviewPassword } from '@/lib/client-preview-token';
import { inAgency } from '@/lib/agency-scope';
import { clientPreviewEdited } from '@/lib/store';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'RP administration | RP Data' };
export default async function Page() {
  await requireReviewAccess('rp', '/admin');
  return (
    <AgencyAdministration
      team
      previewEdits={Object.fromEntries(
        instances.map((a) => [a.id, inAgency(a.id, clientPreviewEdited)]),
      )}
      previewPasswords={Object.fromEntries(
        instances.map((a) => [a.id, clientPreviewPassword(a.id)]),
      )}
      sendingLinks={Object.fromEntries(
        instances.map((agency) => [agency.id, agencySendingPath(agency.id)]),
      )}
    />
  );
}
