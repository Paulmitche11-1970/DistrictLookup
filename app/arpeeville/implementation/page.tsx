import AgencyImplementation from '@/app/[agency]/implementation/page';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = {
  title: 'Use your Arpeeville lookup | RP Data',
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <AgencyImplementation params={Promise.resolve({ agency: 'arpeeville' })} />
  );
}
