import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { locate, normalizeMap } from '../lib/geo';
import type { DistrictMap, Address } from '../lib/model';
const map = JSON.parse(
  readFileSync('data/districts.json', 'utf8'),
) as DistrictMap;
const addresses = JSON.parse(
  readFileSync('data/addresses.json', 'utf8'),
) as Address[];
void test('All 13,882 city addresses match the saved district assignment', () => {
  assert.equal(addresses.length, 13882);
  const counts: Record<string, number> = {};
  for (const a of addresses) {
    assert.equal(locate(map, a), a.district, a.label);
    counts[a.district!] = (counts[a.district!] || 0) + 1;
  }
  assert.deepEqual(counts, { '1': 3525, '2': 3272, '3': 3771, '4': 3314 });
});
void test('City Hall is District 1; outside points and exact boundaries are not guessed', () => {
  assert.equal(
    locate(map, { lon: -122.13541100037854, lat: 38.014076999792046 }),
    '1',
  );
  assert.equal(locate(map, { lon: -122.059, lat: 37.95 }), null);
  assert.equal(locate(map, { lon: NaN, lat: 38 }), null);
  const g = map.features[0].geometry;
  const [lon, lat] =
    g.type === 'Polygon' ? g.coordinates[0][0] : g.coordinates[0][0][0];
  assert.equal(locate(map, { lon, lat }), null);
});
void test('Actual map passes validation; the wrong field and duplicate districts fail', () => {
  assert.equal(normalizeMap(map, 'district').map.features.length, 4);
  assert.throws(() => normalizeMap(map, 'NAME'), /district field/);
  assert.throws(
    () =>
      normalizeMap(
        { ...map, features: [...map.features, map.features[0]] },
        'district',
      ),
    /more than once/,
  );
  const overlap = structuredClone(map);
  overlap.features[1].geometry = structuredClone(overlap.features[0].geometry);
  assert.throws(() => normalizeMap(overlap, 'district'), /overlap/);
});
void test('Holes and disconnected multipolygon pieces preserve their meaning', () => {
  const example: DistrictMap = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { district: 'A' },
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [0, 0],
                [4, 0],
                [4, 4],
                [0, 4],
                [0, 0],
              ],
              [
                [1, 1],
                [1, 2],
                [2, 2],
                [2, 1],
                [1, 1],
              ],
            ],
            [
              [
                [5, 0],
                [6, 0],
                [6, 1],
                [5, 1],
                [5, 0],
              ],
            ],
          ],
        },
      },
    ],
  };
  assert.equal(locate(example, { lon: 1.5, lat: 1.5 }), null);
  assert.equal(locate(example, { lon: 3, lat: 3 }), 'A');
  assert.equal(locate(example, { lon: 5.5, lat: 0.5 }), 'A');
});
