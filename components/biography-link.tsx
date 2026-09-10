import { ArrowUpRight } from 'lucide-react';
import type { Agency, Official } from '@/lib/model';
import type { DesignId } from '@/lib/designs';
import { biographyPath, hasBiography } from '@/lib/biography';

export function BiographyLink({
  official,
  agency,
  preview = false,
  design = 'classic',
}: {
  official: Official;
  agency: Agency;
  preview?: boolean;
  design?: DesignId;
}) {
  if (
    agency.showBiographies === false ||
    official.vacant ||
    !hasBiography(official)
  )
    return null;
  const agencyId =
    agency.instanceId || (agency.sandbox ? 'arpeeville' : 'martinez');
  return (
    <a
      className="biography-link"
      href={biographyPath(agencyId, official.id, preview, design)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Biography of ${official.name} (opens in a new tab)`}
    >
      Biography <ArrowUpRight size={15} aria-hidden="true" />
    </a>
  );
}
