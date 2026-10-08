// Run after importing agency portraits. Record their common source proportions
// without changing any image, draft, published settings, or client preview.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { sourcePortraitRatio } from '../lib/portrait-shape.ts';
const instances = JSON.parse(readFileSync('data/instances.json', 'utf8'));
const shapes = {};
for (const instance of instances) {
  const seed = JSON.parse(
    readFileSync(
      path.join('data', instance.seedDirectory, 'seed.json'),
      'utf8',
    ),
  );
  const sizes = [];
  for (const official of seed.officials) {
    if (official.vacant || !official.photo?.startsWith('/portraits/')) continue;
    const meta = await sharp(
      path.join('public', official.photo.slice(1)),
    ).metadata();
    const rotated = [5, 6, 7, 8].includes(meta.orientation);
    sizes.push({
      width: rotated ? meta.height : meta.width,
      height: rotated ? meta.width : meta.height,
    });
  }
  shapes[instance.id] = {
    ratio: sourcePortraitRatio(sizes),
    imageCount: sizes.length,
  };
}
writeFileSync(
  'data/portrait-shapes.json',
  JSON.stringify(shapes, null, 2) + '\n',
);
console.log(JSON.stringify(shapes));
