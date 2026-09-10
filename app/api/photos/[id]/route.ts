import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { dataDir, publicContent } from '@/lib/store';
import { requireAdmin } from '@/lib/security';
import { photoPrefix } from '@/lib/agency-scope';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-f0-9]{32}$/.test(id))
    return new Response('Not found', { status: 404 });
  const published = publicContent();
  const visible =
    published.agency.showPhotos &&
    (published.officials.some((o) => o.photo === photoPrefix() + id) ||
      published.management?.some((p) => p.photo === photoPrefix() + id));
  if (!visible) {
    try {
      await requireAdmin();
    } catch {
      return new Response('Not found', { status: 404 });
    }
  }
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
