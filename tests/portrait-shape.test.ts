import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { portraitRatio, sourcePortraitRatio } from '../lib/portrait-shape';
import {
  agencySchema,
  officialSchema,
  photoAspectRatioSchema,
} from '../lib/validation';

void test('Automatic photo shape follows the predominant imported proportions, tolerating small export differences', () => {
  assert.equal(
    sourcePortraitRatio([
      { width: 400, height: 500 },
      { width: 800, height: 1000 },
      { width: 400, height: 400 },
    ]),
    0.8,
  );
  assert.equal(
    sourcePortraitRatio([
      { width: 399, height: 500 },
      { width: 800, height: 1000 },
      { width: 400, height: 400 },
    ]),
    0.799,
  );
  assert.equal(sourcePortraitRatio([]), 0.8);
  assert.equal(
    sourcePortraitRatio([
      { width: 0, height: 0 },
      { width: 100, height: 0 },
    ]),
    0.8,
  );
  const sources = JSON.parse(readFileSync('data/portrait-shapes.json', 'utf8'));
  assert.equal(sources['san-jose-evergreen'].ratio, 0.8);
  assert.equal(sources['arpeeville'].ratio, 1);
  assert.equal(portraitRatio({ sourcePhotoAspectRatio: 0.71429 }), 0.71429);
  assert.equal(
    portraitRatio({ photoAspectRatio: '4:3', sourcePhotoAspectRatio: 0.71429 }),
    4 / 3,
  );
  assert.equal(portraitRatio({ sourcePhotoAspectRatio: NaN }), 0.8);
});
void test('Aspect ratio and reversible crop inputs are bounded and source metadata cannot be overwritten by an agency edit', () => {
  const content = JSON.parse(readFileSync('data/arpeeville/seed.json', 'utf8'));
  const crop = { x: 0.25, y: 0.75, zoom: 1.4 };
  assert.deepEqual(
    officialSchema.parse({ ...content.officials[0], photoCrop: crop })
      .photoCrop,
    crop,
  );
  for (const bad of [
    { x: -0.1, y: 0.5, zoom: 1 },
    { x: 1.1, y: 0.5, zoom: 1 },
    { x: 0.5, y: 2, zoom: 1 },
    { x: 0.5, y: 0.5, zoom: 0.5 },
    { x: 0.5, y: 0.5, zoom: 4 },
    { x: NaN, y: 0.5, zoom: 1 },
  ])
    assert.equal(
      officialSchema.safeParse({ ...content.officials[0], photoCrop: bad })
        .success,
      false,
    );
  assert.equal(photoAspectRatioSchema.safeParse('99:1').success, false);
  assert.equal(
    photoAspectRatioSchema.safeParse('1; background:red').success,
    false,
  );
  const agency = agencySchema.parse({
    ...content.agency,
    photoAspectRatio: '3:4',
    sourcePhotoAspectRatio: 1000,
  });
  assert.equal(agency.photoAspectRatio, '3:4');
  assert.equal('sourcePhotoAspectRatio' in agency, false);
});
