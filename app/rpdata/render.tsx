import { notFound } from 'next/navigation';
import { publicWebsitePage } from '@/lib/website-store';
import { WebsiteContent } from '@/components/website-content';
import { siteBase } from './site';
export function pageMetadata(slug: string) {
  const page = publicWebsitePage(slug);
  return page
    ? {
        title: page.title,
        description: page.description,
        alternates: { canonical: 'https://rpdata.net/' + page.slug },
      }
    : { title: 'Page not found', robots: { index: false, follow: false } };
}
export async function RenderPage({ slug }: { slug: string }) {
  const page = publicWebsitePage(slug);
  if (!page) notFound();
  return <WebsiteContent page={page} base={await siteBase()} />;
}
