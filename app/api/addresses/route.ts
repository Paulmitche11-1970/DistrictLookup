import {
  addressSearch,
  publicContent,
  randomArpeevilleAddresses,
  normalizeSearch,
} from '@/lib/store';
import { currentAgencyId } from '@/lib/agency-scope';
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
  if (currentAgencyId() === 'arpeeville' && normalizeSearch(q)) {
    const matchedIds = new Set(addresses.map((a) => a.id));
    const extraCount = addresses.length ? 5 : 6;
    const candidates = randomArpeevilleAddresses().filter(
      (a) => !matchedIds.has(a.id) && locate(map, a),
    );
    // Offer a mix of districts as well as different street names in the demo.
    const districts = new Set<string>();
    const extras = candidates
      .filter((a) => {
        const district = locate(map, a)!;
        if (districts.has(district)) return false;
        districts.add(district);
        return true;
      })
      .slice(0, extraCount);
    const chosenIds = new Set(extras.map((a) => a.id));
    extras.push(
      ...candidates
        .filter((a) => !chosenIds.has(a.id))
        .slice(0, extraCount - extras.length),
    );
    addresses.push(...extras);
  }
  return Response.json(
    { addresses },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
