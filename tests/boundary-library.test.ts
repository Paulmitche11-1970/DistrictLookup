import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boundaryAgencies,
  boundaryFor,
  boundaryDirectoryEntries,
} from '../lib/boundary-catalog';
import { readBoundaryMap } from '../lib/boundary-library';
import { reviewDestination } from '../lib/review-destination';
import { colorFor } from '../lib/model';

void test('boundary files match the audited district IDs and carry only district geometry', async () => {
  assert.equal(
    new Set(boundaryAgencies.map((a) => a.id)).size,
    boundaryAgencies.length,
  );
  assert.equal(boundaryAgencies.length, 70);
  for (const agency of boundaryAgencies) {
    const map = await readBoundaryMap(agency.id);
    if (!agency.mapAvailable) {
      assert.equal(map, null);
      continue;
    }
    assert.ok(map);
    assert.equal(map.type, 'FeatureCollection');
    assert.deepEqual(
      map.features.map((f) => f.properties.district),
      agency.districts,
      agency.name,
    );
    for (const feature of map.features) {
      assert.deepEqual(Object.keys(feature.properties), ['district']);
      assert.ok(['Polygon', 'MultiPolygon'].includes(feature.geometry.type));
      assert.ok(feature.properties.district.trim());
    }
  }
});
void test('map selection cannot read arbitrary paths', async () => {
  assert.equal(boundaryFor('../instances'), undefined);
  assert.equal(await readBoundaryMap('../../.env.local'), null);
});
void test('Olivehurst uses its parcel-based final plan instead of the misplaced college map', async () => {
  const agency = boundaryFor('olivehurst-public-utility-district');
  assert.ok(agency);
  assert.equal(agency.shapefile, 'OPUD Final Plan Base on Parcels.shp');
  assert.ok(
    agency.bounds && agency.bounds[1] > 38.9 && agency.bounds[3] < 39.2,
  );
  const geo = await readBoundaryMap(agency.id);
  assert.equal(geo?.features.length, 5);
  assert.notEqual(
    agency.mapSha256,
    boundaryFor('mt-san-jacinto-community-college-district')?.mapSha256,
  );
});
void test('school boards stay separate from counties and existing water lookup identity is preserved', () => {
  assert.equal(boundaryFor('napa-county'), undefined);
  assert.equal(
    boundaryFor('napa-county-board-of-education')?.category,
    'County education boards',
  );
  assert.equal(
    boundaryDirectoryEntries.filter((a) => a.type === 'schools').length,
    17,
  );
  assert.equal(
    boundaryDirectoryEntries.filter((a) => a.type === 'colleges').length,
    27,
  );
  assert.equal(
    boundaryDirectoryEntries.filter((a) => a.type === 'special').length,
    26,
  );
  assert.equal(
    boundaryDirectoryEntries.find((a) => a.id === 'midpeninsula-water')
      ?.boundaryId,
    'midpeninsula-water-district',
  );
});
void test('boundary review returns to a safe RP-only route after sign-in', () => {
  for (const route of [
    '/admin/boundaries',
    '/admin/boundaries/barstow-community-college-district',
  ]) {
    assert.equal(reviewDestination('rp', route), route);
    assert.equal(reviewDestination('martinez', route), '/martinez');
  }
  for (const route of [
    '//evil.example',
    '/admin/boundaries/../logs',
    '/admin/boundaries/%2f%2fevil',
    '/admin/boundaries/a?next=https://evil.example',
  ])
    assert.equal(reviewDestination('rp', route), '/');
});
void test('lettered and seven/nine-area maps have distinct colors without changing the existing palette', () => {
  assert.equal(colorFor('1'), '#2a808b');
  assert.equal(colorFor('5'), '#b06580');
  assert.equal(new Set('ABCDEFG'.split('').map(colorFor)).size, 7);
  assert.equal(
    new Set(Array.from({ length: 9 }, (_, i) => colorFor(String(i + 1)))).size,
    9,
  );
});
