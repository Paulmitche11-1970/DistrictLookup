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
void test('Arpeeville has five valid single polygons and a citywide mayor', () => {
  const content = JSON.parse(
    readFileSync('data/arpeeville/seed.json', 'utf8'),
  ) as Content;
  assert.throws(() => normalizeMap(content.map, 'district'), /Martinez/);
  const { map } = normalizeMap(content.map, 'district', 'arpeeville');
  assert.equal(map.features.length, 5);
  assert.ok(map.features.every((f) => f.geometry.type === 'Polygon'));
  assert.equal(
    content.officials.filter((o) => o.district === null)[0].name,
    'Liz Stitt',
  );
  assert.equal(locate(map, { lon: -122.133, lat: 38.019 }), null);
});
void test('All 65 fictional addresses have unique IDs and coordinates, with eight jokes strictly inside each district', () => {
  const content = JSON.parse(
    readFileSync('data/arpeeville/seed.json', 'utf8'),
  ) as Content;
  const original = JSON.parse(
    readFileSync('data/arpeeville/addresses.json', 'utf8'),
  ) as Address[];
  const jokes = JSON.parse(
    readFileSync('data/arpeeville/joke-addresses.json', 'utf8'),
  ) as Address[];
  const addresses = [...original, ...jokes];
  const { map } = normalizeMap(content.map, 'district', 'arpeeville');
  assert.equal(original.length, 25);
  assert.equal(jokes.length, 40);
  assert.equal(addresses.length, 65);
  assert.equal(new Set(addresses.map((a) => a.id)).size, addresses.length);
  assert.equal(
    new Set(addresses.map((a) => `${a.lon},${a.lat}`)).size,
    addresses.length,
  );
  assert.equal(
    new Set(addresses.map((a) => a.label.toLowerCase())).size,
    addresses.length,
  );
  for (const address of addresses) {
    assert.equal(address.city, 'Arpeeville');
    assert.ok(Number.isFinite(address.lon) && Number.isFinite(address.lat));
  }
  for (const address of original)
    assert.equal(locate(map, address), address.id.split('-')[1], address.label);
  for (const address of jokes) {
    assert.match(address.id, /^arpeeville-joke-/);
    assert.match(address.district || '', /^[1-5]$/);
    // locate rejects shared boundaries and any point touching multiple districts.
    assert.equal(locate(map, address), address.district, address.label);
  }
  for (const district of ['1', '2', '3', '4', '5'])
    assert.equal(jokes.filter((a) => a.district === district).length, 8);
  for (const a of addresses)
    for (const b of addresses) {
      if (a.id === b.id || locate(map, a) !== locate(map, b)) continue;
      const meters = Math.hypot(
        (a.lon - b.lon) * 88000,
        (a.lat - b.lat) * 111000,
      );
      assert.ok(
        meters > 150,
        `${a.label} and ${b.label} should not cluster at the same map location`,
      );
    }
  for (const label of [
    '99 Luft Balloons Way',
    '99 Bottles of Beer on the Wall Drive',
    '1 Amendment Drive',
    '2 Legit to Quit Way',
  ]) {
    const address = jokes.find((a) => a.label === label);
    assert.ok(address, `Missing requested fictional address: ${label}`);
    assert.equal(locate(map, address), address.district, label);
  }
});
