// Only runs on the disposable local server created by start-test-server.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
const config = JSON.parse(readFileSync('.test-build/http-config.json', 'utf8'));
const origin = config.origin;
if (!/^http:\/\/localhost:3001$/.test(origin))
  throw Error('Local test server required');
const originalAddresses = JSON.parse(
  readFileSync('data/arpeeville/addresses.json', 'utf8'),
);
const jokeAddresses = JSON.parse(
  readFileSync('data/arpeeville/joke-addresses.json', 'utf8'),
);
const allAddresses = [...originalAddresses, ...jokeAddresses];
assert.equal(originalAddresses.length, 25);
assert.equal(jokeAddresses.length, 40);
assert.equal(allAddresses.length, 65);
const db = new DatabaseSync(
  path.join(config.dataDir, 'district-lookup.sqlite'),
  { readOnly: true },
);
let calls = 0;
const state = () => JSON.stringify(db.prepare('SELECT * FROM app_state').all());
async function call(
  url,
  { body, cookie = '', status = 200, foreign = false } = {},
) {
  const r = await fetch(origin + url, {
    method: body ? 'POST' : 'GET',
    redirect: 'manual',
    headers: {
      Cookie: cookie,
      Origin: foreign ? 'https://foreign.example' : origin,
      ...(body && !(body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    body: body
      ? body instanceof FormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });
  const d = r.headers.get('content-type')?.includes('json')
    ? await r.json()
    : await r.text();
  assert.equal(r.status, status, url + ' ' + JSON.stringify(d).slice(0, 180));
  calls++;
  return d;
}
async function review(scope) {
  const r = await fetch(origin + '/api/review', {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Origin: origin,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      scope,
      password: config.reviewPassword,
      next: '/arpeeville/administration',
    }),
  });
  assert.equal(r.status, 303);
  return r.headers.get('set-cookie').split(';')[0];
}
await call('/api/health');
await call('/api/arpeeville/admin', { status: 401 });
await call('/arpeeville/administration', { status: 307 });
await call('/arpeeville/preview', { status: 307 });
const clientCookie = await review('martinez');
await call('/api/arpeeville/admin', { cookie: clientCookie, status: 401 });
const cookie = await review('rp');
const before = state();
await call('/api/admin', { cookie, status: 401 });
await call('/api/arpeeville/auth/setup', { cookie, body: {}, status: 404 });
let dashboard = await call('/api/arpeeville/admin', { cookie });
assert.equal(dashboard.content.agency.sandbox, true);
assert.equal(dashboard.addressCount, 65);
const sandboxDb = new DatabaseSync(
  path.join(config.dataDir, 'arpeeville', 'district-lookup.sqlite'),
  { readOnly: true },
);
try {
  const stored = sandboxDb
    .prepare('SELECT id,label,lon,lat,city FROM addresses')
    .all();
  assert.equal(stored.length, 65);
  assert.equal(new Set(stored.map((a) => a.id)).size, 65);
  assert.equal(new Set(stored.map((a) => `${a.lon},${a.lat}`)).size, 65);
  const byId = new Map(stored.map((a) => [a.id, a]));
  for (const { id, label, lon, lat, city } of allAddresses)
    assert.deepEqual(
      { ...byId.get(id) },
      { id, label, lon, lat, city },
      `Imported joke or preserved original address changed: ${id}`,
    );
} finally {
  sandboxDb.close();
}
const seed = structuredClone(dashboard.content);
const mutate = async (body, status = 200) => {
  await call('/api/arpeeville/admin', {
    cookie,
    body: { revision: dashboard.revision, ...body },
    status,
  });
  dashboard = await call('/api/arpeeville/admin', { cookie });
};
const results = await call('/api/arpeeville/addresses?q=Democracy');
assert.equal(results.addresses.length, 5);
const address = results.addresses[0];
assert.equal(address.city, 'Arpeeville');
assert.equal(
  (await call('/api/arpeeville/lookup?id=' + address.id)).district,
  '1',
);
await call('/api/lookup?id=' + address.id, { status: 404 });
assert.equal((await call('/api/addresses?q=Democracy')).addresses.length, 0);
for (const [label, partialQuery] of [
  ['99 Luft Balloons Way', 'Luft'],
  ['99 Bottles of Beer on the Wall Drive', 'Bottles of Beer'],
  ['1 Amendment Drive', 'Amendment'],
  ['2 Legit to Quit Way', 'Legit to Quit'],
]) {
  const expected = jokeAddresses.find((a) => a.label === label);
  assert.ok(expected, `Missing requested fictional address: ${label}`);
  for (const query of [partialQuery, label]) {
    const suggestions = await call(
      '/api/arpeeville/addresses?q=' + encodeURIComponent(query),
    );
    const found = suggestions.addresses.find((a) => a.id === expected.id);
    assert.ok(found, `Fictional address is not searchable: ${query}`);
    assert.equal(found.label, expected.label);
    assert.equal(found.city, 'Arpeeville');
  }
  const found = await call(
    '/api/arpeeville/lookup?id=' + encodeURIComponent(expected.id),
  );
  assert.equal(found.district, expected.district, label);
  assert.equal(found.address.id, expected.id);
  assert.equal(found.address.lon, expected.lon);
  assert.equal(found.address.lat, expected.lat);
  assert.equal(
    (await call('/api/addresses?q=' + encodeURIComponent(label))).addresses
      .length,
    0,
    `Fictional address leaked into Martinez search: ${label}`,
  );
  await call('/api/lookup?id=' + encodeURIComponent(expected.id), {
    status: 404,
  });
}
const martinezAddress = (await call('/api/addresses?q=Henrietta')).addresses[0];
await call('/api/arpeeville/lookup?id=' + martinezAddress.id, { status: 404 });
await call('/api/arpeeville/lookup?id=' + address.id + '&preview=1', {
  status: 401,
});
await call('/api/arpeeville/admin', {
  cookie,
  body: { action: 'publish', revision: dashboard.revision },
  foreign: true,
  status: 403,
});
await mutate(
  {
    action: 'official',
    official: { ...seed.officials[0], photo: '/portraits/1.jpg' },
  },
  400,
);
const form = new FormData();
form.append(
  'photo',
  new Blob([readFileSync('public/portraits/arpeeville/kimi.jpg')], {
    type: 'image/jpeg',
  }),
  'test.jpg',
);
const uploaded = await call('/api/arpeeville/photos', { cookie, body: form });
assert.match(uploaded.url, /^\/api\/arpeeville\/photos\/[a-f0-9]{32}$/);
await call(uploaded.url, { status: 404 });
await call(uploaded.url, { cookie });
await call(uploaded.url.replace('/arpeeville', ''), { cookie, status: 404 });
await mutate({
  action: 'official',
  official: {
    ...seed.officials[0],
    name: 'Sandbox Draft Only',
    photo: uploaded.url,
  },
});
assert.ok(!(await call('/arpeeville/lookup')).includes('Sandbox Draft Only'));
assert.ok(
  (await call('/arpeeville/preview', { cookie })).includes(
    'Sandbox Draft Only',
  ),
);
await mutate({ action: 'publish' });
assert.ok((await call('/arpeeville/lookup')).includes('Sandbox Draft Only'));
await call(uploaded.url);
assert.equal(state(), before, 'Sandbox photo/edit/publish changed Martinez');
await mutate({
  action: 'agency',
  agency: { ...seed.agency, showPhotos: false, sandbox: false },
});
assert.equal(
  dashboard.content.agency.sandbox,
  true,
  'Fiction label must be immutable',
);
await mutate({ action: 'publish' });
await call(uploaded.url, { status: 404 });
await mutate({ action: 'agency', agency: seed.agency });
await mutate({ action: 'design', design: 'explorer' });
assert.ok(
  !(await call('/arpeeville/lookup')).includes('design-page design-explorer'),
);
await mutate({ action: 'publish' });
assert.ok(
  (await call('/arpeeville/lookup')).includes('design-page design-explorer'),
);
assert.ok(
  (await call('/arpeeville/embed')).includes('design-page design-explorer'),
);
await mutate(
  {
    action: 'map',
    map: seed.map,
    field: 'wrong',
    mapName: 'Bad map',
    effectiveDate: '2026-09-09',
  },
  422,
);
await mutate({
  action: 'map',
  map: seed.map,
  field: 'district',
  mapName: seed.mapName,
  effectiveDate: seed.mapEffectiveDate,
});
await mutate({ action: 'official', official: seed.officials[0] });
await mutate({ action: 'agency', agency: seed.agency });
await mutate({ action: 'publish' });
for (let i = 0; i < 8; i++) {
  const [a, m] = await Promise.all([
    call('/api/arpeeville/admin', { cookie }),
    call('/api/addresses?q=Henrietta'),
  ]);
  assert.equal(a.content.agency.sandbox, true);
  assert.ok(m.addresses.every((x) => !x.city));
}
assert.equal(
  state(),
  before,
  'Sandbox mutations or concurrent requests changed Martinez',
);
assert.ok(dashboard.activity.length >= 10);
console.log(
  `${calls} Arpeeville checks passed: 65 preserved/imported addresses, four requested joke searches and district lookups, review auth, CSRF, draft privacy, photos, publish, design, map validation, address and storage isolation.`,
);
db.close();
