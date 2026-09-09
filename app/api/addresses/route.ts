import { addressSearch, publicContent } from '@/lib/store';
import { locate } from '@/lib/geo';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q') || '';
  if (q.length > 120) return Response.json({ addresses: [] });
  const map = publicContent().map;
  const addresses = addressSearch(q)
    .filter((a) => locate(map, a))
    .slice(0, 8);
  return Response.json(
    { addresses },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
