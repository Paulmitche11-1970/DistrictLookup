import { RenderPage, pageMetadata } from '../render';
export const dynamic = 'force-dynamic';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return pageMetadata((await params).slug);
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <RenderPage slug={(await params).slug} />;
}
