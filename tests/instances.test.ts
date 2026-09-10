import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { instanceFor } from '../lib/instances';
import { inAgency, photoInScope } from '../lib/agency-scope';
import { sessionCookie, setupToken } from '../lib/security';
import { normalizeMap, locate } from '../lib/geo';
import { officialSchema } from '../lib/validation';
import type { Content, Address } from '../lib/model';

void test('Solano county map, full local address snapshot and officials agree using the production geometry engine', () => {
  const content = JSON.parse(
    readFileSync('data/agencies/solano-county/seed.json', 'utf8'),
  ) as Content;
  const addresses = JSON.parse(
    gunzipSync(
      readFileSync('data/agencies/solano-county/addresses.json.gz'),
    ).toString('utf8'),
  ) as Address[];
  const map = normalizeMap(content.map, 'district', 'solano-county').map;
  assert.equal(map.features.length, 5);
  assert.equal(addresses.length, 181255);
  assert.equal(new Set(addresses.map((a) => a.id)).size, addresses.length);
  for (const address of addresses)
    assert.equal(locate(map, address), address.district, address.id);
  for (const official of content.officials) {
    officialSchema.parse(official);
    assert.ok(inAgency('solano-county', () => photoInScope(official.photo)));
  }
  assert.equal(
    locate(map, { lon: -122.1383, lat: 38.018 }),
    null,
    'Martinez is not in Solano',
  );
});
void test('Each real agency has independent sessions and setup credentials; registry rejects unknown scope', async () => {
  process.env.ADMIN_SETUP_TOKEN = 'martinez-only';
  process.env.ADMIN_SETUP_TOKEN_SOLANO_COUNTY = 'solano-only';
  assert.throws(() => inAgency('../martinez', () => true));
  assert.equal(
    instanceFor('napa-county'),
    undefined,
    'Unresolved maps are not activated',
  );
  const [martinez, solano] = await Promise.all([
    inAgency('martinez', async () => {
      await Promise.resolve();
      return [sessionCookie(), setupToken()];
    }),
    inAgency('solano-county', async () => {
      await Promise.resolve();
      return [sessionCookie(), setupToken()];
    }),
  ]);
  assert.deepEqual(martinez, ['dl_session', 'martinez-only']);
  assert.deepEqual(solano, ['dl_session_solano-county', 'solano-only']);
  assert.equal(
    inAgency('solano-county', () => photoInScope('/portraits/1.jpg')),
    false,
  );
  assert.equal(
    inAgency('martinez', () => photoInScope('/portraits/solano-county/1.webp')),
    false,
  );
});
