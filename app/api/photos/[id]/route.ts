import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { photoDirectory, publicContent, state } from '@/lib/store';
import { requireAdmin } from '@/lib/security';
import { photoPrefix, currentAgencyId } from '@/lib/agency-scope';
import { hasClientPreviewAccess } from '@/lib/client-preview-access';
import { isClientPreview } from '@/lib/client-preview-scope';
import { biographyImages } from '@/lib/biography-html';
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
  let visible =
    published.agency.showPhotos &&
    (published.officials.some(
      (o) =>
        o.photo === photoPrefix() + id ||
        (!o.vacant && biographyImages(o).includes(photoPrefix() + id)),
    ) ||
      published.management?.some((p) => p.photo === photoPrefix() + id));
  // Existing published portraits may be hidden by a display preference, but
  // agency reviewers must be able to try enabling them. Never expose live drafts.
  if (
    !visible &&
    !isClientPreview() &&
    (await hasClientPreviewAccess(currentAgencyId()))
  ) {
    const prepared = state().published;
    visible =
      prepared.officials.some(
        (o) =>
          o.photo === photoPrefix() + id ||
          biographyImages(o).includes(photoPrefix() + id),
      ) || prepared.management?.some((p) => p.photo === photoPrefix() + id);
  }
  if (!visible) {
    try {
      await requireAdmin();
    } catch {
      return new Response('Not found', { status: 404 });
    }
  }
  try {
    const file = await readFile(path.join(photoDirectory(), id + '.webp'));
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
