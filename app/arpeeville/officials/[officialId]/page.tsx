import { OfficialBiographyPage } from '@/components/official-biography-page';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = {
  title: 'Arpeeville | Official biography',
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ officialId: string }>;
  searchParams: Promise<{ preview?: string; design?: string }>;
}) {
  const { officialId } = await params;
  const query = await searchParams;
  return (
    <OfficialBiographyPage
      agencyId="arpeeville"
      officialId={officialId}
      preview={query.preview === '1'}
      design={query.design}
    />
  );
}
