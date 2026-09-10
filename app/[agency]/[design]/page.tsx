import { requireReviewAccess } from '@/lib/review-access';
import { notFound } from 'next/navigation';
import Lookup from '@/components/lookup';
import LookupVariant from '@/components/lookup-variants';
import AdminConsole from '@/components/admin-console';
import { publicContent, database } from '@/lib/store';
import { designs } from '@/lib/designs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Params = { params: Promise<{ agency: string; design: string }> };
export async function generateMetadata({ params }: Params) {
  const { design } = await params;
  const current = designs.find((d) => d.path.endsWith('/' + design));
  return {
    title: `Martinez | ${design === 'administration' ? 'Administration preview' : current?.name || 'District lookup'}`,
  };
}
export default async function Page({ params }: Params) {
  const { agency, design } = await params;
  if (agency.toLowerCase() !== 'martinez') notFound();
  if (design === 'administration') {
    await requireReviewAccess('martinez', '/martinez/administration');
    const count = database()
      .prepare('SELECT COUNT(*) AS n FROM addresses')
      .get() as { n: number };
    return (
      <AdminConsole
        previewContent={publicContent()}
        previewAddressCount={count.n}
      />
    );
  }
  const content = publicContent();
  const current =
    design === 'lookup'
      ? designs.find((d) => d.id === (content.agency.lookupDesign || 'classic'))
      : designs.find((d) => d.path.endsWith('/' + design));
  if (!current) notFound();
  return current.id === 'classic' ? (
    <Lookup content={content} />
  ) : (
    <LookupVariant content={content} design={current.id} />
  );
}
