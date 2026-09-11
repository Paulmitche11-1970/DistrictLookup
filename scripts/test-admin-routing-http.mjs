import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { origin, reviewPassword } = JSON.parse(
  readFileSync('.test-build/http-config.json', 'utf8'),
);
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw Error('Use a disposable localhost server.');
let checks = 0;
async function get(path, cookie = '') {
  const response = await fetch(origin + path, {
    redirect: 'manual',
    headers: { Cookie: cookie },
  });
  const body = await response.text();
  checks++;
  return { response, body };
}
async function review(scope, next) {
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
  assert.equal(
    new URL(r.headers.get('location'), origin).pathname,
    scope === 'rp' ? '/admin' : '/martinez',
  );
  checks++;
  return r.headers.get('set-cookie').split(';')[0];
}
const login = await get('/admin/login');
assert.equal(login.response.status, 307);
assert.equal(login.response.headers.get('location'), '/admin');
const gated = await get('/admin');
assert.equal(gated.response.status, 307);
const gate = new URL(gated.response.headers.get('location'), origin);
assert.equal(gate.searchParams.get('scope'), 'rp');
assert.equal(gate.searchParams.get('next'), '/admin');
const entry = await get(gate.pathname + gate.search);
assert.match(entry.body, /<h1>RP administration<\/h1>/);
assert.doesNotMatch(entry.body, /martinez-logo\.svg/);
assert.match(entry.body, /href="\/admin\/agencies"/);
const clients = await get('/admin/agencies');
assert.equal(clients.response.status, 200);
assert.match(clients.body, /href="\/martinez\/admin"/);
assert.match(clients.body, /href="\/belmont\/admin"/);
assert.doesNotMatch(clients.body, /href="\/arpeeville\/administration"/);
assert.doesNotMatch(clients.body, /href="\/logs"/);
const martinez = await review('martinez', '/admin');
assert.equal((await get('/admin', martinez)).response.status, 307);
const rp = await review('rp', '/admin');
const hub = await get('/admin', rp);
assert.equal(hub.response.status, 200);
assert.match(hub.body, /<h1>RP administration<\/h1>/);
assert.match(hub.body, /href="\/logs"/);
assert.match(hub.body, /href="\/arpeeville\/administration"/);
for (const agency of ['martinez', 'belmont', 'midpeninsula-water']) {
  assert.match(hub.body, new RegExp(`href="/${agency}/admin"`));
  const r = await get(`/${agency}/admin`, rp);
  assert.equal(r.response.status, 307);
  assert.equal(r.response.headers.get('location'), `/${agency}/admin/login`);
  const form = await get(`/${agency}/admin/login`, rp);
  assert.equal(form.response.status, 200);
  assert.match(form.body, /Choose another agency/);
  assert.match(form.body, new RegExp(`href="/${agency}/lookup"`));
  if (agency !== 'martinez')
    assert.doesNotMatch(form.body, /martinez-logo\.svg/);
  const api =
    agency === 'martinez' ? '/api/admin' : `/api/agencies/${agency}/admin`;
  assert.equal((await get(api, rp)).response.status, 401);
}
const root = await get('/', rp);
assert.match(root.body, /href="\/admin"/);
assert.match(root.body, /href="\/martinez\/admin"/);
assert.equal((await get('/martinez/preview', rp)).response.status, 307);
console.log(
  `PASS: ${checks} admin routing HTTP checks; RP access, agency selection, canonical links and client authorization remain separate.`,
);
