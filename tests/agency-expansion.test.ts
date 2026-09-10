import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { inAgency, photoInScope } from '../lib/agency-scope';
import { locate, normalizeMap } from '../lib/geo';
import { instanceFor } from '../lib/instances';
import { agencySchema, officialSchema } from '../lib/validation';
import type { Address, Content } from '../lib/model';

// These are the reviewed launch snapshots, not generated fixtures. A source
// refresh must reconcile its new counts and verification records with this list.
const launchAgencies = [
  { id: 'san-mateo', addresses: 27832, vacancies: 0 },
  { id: 'burlingame', addresses: 8215, vacancies: 0 },
  { id: 'millbrae', addresses: 6485, vacancies: 1 },
  { id: 'carpinteria', addresses: 4953, vacancies: 0 },
  { id: 'diamond-bar', addresses: 17975, vacancies: 0 },
  { id: 'butte-county', addresses: 123888, vacancies: 0 },
  { id: 'yolo-county', addresses: 102817, vacancies: 0 },
] as const;

function readPackage(id: string) {
  const directory = join('data', 'agencies', id);
  const compressed = join(directory, 'addresses.json.gz');
  return {
    content: JSON.parse(
      readFileSync(join(directory, 'seed.json'), 'utf8'),
    ) as Content,
    addresses: JSON.parse(
      existsSync(compressed)
        ? gunzipSync(readFileSync(compressed)).toString('utf8')
        : readFileSync(join(directory, 'addresses.json'), 'utf8'),
    ) as Address[],
    status: JSON.parse(
      readFileSync(join(directory, 'status.json'), 'utf8'),
    ) as Record<string, unknown>,
    provenance: JSON.parse(
      readFileSync(join(directory, 'provenance.json'), 'utf8'),
    ) as Record<string, unknown>,
  };
}

function sourceStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(sourceStrings);
  if (value && typeof value === 'object')
    return Object.values(value).flatMap(sourceStrings);
  return [];
}

for (const expected of launchAgencies) {
  void test(`${expected.id}: deployed map, every address, roster and source status agree`, () => {
    const instance = instanceFor(expected.id);
    assert.ok(
      instance,
      'The reviewed agency must be registered, not silently skipped.',
    );
    assert.equal(instance.seedDirectory, 'agencies/' + expected.id);
    assert.equal(instance.addressMode, 'local');
    assert.notEqual(
      instance.sandbox,
      true,
      'Real agencies must not use sandbox access.',
    );

    const { content, addresses, status, provenance } = readPackage(expected.id);
    agencySchema.parse(content.agency);
    assert.equal(content.agency.name, instance.name);
    assert.equal(content.agency.shortName, instance.shortName);
    assert.notEqual(content.agency.sandbox, true);

    const { map, skipped } = normalizeMap(content.map, 'district', expected.id);
    assert.equal(
      skipped,
      0,
      'The deployed map must not hide unlabeled source features.',
    );
    const districts = map.features.map(
      (feature) => feature.properties.district,
    );
    assert.deepEqual([...districts].sort(), ['1', '2', '3', '4', '5']);
    assert.equal(new Set(districts).size, districts.length);
    assert.equal(instance.districtCount, districts.length);

    assert.equal(
      addresses.length,
      expected.addresses,
      'Reviewed snapshot coverage changed.',
    );
    const ids = new Set<string>();
    const districtCounts = new Map(districts.map((district) => [district, 0]));
    for (const address of addresses) {
      assert.equal(typeof address.id, 'string');
      assert.ok(address.id.trim(), 'Address identifiers must not be empty.');
      assert.ok(!ids.has(address.id), `Duplicate address ID: ${address.id}`);
      ids.add(address.id);
      assert.equal(typeof address.label, 'string');
      assert.ok(address.label.trim(), `Empty street label: ${address.id}`);
      assert.ok(
        Number.isFinite(address.lon) && Number.isFinite(address.lat),
        address.id,
      );
      assert.ok(
        address.district && districtCounts.has(address.district),
        `Address has no known source district: ${address.id}`,
      );
      assert.equal(
        locate(map, address),
        address.district,
        `The production lookup disagrees with the reviewed assignment: ${address.id}`,
      );
      districtCounts.set(
        address.district,
        districtCounts.get(address.district)! + 1,
      );
    }
    for (const [district, count] of districtCounts)
      assert.ok(count > 0, `District ${district} has no searchable addresses.`);

    const officialIds = new Set<string>();
    const districtOfficials = new Map<string, number>();
    let vacancies = 0;
    let portraits = 0;
    for (const official of content.officials) {
      officialSchema.parse(official);
      assert.ok(
        !officialIds.has(official.id),
        `Duplicate official ID: ${official.id}`,
      );
      officialIds.add(official.id);
      if (official.district !== null) {
        assert.ok(districtCounts.has(official.district), official.id);
        districtOfficials.set(
          official.district,
          (districtOfficials.get(official.district) || 0) + 1,
        );
      }
      if (official.vacant) {
        vacancies++;
        assert.ok(
          official.district,
          'The vacant district must remain identifiable.',
        );
        assert.equal(
          official.photo,
          '',
          'A vacancy must not display a former incumbent.',
        );
        assert.equal(
          official.email,
          '',
          'A vacancy must not retain a former personal inbox.',
        );
      } else {
        assert.doesNotMatch(official.name, /^\s*(vacant|tbd|unknown)\s*$/i);
      }
      assert.ok(
        inAgency(expected.id, () => photoInScope(official.photo)),
        `Official portrait belongs to another agency: ${official.id}`,
      );
      if (official.photo) {
        portraits++;
        assert.ok(
          official.photo.startsWith('/portraits/' + expected.id + '/'),
          'Bundled seed photos must be portable assets, not database upload references.',
        );
        const photoFile = join('public', official.photo.slice(1));
        assert.ok(
          statSync(photoFile).size > 0,
          `Missing or empty portrait: ${photoFile}`,
        );
        for (const otherId of [
          'martinez',
          'arpeeville',
          ...launchAgencies.map((a) => a.id),
        ]) {
          if (otherId === expected.id) continue;
          assert.equal(
            inAgency(otherId, () => photoInScope(official.photo)),
            false,
            `${otherId} must reject ${expected.id}'s portrait.`,
          );
        }
      }
    }
    for (const district of districts)
      assert.equal(
        districtOfficials.get(district),
        1,
        `District ${district} needs exactly one seat.`,
      );
    assert.equal(vacancies, expected.vacancies);
    assert.equal(
      instance.officialCount,
      content.officials.length - vacancies,
      'The directory counts incumbent people; vacant seats remain in the district roster.',
    );

    assert.equal(status.slug, expected.id);
    assert.equal(status.addressCount, addresses.length);
    assert.equal(status.districts ?? status.districtCount, districts.length);
    assert.equal(status.verifiedPortraits ?? status.portraitCount, portraits);
    assert.equal(
      status.readyForPromotion ?? status.publishReady ?? status.lookupReady,
      true,
      'A pending or rejected candidate must not be promoted.',
    );
    assert.ok(
      status.rosterVerified === true ||
        status.rosterStatus === 'verified-current-official-website',
      'The deployed roster needs recorded official-source verification.',
    );
    assert.ok(
      status.geometryValid === true ||
        status.mapStatus === 'valid-no-overlap' ||
        status.currentBoundaryComparison ===
          'current-official-county-geometry-used',
      'Boundary source review must be recorded.',
    );
    assert.ok(Array.isArray(status.pending));
    if (portraits < content.officials.length - vacancies)
      assert.match(
        status.pending.join(' '),
        /portrait|headshot/i,
        'Missing photos must be disclosed.',
      );
    assert.match(content.dataReviewedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(
      new Date(content.dataReviewedAt).toISOString().slice(0, 10),
      content.dataReviewedAt,
    );
    assert.equal(new URL(content.sourceUrl).protocol, 'https:');
    const sources = sourceStrings(provenance);
    assert.ok(
      sources.some((value) => /\.shp\b/i.test(value)),
      'RP shapefile provenance is required.',
    );
    assert.ok(
      sources.some((value) => value.startsWith('https://')),
      'Official web sources are required.',
    );
  });
}

void test('Verified northern roster corrections and the Millbrae vacancy survive promotion', () => {
  const sanMateo = readPackage('san-mateo').content;
  assert.equal(
    sanMateo.officials.find((official) => official.district === '2')?.name,
    'Nicole Fernandez',
  );
  const burlingame = readPackage('burlingame').content;
  assert.equal(
    burlingame.officials.find((official) => official.district === '3')?.title,
    'Mayor',
  );
  assert.equal(
    burlingame.officials.find((official) => official.district === '1')?.termEnd,
    '2026-12',
  );
  const { content: millbrae, addresses } = readPackage('millbrae');
  const cityHall = addresses.find(
    (address) => address.label.toLowerCase() === '621 magnolia ave',
  );
  assert.ok(cityHall, 'Retain the verified public City Hall lookup example.');
  const district = locate(millbrae.map, cityHall);
  assert.equal(district, '3');
  assert.equal(
    millbrae.officials.find((official) => official.district === district)
      ?.vacant,
    true,
  );
});
