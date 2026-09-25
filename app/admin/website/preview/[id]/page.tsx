import { notFound } from 'next/navigation';
import { requireReviewAccess } from '@/lib/review-access';
import { websiteRecord, publicWebsite } from '@/lib/website-store';
import { WebsiteShell, WebsiteContent } from '@/components/website-content';
import type { WebsiteSettings } from '@/lib/website-model';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Private draft preview',
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireReviewAccess('rp', '/admin/website/preview/' + id);
  let record;
  try {
    record = websiteRecord(id);
  } catch {
    notFound();
  }
  const live = publicWebsite();
  const settings =
    id === 'settings' ? (record.draft as WebsiteSettings) : live.settings;
  const page =
    record.draft.kind === 'page'
      ? record.draft
      : live.pages.find((p) => !p.slug)!;
  return (
    <>
      <aside
        style={{
          background: '#e2c78b',
          color: '#183e43',
          padding: '14px 24px',
          textAlign: 'center',
        }}
      >
        Private draft preview · This is not the published website.{' '}
        <a href="/admin/website">Return to editor</a>
      </aside>
      <WebsiteShell settings={settings} pages={live.pages} base="/rpdata">
        <WebsiteContent page={page} base="/rpdata" />
      </WebsiteShell>
    </>
  );
}
