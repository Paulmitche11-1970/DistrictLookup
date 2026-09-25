import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { hasReviewAccess } from '@/lib/review-access';
import { isWebsiteMediaPublished, websiteDataDir } from '@/lib/website-store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-f0-9]{32}$/.test(id))
    return new Response('Not found', { status: 404 });
  if (!isWebsiteMediaPublished(id) && !(await hasReviewAccess('rp')))
    return new Response('Not found', { status: 404 });
  try {
    return new Response(
      await readFile(path.join(websiteDataDir(), 'media', id + '.webp')),
      {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'",
        },
      },
    );
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
