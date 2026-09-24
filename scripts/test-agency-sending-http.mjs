// Read-only checks against the disposable localhost server, never production.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { origin, reviewPassword } = JSON.parse(
  readFileSync('.test-build/http-config.json', 'utf8'),
);
assert.equal(origin, 'http://localhost:3001');
const instances = JSON.parse(readFileSync('data/instances.json', 'utf8'));
let checks = 0;
async function get(path, cookie = '') {
  const response = await fetch(origin + path, {
    redirect: 'manual',
    headers: { Cookie: cookie },
  });
  checks++;
  return { response, body: await response.text() };
}
const login = await fetch(origin + '/api/review', {
  method: 'POST',
  redirect: 'manual',
  headers: {
    Origin: origin,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    scope: 'rp',
    next: '/admin',
    password: reviewPassword,
  }),
});
assert.equal(login.status, 303);
const rp = login.headers.get('set-cookie').split(';')[0];
const hub = (await get('/admin', rp)).body;
for (const { id } of instances) {
  const path = hub.match(new RegExp(`/send/${id}/[A-Za-z0-9_-]{43}`))?.[0];
  assert.ok(path, id + ' Sending Link exists');
  const sent = await get(path);
  assert.equal(sent.response.status, 303);
  assert.equal(sent.response.headers.get('location'), '/' + id);
  assert.match(sent.response.headers.get('cache-control'), /no-store/);
  assert.equal(sent.response.headers.get('referrer-policy'), 'no-referrer');
  const cookieHeader = sent.response.headers.get('set-cookie');
  assert.match(cookieHeader, new RegExp(`Path=/${id}(;|$)`));
  assert.match(cookieHeader, /HttpOnly/i);
  const cookie = cookieHeader.split(';')[0];
  const gallery = await get('/' + id, cookie);
  assert.equal(gallery.response.status, 200);
  assert.match(gallery.body, /Help residents find their representatives/);
  assert.match(gallery.body, /href="https:\/\/rpdata\.net"/);
  assert.doesNotMatch(
    gallery.body,
    /All agencies|href="\/"|\/send\/|Sending Link/,
  );
  const preview = await get('/' + id + '/administration', cookie);
  assert.equal(preview.response.status, 200);
  assert.match(preview.body, /read-only design preview/);
  if (id === 'arpeeville') {
    const staffPreview = await get(
      '/arpeeville/administration',
      rp + '; ' + cookie,
    );
    assert.equal(staffPreview.response.status, 200);
    assert.doesNotMatch(staffPreview.body, /read-only design preview/);
  }
  // Deliberately send the cookie even outside its browser path scope.
  for (const route of [
    '/',
    '/admin',
    '/logs',
    '/admin/boundaries',
    '/' + (id === 'galt' ? 'barstow-college' : 'galt'),
    '/' + id + '/preview',
  ]) {
    assert.equal(
      (await get(route, cookie)).response.status,
      307,
      id + ' cannot open ' + route,
    );
  }
  const api =
    id === 'martinez'
      ? '/api/admin'
      : id === 'arpeeville'
        ? '/api/arpeeville/admin'
        : `/api/agencies/${id}/admin`;
  assert.equal((await get(api, cookie)).response.status, 401);
  const deniedWrite = await fetch(origin + api, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: origin,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'publish', revision: 0 }),
  });
  assert.equal(deniedWrite.status, 401);
  checks++;
  if (id !== 'arpeeville') {
    const auth = await get('/' + id + '/admin/login', cookie);
    assert.equal(auth.response.status, 200);
    assert.doesNotMatch(auth.body, /Choose another agency/);
  }
  const other = id === 'galt' ? 'barstow-college' : 'galt';
  assert.equal(
    (await get(path.replace('/' + id + '/', '/' + other + '/'))).response
      .status,
    404,
  );
}
assert.equal((await get('/send/galt/GALTPreview')).response.status, 404);
assert.equal((await get('/rpdata')).response.status, 200);
console.log(
  `PASS: ${checks} sending-link HTTP checks across all ${instances.length} agencies; recipients cannot open other galleries, RP tools, drafts or editing APIs.`,
);
