import test from 'node:test';
import assert from 'node:assert/strict';
import type { Content, ManagementProfile, Official } from '../lib/model';
import {
  atLargeOfficials,
  constituencyLabel,
  districtOfficial,
  representativesFor,
  titleLabel,
  validateRepresentation,
} from '../lib/representation';
import { visibleContent } from '../lib/store';
import {
  districtElectionSchema,
  managementSchema,
  officialSchema,
} from '../lib/validation';

function official(
  id: string,
  district: string | null,
  extra: Partial<Official> = {},
): Official {
  return {
    id,
    district,
    name: 'Test ' + id,
    title: 'Councilmember',
    selectionMethod: 'elected',
    email: id + '@example.invalid',
    phone: '(555) 010-0100 ext. 20',
    phoneLabel: 'Office',
    website: 'https://example.invalid/' + id,
    photo: '',
    termEnd: '2028-12',
    bio: '',
    staffName: '',
    staffEmail: '',
    staffPhone: '',
    vacant: false,
    ...extra,
  };
}
function manager(
  id: string,
  extra: Partial<ManagementProfile> = {},
): ManagementProfile {
  return {
    id,
    name: 'Manager ' + id,
    title: 'City Manager',
    email: id + '@example.invalid',
    phone: '(555) 010-0101',
    phoneLabel: 'QA management office phone label',
    website: 'https://example.invalid/management/' + id,
    photo: '/api/photos/' + 'a'.repeat(32),
    bio: 'Public service biography.',
    visible: true,
    ...extra,
  };
}
function content(): Content {
  return {
    agency: {
      name: 'Test City',
      shortName: 'Test City',
      kind: 'city',
      state: 'California',
      heading: 'Find your district',
      intro: 'Test address lookup',
      website: '',
      contactEmail: '',
      contactPhone: '',
      accent: '#256375',
      showMayor: true,
      showPhotos: true,
      showEmail: true,
      showPhone: true,
      showWebsite: true,
      showTerm: true,
      showStaff: true,
    },
    officials: [
      official('one', '1'),
      official('two', '2'),
      official('three', '3'),
    ],
    map: {
      type: 'FeatureCollection',
      features: [1, 2, 3].map((n) => ({
        type: 'Feature',
        properties: { district: String(n) },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [n, 0],
              [n + 1, 0],
              [n + 1, 1],
              [n, 1],
              [n, 0],
            ],
          ],
        },
      })),
    },
    mapName: 'Synthetic test map',
    mapEffectiveDate: '2026-01-01',
    dataReviewedAt: '2026-09-10',
    sourceUrl: 'https://example.invalid/',
  };
}
const ids = (officials: Official[]) => officials.map((person) => person.id);

void test('Mixed representation returns the matched district and continuing at-large members, without unrelated district seats', () => {
  const c = content();
  c.officials.push(
    official('continuing', null),
    official('appointed', null, { selectionMethod: 'appointed' }),
  );
  assert.doesNotThrow(() => validateRepresentation(c));
  assert.deepEqual(ids(representativesFor(c, '2')), [
    'two',
    'continuing',
    'appointed',
  ]);
  assert.equal(constituencyLabel(c.officials[3]), 'Elected At Large');
  assert.equal(constituencyLabel(c.officials[4]), 'At Large · Appointed');
  assert.equal(
    officialSchema.parse(c.officials[4]).selectionMethod,
    'appointed',
  );
});

void test('A rotating mayor keeps the district seat and other titles when citywide mayor display is disabled', () => {
  const c = content();
  c.agency.showMayor = false;
  c.officials[0] = official('one', '1', {
    additionalTitles: ['Mayor', 'Councilmember'],
  });
  c.officials.push(
    official('citywide-mayor', null, { title: 'Mayor' }),
    official('continuing', null),
  );
  assert.equal(titleLabel(c.officials[0]), 'Councilmember · Mayor');
  assert.equal(constituencyLabel(c.officials[0]), 'District 1');
  assert.equal(districtOfficial(c, '1')?.id, 'one');
  assert.deepEqual(ids(representativesFor(c, '1')), ['one', 'continuing']);
  assert.deepEqual(ids(visibleContent(c).officials), [
    'one',
    'two',
    'three',
    'continuing',
  ]);
  assert.equal(c.officials[0].district, '1');
});

void test('An additional Mayor title receives the same at-large visibility rule without hiding other at-large members', () => {
  const c = content();
  c.officials.push(
    official('ordinary', null),
    official('mayor', null, { additionalTitles: ['Mayor'] }),
  );
  assert.deepEqual(ids(atLargeOfficials(c)), ['mayor', 'ordinary']);
  c.agency.showMayor = false;
  assert.deepEqual(ids(atLargeOfficials(c)), ['ordinary']);
  assert.ok(
    !visibleContent(c).officials.some((person) => person.id === 'mayor'),
  );
});

void test('A future district election does not convert current at-large service or a placeholder into an occupied district seat', () => {
  const c = content();
  c.officials[0].district = null;
  c.districtElections = {
    '1': { status: 'transition', firstElection: '2026-11' },
  };
  assert.doesNotThrow(() => validateRepresentation(c));
  assert.equal(districtOfficial(c, '1'), undefined);
  assert.deepEqual(ids(representativesFor(c, '1')), ['one']);
  assert.deepEqual(ids(representativesFor(c, '2')), ['two', 'one']);
  c.officials.push(official('placeholder', '1', { name: '', vacant: true }));
  assert.doesNotThrow(() => validateRepresentation(c));
  assert.equal(districtOfficial(c, '1'), undefined);
  assert.deepEqual(ids(representativesFor(c, '1')), ['one']);
});

void test('A real vacancy remains identifiable but is excluded from occupied representatives', () => {
  const c = content();
  c.officials[1] = official('two', '2', { vacant: true, name: '' });
  c.officials.push(
    official('continuing', null),
    official('empty-at-large', null, { vacant: true, name: '' }),
  );
  assert.doesNotThrow(() => validateRepresentation(c));
  assert.equal(districtOfficial(c, '2')?.vacant, true);
  assert.deepEqual(ids(representativesFor(c, '2')), ['continuing']);
  assert.equal(districtOfficial(c, null), undefined);
});

void test('Validation rejects missing and duplicate active district seats and duplicate official identifiers', () => {
  const missing = content();
  missing.officials.pop();
  assert.throws(() => validateRepresentation(missing), /Each active district/);
  const duplicate = content();
  duplicate.officials.push(official('other-one', '1'));
  assert.throws(
    () => validateRepresentation(duplicate),
    /Each active district/,
  );
  const duplicateId = content();
  duplicateId.officials.push(official('one', null));
  assert.throws(() => validateRepresentation(duplicateId), /unique identifier/);
});

void test('Validation rejects unknown map assignments and unknown district election settings', () => {
  const outside = content();
  outside.officials[0].district = '99';
  assert.throws(() => validateRepresentation(outside), /outside this map/);
  const unknownElection = content();
  unknownElection.districtElections = {
    '99': { status: 'transition', firstElection: '2026-11' },
  };
  assert.throws(
    () => validateRepresentation(unknownElection),
    /outside this map/,
  );
  assert.equal(
    districtElectionSchema.safeParse({
      status: 'transition',
      firstElection: '2026-13',
    }).success,
    false,
  );
});

void test('Transition validation rejects occupied seats, multiple placeholders, and missing continuing representatives', () => {
  const occupied = content();
  occupied.officials.push(official('continuing', null));
  occupied.districtElections = { '1': { status: 'transition' } };
  assert.throws(
    () => validateRepresentation(occupied),
    /cannot already have an occupied/,
  );
  const placeholders = structuredClone(occupied);
  placeholders.officials[0].vacant = true;
  placeholders.officials.push(
    official('second-placeholder', '1', { vacant: true, name: '' }),
  );
  assert.throws(
    () => validateRepresentation(placeholders),
    /transitioning district/,
  );
  const noContinuing = content();
  noContinuing.officials.shift();
  noContinuing.districtElections = { '1': { status: 'transition' } };
  assert.throws(
    () => validateRepresentation(noContinuing),
    /continuing at-large/,
  );
  noContinuing.officials.push(
    official('empty', null, { vacant: true, name: '' }),
  );
  assert.throws(
    () => validateRepresentation(noContinuing),
    /continuing at-large/,
  );
});

void test('Management profiles validate custom appointed titles without district or election fields', () => {
  const parsed = managementSchema.parse({
    ...manager('custom', { title: 'Deputy County Executive', visible: false }),
    district: '1',
    termEnd: '2028-12',
    selectionMethod: 'elected',
  });
  assert.equal(parsed.visible, false);
  assert.equal(parsed.title, 'Deputy County Executive');
  assert.ok(!('district' in parsed));
  assert.ok(!('termEnd' in parsed));
  assert.ok(!('selectionMethod' in parsed));
  assert.equal(
    managementSchema.safeParse(manager('bad', { name: ' ' })).success,
    false,
  );
  assert.equal(
    managementSchema.safeParse(
      manager('bad', { website: 'javascript:alert(1)' }),
    ).success,
    false,
  );
  assert.equal(
    managementSchema.safeParse(
      manager('bad', { photo: 'https://example.invalid/photo.jpg' }),
    ).success,
    false,
  );
});

void test('Hidden management profiles are absent from the public payload, including their private details', () => {
  const c = content();
  c.management = [
    manager('visible'),
    manager('hidden', { visible: false, bio: 'HIDDEN_PROFILE_SENTINEL' }),
  ];
  const before = structuredClone(c);
  const result = visibleContent(c);
  assert.deepEqual(
    result.management?.map((profile) => profile.id),
    ['visible'],
  );
  assert.ok(!JSON.stringify(result).includes('HIDDEN_PROFILE_SENTINEL'));
  assert.deepEqual(
    c,
    before,
    'Public filtering must not destroy the editable draft',
  );
  c.agency.showManagement = false;
  assert.deepEqual(visibleContent(c).management, []);
  assert.equal(
    visibleContent({ ...c, management: undefined }).management?.length,
    0,
  );
});

void test('Management inherits each public contact/photo preference without losing its editable source values', () => {
  for (const [setting, field] of [
    ['showPhotos', 'photo'],
    ['showEmail', 'email'],
    ['showPhone', 'phone'],
    ['showWebsite', 'website'],
  ] as const) {
    const c = content();
    c.management = [manager('visible')];
    c.agency[setting] = false;
    const before = structuredClone(c);
    const result = visibleContent(c);
    assert.equal(result.management?.[0][field], '', setting);
    if (setting === 'showPhone')
      assert.equal(result.management?.[0].phoneLabel, '');
    assert.ok(
      c.management[0][field],
      'Original ' + field + ' should remain available for editing',
    );
    assert.equal(result.management?.[0].name, c.management[0].name);
    assert.deepEqual(c, before);
  }
});
