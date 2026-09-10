import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inArpeeville, isSandbox, photoInScope } from '../lib/agency-scope';
import { locate, normalizeMap } from '../lib/geo';
import type { Content, Address } from '../lib/model';
void test('Sandbox request scope survives awaits without leaking into concurrent Martinez work', async () => {
  await Promise.all([
    inArpeeville(async () => {
      await new Promise((r) => setTimeout(r, 15));
      assert.equal(isSandbox(), true);
    }),
    (async () => {
      await new Promise((r) => setTimeout(r, 5));
      assert.equal(isSandbox(), false);
    })(),
  ]);
  assert.equal(isSandbox(), false);
});
void test('Portrait paths cannot cross the agency boundary', () => {
  const id = 'a'.repeat(32);
  assert.equal(photoInScope('/api/photos/' + id), true);
  assert.equal(photoInScope('/api/arpeeville/photos/' + id), false);
  inArpeeville(() => {
    assert.equal(photoInScope('/api/photos/' + id), false);
    assert.equal(photoInScope('/api/arpeeville/photos/' + id), true);
    assert.equal(photoInScope('/portraits/1.jpg'), false);
    assert.equal(photoInScope('/portraits/arpeeville/liz.jpg'), true);
    assert.equal(photoInScope('/api/arpeeville/photos/../photos/' + id), false);
  });
});
void test('Arpeeville has five valid single polygons, a citywide mayor, and 25 uniquely assigned fictional addresses', () => {
  const content = JSON.parse(
    readFileSync('data/arpeeville/seed.json', 'utf8'),
  ) as Content;
  const addresses = JSON.parse(
    readFileSync('data/arpeeville/addresses.json', 'utf8'),
  ) as Address[];
  assert.throws(() => normalizeMap(content.map, 'district'), /Martinez/);
  const { map } = normalizeMap(content.map, 'district', 'arpeeville');
  assert.equal(map.features.length, 5);
  assert.ok(map.features.every((f) => f.geometry.type === 'Polygon'));
  assert.equal(
    content.officials.filter((o) => o.district === null)[0].name,
    'Liz Stitt',
  );
  assert.equal(addresses.length, 25);
  for (const a of addresses) assert.equal(locate(map, a), a.id.split('-')[1]);
  assert.equal(locate(map, { lon: -122.133, lat: 38.019 }), null);
});
