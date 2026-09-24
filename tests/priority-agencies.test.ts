import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { instanceFor } from '../lib/instances';
import { boundaryDirectoryEntries } from '../lib/boundary-catalog';
import { locate, normalizeMap } from '../lib/geo';
import { officialSchema, agencySchema } from '../lib/validation';
import {
  representativesFor,
  validateRepresentation,
} from '../lib/representation';
import { inAgency, photoInScope } from '../lib/agency-scope';
import type { Content, Address } from '../lib/model';

const priorities = [
  'san-jose-evergreen',
  'barstow-college',
  'placer-union-high-school',
  'california-city',
  'olivenhain-water',
  'galt',
];
const load = (id: string) =>
  JSON.parse(readFileSync(`data/agencies/${id}/seed.json`, 'utf8')) as Content;
for (const id of priorities) {
  void test(`${id}: complete scoped package with matching district geometry and address assignments`, () => {
    const instance = instanceFor(id)!;
    assert.ok(instance);
    assert.equal(instance.addressMode, 'local');
    const content = load(id);
    agencySchema.parse(content.agency);
    validateRepresentation(content);
    const map = normalizeMap(content.map, 'district', id).map;
    assert.equal(map.features.length, instance.districtCount);
    assert.equal(content.officials.length, instance.officialCount);
    for (const official of content.officials) {
      officialSchema.parse(official);
      assert.ok(inAgency(id, () => photoInScope(official.photo)));
      assert.ok(official.photo && existsSync('public' + official.photo));
    }
    assert.ok(existsSync('public' + instance.logo));
    const addresses = JSON.parse(
      gunzipSync(
        readFileSync(`data/agencies/${id}/addresses.json.gz`),
      ).toString(),
    ) as Address[];
    assert.ok(addresses.length > 1000, 'Real address coverage required');
    assert.equal(new Set(addresses.map((a) => a.id)).size, addresses.length);
    const counts: Record<string, number> = {};
    for (const a of addresses) {
      assert.equal(locate(map, a), a.district, a.id);
      assert.ok(a.city && a.label);
      assert.ok(
        Object.keys(a).every((k) =>
          ['id', 'label', 'lon', 'lat', 'city', 'zip', 'district'].includes(k),
        ),
      );
      counts[a.district!] = (counts[a.district!] || 0) + 1;
    }
    for (const f of map.features) assert.ok(counts[f.properties.district] > 0);
    assert.equal(locate(map, { lon: 0, lat: 0 }), null);
  });
}
void test('Galt and California City currently show every at-large member regardless of residence district', () => {
  for (const id of ['galt', 'california-city']) {
    const content = load(id);
    assert.ok(content.officials.every((o) => o.district === null));
    for (const f of content.map.features) {
      assert.equal(
        content.districtElections?.[f.properties.district].status,
        'transition',
      );
      assert.equal(
        representativesFor(content, f.properties.district).length,
        5,
      );
    }
  }
});
void test('Placer Union has two district seats and three continuing at-large seats', () => {
  const content = load('placer-union-high-school');
  assert.equal(representativesFor(content, '1').length, 4);
  assert.equal(representativesFor(content, '5').length, 4);
  assert.equal(representativesFor(content, '3').length, 3);
  assert.equal(
    content.officials.find((o) => o.district === '5')?.name,
    'Carleton Copa',
  );
  assert.ok(!content.officials.some((o) => o.name === 'Tom Duncan'));
});
void test('Known term years remain editable without inventing a month', () => {
  const official = load('barstow-college').officials[0];
  for (const termEnd of ['2026', '2028-11', ''])
    assert.ok(officialSchema.safeParse({ ...official, termEnd }).success);
  for (const termEnd of ['2026-13', '2026-00', '26', '2028-1'])
    assert.ok(!officialSchema.safeParse({ ...official, termEnd }).success);
});
void test('Boundary directory uses the same identities as newly activated college and board pages', () => {
  for (const id of priorities.filter(
    (id) => !['galt', 'california-city'].includes(id),
  )) {
    assert.equal(boundaryDirectoryEntries.filter((a) => a.id === id).length, 1);
  }
});
