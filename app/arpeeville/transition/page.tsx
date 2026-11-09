import TransitionPage from '../../[agency]/transition/page';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Arpeeville | Incoming board preview',
  robots: { index: false, follow: false },
};
export default function Page({
  searchParams,
}: {
  searchParams: Promise<{
    key?: string;
    demo?: string;
    design?: string;
    official?: string;
  }>;
}) {
  return TransitionPage({
    params: Promise.resolve({ agency: 'arpeeville' }),
    searchParams,
  });
}
