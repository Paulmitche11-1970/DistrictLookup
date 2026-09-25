import type { Metadata } from 'next';
import { siteBase } from './site';
import { publicWebsite } from '@/lib/website-store';
import { WebsiteShell } from '@/components/website-content';
export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const { settings } = publicWebsite();
  return {
    title: {
      default: settings.siteName + ' | ' + settings.tagline,
      template: '%s | ' + settings.siteName,
    },
    description: settings.description,
    robots: { index: true, follow: true },
    icons: { icon: '/rpdata-mark.svg' },
  };
}
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { settings, pages } = publicWebsite();
  return (
    <WebsiteShell settings={settings} pages={pages} base={await siteBase()}>
      {children}
    </WebsiteShell>
  );
}
