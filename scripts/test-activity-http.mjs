import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
const config = JSON.parse(readFileSync('.test-build/http-config.json', 'utf8'));
const { origin } = config;
assert.equal(
  origin,
  'http://localhost:3001',
  'Only use the disposable local server.',
);
let checks = 0;
async function request(
  url,
  {
    body,
    cookie = '',
    status = 200,
    foreign = false,
    ua = 'Mozilla/5.0 DistrictLookup QA',
  } = {},
) {
  const r = await fetch(origin + url, {
    method: body ? 'POST' : 'GET',
    redirect: 'manual',
    headers: {
      Origin: foreign ? 'https://foreign.example' : origin,
      Cookie: cookie,
      'User-Agent': ua,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  assert.equal(r.status, status, url + ': ' + text.slice(0, 200));
  checks++;
  return { r, text };
}
async function login(scope) {
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
      next: '/logs',
    }),
  });
  assert.equal(r.status, 303);
  if (scope === 'rp')
    assert.equal(new URL(r.headers.get('location'), origin).pathname, '/logs');
  return r.headers.get('set-cookie').split(';')[0];
}
await request('/api/health');
await request('/logs', { status: 307 });
await request('/logs/export', { status: 401 });
const client = await login('martinez');
await request('/logs', { cookie: client, status: 307 });
await request('/logs/export', { cookie: client, status: 401 });
const cookie = await login('rp');
const empty = await request('/logs', { cookie });
assert.equal(empty.r.headers.get('x-frame-options'), 'DENY');
assert.match(empty.r.headers.get('cache-control'), /no-store/);
const db = new DatabaseSync(path.join(config.dataDir, 'activity.sqlite'), {
  readOnly: true,
});
const rows = () => db.prepare('SELECT * FROM events ORDER BY createdAt').all();
const before = rows().length;
const visitId = randomUUID();
const event = (overrides = {}) => ({
  id: randomUUID(),
  visitId,
  path: '/arpeeville/classic',
  design: 'classic',
  type: 'page_view',
  referrer: 'https://www.google.com/search?q=do-not-store-this',
  utmSource: '',
  medium: '',
  campaign: '',
  ...overrides,
});
const first = event();
await request('/api/activity', { body: first, status: 204 });
await request('/api/activity', { body: first, status: 204 });
assert.equal(rows().length, before + 1, 'Retry created a duplicate event');
assert.equal(rows().at(-1).referrerHost, 'google.com');
assert.equal(rows().at(-1).source, 'Google');
assert.ok(!JSON.stringify(rows()).includes('do-not-store-this'));
for (const route of [
  '/logs',
  '/logs/export',
  '/admin',
  '/arpeeville/preview',
  '/arpeeville/administration',
  '/api/admin',
])
  await request('/api/activity', { body: event({ path: route }), status: 400 });
await request('/api/activity', { body: event(), status: 403, foreign: true });
await request('/api/activity', {
  body: event({ password: 'must-not-be-stored' }),
  status: 400,
});
await request('/api/activity', {
  body: event({ type: 'arbitrary-event' }),
  status: 400,
});
await request('/api/activity', {
  body: event(),
  status: 204,
  ua: 'Googlebot/2.1',
});
assert.equal(
  rows().length,
  before + 1,
  'Rejected/private/bot requests added activity',
);
const found = JSON.parse(
  (await request('/api/arpeeville/addresses?q=100%20Democracy')).text,
).addresses[0];
await request('/api/activity', {
  body: event({
    type: 'address_lookup',
    addressId: found.id,
    target: 'Not the real address',
  }),
  status: 204,
});
assert.ok(rows().at(-1).address.includes('100 Democracy Way'));
assert.equal(rows().at(-1).district, '1');
await request('/api/activity', {
  body: event({ type: 'address_lookup', addressId: 'non-existent' }),
  status: 400,
});
await request('/api/activity', {
  body: event({ type: 'district_open', target: '999' }),
  status: 400,
});
await request('/api/activity', {
  body: event({ type: 'district_open', target: '1' }),
  status: 204,
});
await request('/api/activity', {
  body: event({ type: 'official_open', target: 'liz' }),
  status: 204,
});
await request('/api/activity', {
  body: event({ type: 'biography_click', target: 'Biography of Gabriella' }),
  status: 204,
});
await request('/api/activity', {
  body: event({ type: 'search_no_match', query: '=CSV formula test' }),
  status: 204,
});
await request('/api/activity', {
  body: event({ type: 'map_control', target: 'Satellite' }),
  status: 204,
});
await request('/api/activity', {
  body: event({ type: 'phone_click', target: 'Office phone' }),
  status: 204,
});
await request('/api/activity', {
  body: event({
    path: '/martinez/council',
    design: 'directory',
    visitId: randomUUID(),
    referrer: 'https://www.cityofmartinez.org/council',
  }),
  status: 204,
});
await request('/api/activity', {
  body: event({
    path: '/carpinteria/classic',
    visitId: randomUUID(),
    utmSource: 'staff-email',
    medium: 'email',
    campaign: 'September review',
  }),
  status: 204,
});
for (let i = 0; i < 51; i++)
  await request('/api/activity', {
    body: event({
      path: '/arpeeville/concierge',
      design: 'concierge',
      referrer: '',
      visitId: randomUUID(),
    }),
    status: 204,
  });
const report = await request('/logs', { cookie });
assert.ok(report.text.includes('Google'));
assert.ok(report.text.includes('Website: cityofmartinez.org'));
assert.ok(report.text.includes('Campaign: staff-email'));
assert.ok(
  report.text.includes('Page 1 of') ||
    report.text.includes('Page <!-- -->1<!-- --> of'),
);
const filtered = await request('/logs?agency=martinez&type=page_view', {
  cookie,
});
assert.ok(!filtered.text.includes('100 Democracy Way'));
const page2 = await request('/logs?page=2', { cookie });
assert.ok(page2.text.includes('100 Democracy Way'));
const exported = await request(
  '/logs/export?agency=arpeeville&type=address_lookup',
  { cookie },
);
assert.equal(
  exported.text.trim().split('\r\n').length,
  rows().filter((r) => r.agency === 'arpeeville' && r.type === 'address_lookup')
    .length + 1,
);
assert.ok(exported.text.includes('100 Democracy Way'));
assert.ok(!exported.text.includes('do-not-store-this'));
const formulas = await request('/logs/export?type=search_no_match', { cookie });
assert.ok(formulas.text.includes("'=CSV formula test"));
const schema = db
  .prepare('PRAGMA table_info(events)')
  .all()
  .map((v) => v.name);
assert.ok(!schema.some((v) => /ip|password|userAgent/i.test(v)));
db.close();
console.log(
  `${checks} activity HTTP checks passed: RP-only logs/CSV, anti-framing, collection origin/schema/rate safeguards, bot filtering, duplicate retries, verified addresses, source attribution, filters, pagination and safe export.`,
);
