// Disposable localhost test server only. Verifies the real-agency route and MFA boundary.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOTP, Secret } from 'otpauth';
const config = JSON.parse(readFileSync('.test-build/http-config.json', 'utf8'));
assert.equal(config.origin, 'http://localhost:3001');
let cookie = '';
let calls = 0;
const base = '/api/agencies/solano-county';
async function call(url, body, status = 200, suppliedCookie = cookie) {
  const response = await fetch(config.origin + url, {
    method: body ? 'POST' : 'GET',
    redirect: 'manual',
    headers: {
      Origin: config.origin,
      Cookie: suppliedCookie,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.headers.get('content-type')?.includes('json')
    ? await response.json()
    : await response.text();
  assert.equal(
    response.status,
    status,
    url + ' ' + JSON.stringify(data).slice(0, 120),
  );
  calls++;
  if (response.headers.get('set-cookie'))
    cookie = response.headers.get('set-cookie').split(';')[0];
  return data;
}
await call(base + '/admin', undefined, 401);
await call('/solano-county/preview', undefined, 307);
await call('/api/agencies/napa-county/addresses?q=Main', undefined, 404);
await call('/api/agencies/arpeeville/auth/status', undefined, 404);
const rp = await fetch(config.origin + '/api/review', {
  method: 'POST',
  redirect: 'manual',
  headers: {
    Origin: config.origin,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    scope: 'rp',
    password: config.reviewPassword,
    next: '/solano-county',
  }),
});
assert.equal(new URL(rp.headers.get('location')).pathname, '/solano-county');
const rpCookie = rp.headers.get('set-cookie').split(';')[0];
await call(base + '/admin', undefined, 401, rpCookie);
await call('/solano-county', undefined, 200, rpCookie);
const credentials = {
  email: 'solano-admin@example.test',
  name: 'Solano QA',
  password: 'Solano-only-test-password!',
};
await call(
  base + '/auth/setup',
  { ...credentials, setupToken: config.setupToken },
  403,
);
assert.equal(
  (
    await call(base + '/auth/setup', {
      ...credentials,
      setupToken: config.solanoSetupToken,
    })
  ).next,
  '/solano-county/admin/enroll',
);
assert.ok(cookie.startsWith('dl_session_solano-county='));
await call(base + '/admin', undefined, 401);
const enrollment = await call(base + '/auth/enroll');
const token = new TOTP({
  issuer: 'District Lookup · Solano County',
  label: credentials.email,
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  secret: Secret.fromBase32(enrollment.secret),
}).generate();
assert.equal(
  (await call(base + '/auth/enroll', { code: token })).next,
  '/solano-county/admin',
);
let dashboard = await call(base + '/admin');
assert.equal(dashboard.content.agency.name, 'Solano County');
assert.equal(dashboard.addressCount, 181255);
await call('/api/admin', undefined, 401);
await call('/api/arpeeville/admin', undefined, 401);
const address = (await call(base + '/addresses?q=675%20Texas')).addresses.find(
  (a) => a.label === '675 Texas Street',
);
assert.ok(address);
assert.equal(
  (
    await call(
      base +
        '/addresses?q=' +
        encodeURIComponent('675 Texas Street, Fairfield, California 94533'),
    )
  ).addresses[0].id,
  address.id,
);
assert.equal(
  (
    await call(
      base +
        '/addresses?q=' +
        encodeURIComponent('675 Texas St Fairfield CA 94533 USA'),
    )
  ).addresses[0].id,
  address.id,
);
assert.equal((await call(base + '/lookup?id=' + address.id)).district, '3');
assert.equal(
  (await call(base + '/addresses?q=100%20Democracy')).addresses.length,
  0,
);
await call('/api/lookup?id=' + address.id, undefined, 404);
const official = {
  ...dashboard.content.officials[0],
  name: 'Solano draft review',
  photo: '/portraits/1.jpg',
};
await call(
  base + '/admin',
  { action: 'official', revision: dashboard.revision, official },
  400,
);
official.photo = dashboard.content.officials[0].photo;
await call(base + '/admin', {
  action: 'official',
  revision: dashboard.revision,
  official,
});
const publicPage = await call('/solano-county/classic');
assert.ok(!publicPage.includes('Solano draft review'));
dashboard = await call(base + '/admin');
await call(base + '/admin', {
  action: 'publish',
  revision: dashboard.revision,
});
assert.ok(
  (await call('/solano-county/classic')).includes('Solano draft review'),
);
assert.ok(!(await call('/martinez/classic')).includes('Solano draft review'));
const headers = await fetch(config.origin + '/solano-county/admin');
assert.equal(headers.headers.get('x-frame-options'), 'DENY');
console.log(
  `PASS: ${calls} multiagency HTTP checks covering separate setup codes, MFA sessions, RP review restrictions, draft/publish isolation and county-only address lookup.`,
);
