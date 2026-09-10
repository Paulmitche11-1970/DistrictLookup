import Lookup from '@/components/lookup';
import LookupVariant from '@/components/lookup-variants';
import { designs } from '@/lib/designs';
import { publicContent } from '@/lib/store';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ design?: string }>;
}) {
  const requested = (await searchParams).design;
  const design = designs.find((item) => item.id === requested)?.id || 'classic';
  const content = publicContent();
  return design === 'classic' ? (
    <Lookup content={content} embedded />
  ) : (
    <LookupVariant content={content} design={design} embedded />
  );
}
