import test from 'node:test';
import assert from 'node:assert/strict';
import {
  agencyLabels,
  districtName,
  agencyDesignCopy,
} from '../lib/agency-labels';
import { constituencyLabel } from '../lib/representation';
import type { Official } from '../lib/model';

void test('City and county terminology retains the established public wording', () => {
  for (const agency of [undefined, { kind: 'city' as const }]) {
    const labels = agencyLabels(agency);
    assert.equal(labels.district, 'District');
    assert.equal(labels.districtsLower, 'districts');
    assert.equal(labels.presentationBody, 'City Council');
    assert.equal(labels.presentationDistrict, 'Council District');
    assert.equal(labels.bodyShort, 'council');
    assert.equal(labels.members, 'councilmembers');
  }
  const county = agencyLabels({ kind: 'county' });
  assert.equal(county.presentationBody, 'Supervisors');
  assert.equal(county.presentationDistrict, 'District');
  assert.equal(county.bodyShort, 'board');
  assert.equal(county.place, 'county');
  assert.equal(county.members, 'supervisors');
});

void test('Water-district divisions keep their numbering independent of governing-board titles', () => {
  const agency = {
    kind: 'special' as const,
    districtLabel: 'Division' as const,
  };
  const labels = agencyLabels(agency);
  assert.equal(labels.body, 'Board of Directors');
  assert.equal(labels.presentationBody, 'Board of Directors');
  assert.equal(labels.bodyShort, 'board');
  assert.equal(labels.members, 'directors');
  assert.equal(labels.districtsLower, 'divisions');
  assert.equal(labels.presentationDistrict, 'Division');
  assert.equal(districtName(agency, '5'), 'Division 5');
  const official = { district: '3', title: 'President' } as Official;
  assert.equal(constituencyLabel(official, agency), 'Division 3');
  assert.equal(constituencyLabel(official), 'District 3');
});

void test('Zones and trustee areas preserve lettered labels and readable plurals', () => {
  assert.equal(
    districtName({ kind: 'special', districtLabel: 'Zone' }, 'A'),
    'Zone A',
  );
  assert.equal(
    agencyLabels({ kind: 'special', districtLabel: 'Zone' }).districtsLower,
    'zones',
  );
  for (const kind of ['school', 'college'] as const) {
    const agency = { kind, districtLabel: 'Trustee Area' as const };
    assert.equal(districtName(agency, 'B'), 'Trustee Area B');
    assert.equal(agencyLabels(agency).districtsLower, 'trustee areas');
    assert.equal(agencyLabels(agency).body, 'Governing Board');
    assert.equal(agencyLabels(agency).members, 'board members');
  }
});

void test('At-large election and appointment labels do not acquire a district prefix', () => {
  for (const districtLabel of [
    'District',
    'Division',
    'Zone',
    'Trustee Area',
  ] as const) {
    const agency = { kind: 'special' as const, districtLabel };
    assert.equal(
      constituencyLabel(
        { district: null, selectionMethod: 'elected' } as Official,
        agency,
      ),
      'Elected At Large',
    );
    assert.equal(
      constituencyLabel(
        { district: null, selectionMethod: 'appointed' } as Official,
        agency,
      ),
      'At Large · Appointed',
    );
    assert.equal(
      constituencyLabel({ district: null } as Official, agency),
      'At Large',
    );
  }
});

void test('Gallery descriptions use board/division terms without changing agency-wide scope', () => {
  const agency = {
    kind: 'special' as const,
    districtLabel: 'Division' as const,
  };
  assert.equal(
    agencyDesignCopy('The city is the canvas', agency),
    'The district is the canvas',
  );
  assert.equal(
    agencyDesignCopy(
      'A council or board landing page with a district map. Browse districts.',
      agency,
    ),
    'A board landing page with a division map. Browse divisions.',
  );
  assert.equal(
    agencyDesignCopy('A council directory.', { kind: 'city' }),
    'A council directory.',
  );
});
