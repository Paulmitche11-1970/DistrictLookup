import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { dataDir, state } from '@/lib/store';
import { session } from '@/lib/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-f0-9]{32}$/.test(id))
    return new Response('Not found', { status: 404 });
  const { published } = state();
  const visible =
    published.agency.showPhotos &&
    published.officials.some((o) => o.photo === '/api/photos/' + id);
  const s = visible ? null : await session();
  if (!visible && (!s || s.stage !== 'full' || !s.admin.totp_active))
    return new Response('Not found', { status: 404 });
  try {
    const file = await readFile(path.join(dataDir(), 'uploads', id + '.webp'));
    return new Response(file, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'",
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
