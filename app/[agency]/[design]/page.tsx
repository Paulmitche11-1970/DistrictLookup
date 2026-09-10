import { requireReviewAccess } from '@/lib/review-access';
import { notFound, redirect } from 'next/navigation';
import Lookup from '@/components/lookup';
import LookupVariant from '@/components/lookup-variants';
import AdminConsole from '@/components/admin-console';
import { publicContent, database, state } from '@/lib/store';
import { designs } from '@/lib/designs';
import { inAgency } from '@/lib/agency-scope';
import { instanceFor, adminPath } from '@/lib/instances';
import { session } from '@/lib/security';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Props = {
  params: Promise<{ agency: string; design: string }>;
  searchParams: Promise<{ design?: string }>;
};
export async function generateMetadata({ params }: Props) {
  const { agency, design } = await params;
  const current = designs.find((d) => d.path.endsWith('/' + design));
  return {
    title: `${instanceFor(agency)?.shortName || 'Agency'} | ${design === 'administration' ? 'Administration preview' : current?.name || 'District lookup'}`,
  };
}
export default async function Page({ params, searchParams }: Props) {
  const { agency, design } = await params;
  const instance = instanceFor(agency);
  if (!instance) notFound();
  if (design === 'administration') {
    await requireReviewAccess(
      instance.id === 'martinez' ? 'martinez' : 'rp',
      '/' + instance.id + '/administration',
    );
    const count = inAgency(instance.id, () =>
      database().prepare('SELECT COUNT(*) AS n FROM addresses').get(),
    ) as { n: number };
    return (
      <AdminConsole
        agencyId={instance.id}
        previewContent={inAgency(instance.id, publicContent)}
        previewAddressCount={count.n}
      />
    );
  }
  const preview = design === 'preview';
  if (preview) {
    const s = await inAgency(instance.id, session);
    if (!s || s.stage !== 'full' || !s.admin.totp_active)
      redirect(adminPath(instance.id) + '/login');
  }
  const content = inAgency(instance.id, () =>
    preview ? state().draft : publicContent(),
  );
  const requested = (await searchParams).design;
  const current = ['lookup', 'embed', 'preview'].includes(design)
    ? designs.find(
        (d) => d.id === (requested || content.agency.lookupDesign || 'classic'),
      )
    : designs.find((d) => d.path.endsWith('/' + design));
  if (!current) notFound();
  return current.id === 'classic' ? (
    <Lookup content={content} preview={preview} embedded={design === 'embed'} />
  ) : (
    <LookupVariant
      content={content}
      design={current.id}
      preview={preview}
      embedded={design === 'embed'}
    />
  );
}
