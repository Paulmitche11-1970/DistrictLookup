import Lookup from '@/components/lookup';
import { publicContent } from '@/lib/store';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default function Page() {
  return <Lookup content={publicContent()} embedded />;
}
