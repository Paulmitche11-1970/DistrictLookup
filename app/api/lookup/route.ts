import { addressById, publicContent, state } from '@/lib/store';
import { locate } from '@/lib/geo';
import { requireAdmin, errorResponse } from '@/lib/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    if (params.get('preview') === '1') await requireAdmin();
    const content =
      params.get('preview') === '1' ? state().draft : publicContent();
    const address = addressById(params.get('id') || '');
    if (!address)
      return Response.json(
        { error: 'Choose an address from this agency’s search suggestions.' },
        { status: 404 },
      );
    const district = locate(content.map, address);
    if (!district)
      return Response.json(
        {
          error:
            'This address cannot be assigned confidently to a district. Please contact the agency.',
        },
        { status: 422 },
      );
    return Response.json(
      { address, district },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
