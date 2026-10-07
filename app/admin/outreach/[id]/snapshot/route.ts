import { hasReviewAccess } from '@/lib/review-access';
import { implementationSnapshot } from '@/lib/implementation-store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await hasReviewAccess('rp')))
    return Response.json(
      { error: 'RP team sign-in required.' },
      { status: 401 },
    );
  const { id } = await params;
  const snapshot = implementationSnapshot(id);
  if (!snapshot) return new Response('Not found', { status: 404 });
  return new Response(snapshot, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="submitted-preview-${id}.json"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
