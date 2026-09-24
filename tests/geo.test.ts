import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { locate, normalizeMap } from '../lib/geo';
import type { DistrictMap, Address } from '../lib/model';
import type { Polygon, MultiPolygon, Position } from 'geojson';
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

const square = (x: number, y: number, size: number): Position[] => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
];
function topologyMap(geometry: Polygon | MultiPolygon): DistrictMap {
  // Small, ordinary coordinates inside the existing Martinez validation region.
  const position = (p: Position): Position => [
    -122.15 + p[0] * 0.001,
    37.99 + p[1] * 0.001,
  ];
  const transformed: Polygon | MultiPolygon =
    geometry.type === 'Polygon'
      ? {
          type: 'Polygon',
          coordinates: geometry.coordinates.map((r) => r.map(position)),
        }
      : {
          type: 'MultiPolygon',
          coordinates: geometry.coordinates.map((p) =>
            p.map((r) => r.map(position)),
          ),
        };
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { district: 'A' }, geometry: transformed },
      {
        type: 'Feature',
        properties: { district: 'B' },
        geometry: {
          type: 'Polygon',
          coordinates: [square(12, 0, 2).map(position)],
        },
      },
    ],
  };
}

void test('Valid point contacts between polygon parts and shell/hole rings preserve the original geometry', () => {
  const examples: (Polygon | MultiPolygon)[] = [
    {
      type: 'MultiPolygon',
      coordinates: [[square(0, 0, 4)], [square(4, 4, 3)]],
    },
    {
      type: 'Polygon',
      coordinates: [
        square(0, 0, 4),
        [
          [0, 0],
          [2, 1],
          [1, 2],
          [0, 0],
        ],
      ],
    },
    {
      type: 'Polygon',
      coordinates: [
        square(0, 0, 4),
        [
          [0, 2],
          [1, 1],
          [1, 3],
          [0, 2],
        ],
      ],
    },
    {
      type: 'Polygon',
      coordinates: [square(0, 0, 8), square(1, 1, 2), square(3, 3, 2)],
    },
    {
      type: 'Polygon',
      coordinates: [
        square(0, 0, 8),
        [
          [0, 4],
          [2, 2],
          [2, 3],
          [0, 4],
        ],
        [
          [0, 4],
          [2, 5],
          [2, 6],
          [0, 4],
        ],
      ],
    },
    {
      type: 'MultiPolygon',
      coordinates: [[square(0, 0, 8), square(2, 2, 4)], [square(3, 3, 2)]],
    },
  ];
  for (const geometry of examples) {
    const example = topologyMap(geometry);
    const original = structuredClone(example);
    assert.deepEqual(normalizeMap(example, 'district').map, original);
    assert.deepEqual(
      example,
      original,
      'validation must not repair or rewrite coordinates',
    );
  }
});

void test('Crossed rings, escaped or overlapping holes, overlapping parts and shared segments remain invalid', () => {
  const examples: (Polygon | MultiPolygon)[] = [
    {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [4, 3],
          [0, 4],
          [3, 0],
          [0, 0],
        ],
      ],
    },
    { type: 'Polygon', coordinates: [square(0, 0, 4), square(3, 1, 2)] },
    { type: 'Polygon', coordinates: [square(0, 0, 4), square(5, 0, 1)] },
    {
      type: 'Polygon',
      coordinates: [square(0, 0, 8), square(1, 1, 3), square(2, 2, 3)],
    },
    {
      type: 'Polygon',
      coordinates: [square(0, 0, 8), square(1, 1, 5), square(2, 2, 1)],
    },
    { type: 'Polygon', coordinates: [square(0, 0, 4), square(0, 1, 1)] },
    {
      type: 'MultiPolygon',
      coordinates: [[square(0, 0, 4)], [square(2, 2, 4)]],
    },
    {
      type: 'MultiPolygon',
      coordinates: [[square(0, 0, 4)], [square(1, 1, 1)]],
    },
    {
      type: 'MultiPolygon',
      coordinates: [[square(0, 0, 4)], [square(4, 0, 4)]],
    },
    {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [4, 0],
          [2, 0],
          [4, 4],
          [0, 4],
          [0, 0],
        ],
      ],
    },
    // A single ring cannot revisit a vertex to form two touching lobes.
    {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
          [0, 0],
          [-2, 0],
          [-2, -2],
          [0, -2],
          [0, 0],
        ],
      ],
    },
    // Two holes form a contact chain between opposite sides of the shell.
    {
      type: 'Polygon',
      coordinates: [
        square(0, 0, 8),
        [
          [0, 4],
          [2, 2],
          [4, 4],
          [2, 6],
          [0, 4],
        ],
        [
          [4, 4],
          [6, 2],
          [8, 4],
          [6, 6],
          [4, 4],
        ],
      ],
    },
    // The diamond hole touches two sides and divides the shell's interior.
    {
      type: 'Polygon',
      coordinates: [
        square(0, 0, 4),
        [
          [0, 2],
          [2, 1],
          [4, 2],
          [2, 3],
          [0, 2],
        ],
      ],
    },
  ];
  for (const geometry of examples)
    assert.throws(
      () => normalizeMap(topologyMap(geometry), 'district'),
      /self-intersecting|no usable area/,
    );
});
