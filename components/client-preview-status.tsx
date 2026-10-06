import { hasClientPreviewAccess } from '@/lib/client-preview-access';
import { inAgency } from '@/lib/agency-scope';
import { inClientPreview } from '@/lib/client-preview-scope';
import { state } from '@/lib/store';
import { ClientPreviewBanner } from './client-preview-banner';
export async function ClientPreviewStatus({ agencyId }: { agencyId: string }) {
  if (!(await hasClientPreviewAccess(agencyId))) return null;
  const data = inAgency(agencyId, () => inClientPreview(state));
  return (
    <ClientPreviewBanner
      agencyId={agencyId}
      edited={data.previewEdited}
      revision={data.revision}
    />
  );
}
