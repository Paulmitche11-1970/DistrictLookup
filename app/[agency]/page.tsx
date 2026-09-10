import { notFound } from 'next/navigation';
import DesignGallery from '@/components/design-gallery';
import { publicContent } from '@/lib/store';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = {
  title: 'Martinez design collection | Redistricting Partners',
};
export default async function Page({
  params,
}: {
  params: Promise<{ agency: string }>;
}) {
  if ((await params).agency.toLowerCase() !== 'martinez') notFound();
  return <DesignGallery content={publicContent()} />;
}
