import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { origin, reviewPassword } = JSON.parse(
  readFileSync('.test-build/http-config.json', 'utf8'),
);
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw Error('Use a disposable localhost server.');
const catalog = JSON.parse(
  readFileSync('data/boundaries/index.json', 'utf8'),
).agencies;
let checks = 0;
async function get(path, cookie = '') {
  const r = await fetch(origin + path, {
    redirect: 'manual',
    headers: { Cookie: cookie },
  });
  checks++;
  return { r, body: await r.text() };
}
async function login(scope, next) {
  const r = await fetch(origin + '/api/review', {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Origin: origin,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ scope, next, password: reviewPassword }),
  });
  assert.equal(r.status, 303);
  checks++;
  return {
    cookie: r.headers.get('set-cookie').split(';')[0],
    next: new URL(r.headers.get('location'), origin).pathname,
  };
}
const first = '/admin/boundaries/' + catalog.find((a) => a.mapAvailable).id;
for (const path of ['/admin/boundaries', first]) {
  const { r, body } = await get(path);
  assert.equal(r.status, 307);
  assert.match(r.headers.get('location'), /scope=rp/);
  assert.doesNotMatch(body, /mapSha256|FeatureCollection/);
}
const limited = await login('martinez', first);
assert.equal(limited.next, '/martinez');
assert.equal((await get(first, limited.cookie)).r.status, 307);
const rp = await login('rp', first);
assert.equal(rp.next, first);
assert.equal((await get('/admin/boundaries', rp.cookie)).r.status, 200);
const directory = await get('/', rp.cookie);
for (const agency of catalog) {
  if (agency.id === 'midpeninsula-water-district') continue; // Existing full lookup retains its gallery link.
  assert.ok(directory.body.includes(`href="/admin/boundaries/${agency.id}"`), agency.name);
}
assert.ok(directory.body.includes('href="/midpeninsula-water"'));
assert.ok(directory.body.includes('Boundaries imported'));
for (const a of catalog) {
  const { r, body } = await get('/admin/boundaries/' + a.id, rp.cookie);
  assert.equal(r.status, 200, a.name);
  assert.ok(body.includes(a.name.replaceAll('&', '&amp;')), a.name);
  assert.ok(body.includes(a.shapefile.replaceAll('&', '&amp;')), a.shapefile);
  if (a.mapAvailable) assert.match(body, /FeatureCollection/);
  assert.match(r.headers.get('cache-control'), /no-store/);
}
assert.equal(
  (await get('/admin/boundaries/not-an-agency', rp.cookie)).r.status,
  404,
);
assert.equal((await get('/data/boundaries/index.json')).r.status, 404);
assert.equal(
  (await get('/data/boundaries/' + catalog[0].id + '.json.gz')).r.status,
  404,
);
console.log(
  `PASS: ${checks} boundary-library HTTP checks including every cataloged agency, RP gate, scoped sign-in, and private files.`,
);
