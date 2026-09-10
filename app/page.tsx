import InstanceDirectory from '@/components/instance-directory';
import { publicContent } from '@/lib/store';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'RP Data Voter Lookup Instances' };
export default function Home() {
  return <InstanceDirectory content={publicContent()} />;
}
