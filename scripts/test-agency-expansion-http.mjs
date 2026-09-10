// Disposable local production server. Never performs writes against deployed agencies.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const config = JSON.parse(readFileSync('.test-build/http-config.json', 'utf8'));
assert.equal(config.origin, 'http://localhost:3001');
const registry = JSON.parse(readFileSync('data/instances.json', 'utf8'));
const slugs = [
  'san-mateo',
  'burlingame',
  'millbrae',
  'carpinteria',
  'diamond-bar',
  'butte-county',
  'yolo-county',
];
const expected = ['1', '4', '3', '5', '3', '5', '5'];
let checks = 0;
const review = await fetch(config.origin + '/api/review', {
  method: 'POST',
  redirect: 'manual',
  headers: {
    Origin: config.origin,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    scope: 'rp',
    password: config.reviewPassword,
    next: '/',
  }),
});
assert.equal(review.status, 303);
const cookie = review.headers.get('set-cookie').split(';')[0];
async function get(path, status = 200, authenticated = false) {
  const response = await fetch(config.origin + path, {
    redirect: 'manual',
    headers: authenticated ? { Cookie: cookie } : {},
  });
  assert.equal(response.status, status, path);
  checks++;
  return response.headers.get('content-type')?.includes('json')
    ? response.json()
    : response.text();
}
for (const [index, slug] of slugs.entries()) {
  const instance = registry.find((i) => i.id === slug);
  const base = '/api/agencies/' + slug;
  const query = instance.sampleAddress.replace(/\bAv\b/, 'Avenue');
  const suggestions = await get(
    base + '/addresses?q=' + encodeURIComponent(query),
  );
  const address = suggestions.addresses.find(
    (a) => a.label === instance.sampleAddress,
  );
  assert.ok(address, slug + ' sample');
  checks++;
  const answer = await get(
    base + '/lookup?id=' + encodeURIComponent(address.id),
  );
  assert.equal(answer.district, expected[index]);
  checks++;
  await get(
    base + '/lookup?id=' + encodeURIComponent(address.id) + '&preview=1',
    401,
  );
  await get(base + '/admin', 401, true); // RP review access cannot edit a real agency.
  await get('/' + slug, 307);
  const gallery = await get('/' + slug, 200, true);
  assert.ok(gallery.includes(instance.shortName));
  checks++;
  for (const design of ['classic', 'concierge', 'explorer', 'council']) {
    const page = await get('/' + slug + '/' + design);
    assert.ok(page.includes(instance.shortName));
    checks++;
    if (instance.addressNote) {
      assert.ok(page.includes(instance.addressNote));
      checks++;
    }
  }
  await get('/' + slug + '/administration', 200, true);
  await get('/' + slug + '/admin', 307, true);
  const setup = await fetch(config.origin + base + '/auth/setup', {
    method: 'POST',
    headers: { Origin: config.origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Isolation Check',
      email: 'isolation@example.test',
      password: 'Local-test-passphrase-123!',
      setupToken: config.setupToken,
    }),
  });
  assert.equal(setup.status, 403, slug + ' rejects Martinez setup token');
  checks++;
  const foreign = await get(base + '/lookup?id=not-an-agency-address', 404);
  assert.ok(foreign.error);
  checks++;
  console.log(
    slug + ': address, four designs, admin preview and auth isolation passed',
  );
}
console.log(checks + ' expansion checks passed.');
