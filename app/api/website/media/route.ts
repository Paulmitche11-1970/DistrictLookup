import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { hasReviewAccess } from '@/lib/review-access';
import {
  boundedBody,
  checkOrigin,
  errorResponse,
  HttpError,
} from '@/lib/security';
import {
  addWebsiteMedia,
  websiteDataDir,
  websiteMedia,
} from '@/lib/website-store';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (!(await hasReviewAccess('rp')))
      throw new HttpError(
        401,
        'Sign in with RP staff access to upload images.',
      );
    if (websiteMedia().length >= 1000)
      throw new HttpError(
        400,
        'The media library is full. Contact RP support.',
      );
    const body = await boundedBody(request, 8_500_000);
    const form = await new Request(request.url, {
      method: 'POST',
      headers: { 'content-type': request.headers.get('content-type') || '' },
      body: new Uint8Array(body),
    }).formData();
    const file = form.get('image'),
      altField = form.get('alt'),
      alt = (typeof altField === 'string' ? altField : '').trim().slice(0, 300);
    if (!(file instanceof File) || !file.size || file.size > 8_000_000)
      throw new HttpError(
        400,
        'Choose a JPG, PNG, WebP, or GIF image up to 8 MB.',
      );
    if (!alt) throw new HttpError(400, 'Add a description for the image.');
    let output: Buffer, width: number, height: number;
    try {
      const image = sharp(Buffer.from(await file.arrayBuffer()), {
        limitInputPixels: 30_000_000,
        animated: false,
      });
      const metadata = await image.metadata();
      if (!['jpeg', 'png', 'webp', 'gif'].includes(metadata.format || ''))
        throw Error('format');
      const result = await image
        .rotate()
        .resize({
          width: 2000,
          height: 2000,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 88 })
        .toBuffer({ resolveWithObject: true });
      output = result.data;
      width = result.info.width;
      height = result.info.height;
    } catch {
      throw new HttpError(
        400,
        'This file is not a supported image, is damaged, or exceeds 30 megapixels.',
      );
    }
    const id = randomBytes(16).toString('hex'),
      dir = path.join(websiteDataDir(), 'media');
    await mkdir(dir, { recursive: true });
    const target = path.join(dir, id + '.webp');
    await writeFile(target, output, { flag: 'wx' });
    try {
      return Response.json(
        {
          media: addWebsiteMedia({
            id,
            name: path.basename(file.name).slice(0, 200),
            alt,
            width,
            height,
          }),
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    } catch (error) {
      await unlink(target).catch(() => {});
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
