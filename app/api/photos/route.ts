import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  requireAdmin,
  checkOrigin,
  errorResponse,
  HttpError,
  boundedBody,
  rateLimit,
} from '@/lib/security';
import { dataDir, database } from '@/lib/store';
import { photoPrefix } from '@/lib/agency-scope';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const session = await requireAdmin();
    rateLimit('photos:' + session.admin.id, 30, 3600);
    if (Number(request.headers.get('content-length') || 0) > 5_500_000)
      throw new HttpError(413, 'Photos must be smaller than 5 MB.');
    const body = await boundedBody(request, 5_500_000);
    const form = await new Response(body, {
      headers: { 'Content-Type': request.headers.get('content-type') || '' },
    }).formData();
    const file = form.get('photo');
    if (!(file instanceof File) || file.size > 5_000_000 || file.size === 0)
      throw new HttpError(400, 'Choose a JPG, PNG or GIF smaller than 5 MB.');
    const input = Buffer.from(await file.arrayBuffer());
    let photo: Buffer;
    try {
      const img = sharp(input, {
        limitInputPixels: 25_000_000,
        animated: false,
      });
      const meta = await img.metadata();
      if (!['jpeg', 'png', 'gif'].includes(meta.format || ''))
        throw Error('format');
      photo = await img
        .rotate()
        .resize({
          width: 800,
          height: 1000,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 88 })
        .toBuffer();
    } catch {
      throw new HttpError(
        400,
        'This file is not a supported JPG, PNG or GIF image.',
      );
    }
    const id = randomBytes(16).toString('hex');
    const dir = path.join(dataDir(), 'uploads');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, id + '.webp'), photo, { flag: 'wx' });
    database()
      .prepare('INSERT INTO photos(id,mime,created_at) VALUES(?,?,?)')
      .run(id, 'image/webp', new Date().toISOString());
    return Response.json({ url: photoPrefix() + id });
  } catch (e) {
    return errorResponse(e);
  }
}
