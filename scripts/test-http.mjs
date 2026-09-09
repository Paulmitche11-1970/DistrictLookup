// Runs against an isolated test database/server, never the production admin account.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { TOTP, Secret } from 'otpauth';
const origin = process.env.TEST_URL || 'http://localhost:3001';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw Error(
    'Integration tests only run on an explicitly configured localhost port.',
  );
const token =
  process.env.TEST_SETUP_TOKEN ||
  JSON.parse(readFileSync('.test-build/http-config.json', 'utf8')).setupToken;
if (!token) throw Error('Set TEST_SETUP_TOKEN for the isolated test server.');
let cookie = '';
let calls = 0;
async function call(url, body, status = 200, options = {}) {
  const headers = {
    Origin: options.origin || origin,
    ...(options.anonymous ? {} : { Cookie: cookie }),
  };
  if (body && !(body instanceof FormData))
    headers['Content-Type'] = 'application/json';
  const response = await fetch(origin + url, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body
      ? body instanceof FormData
        ? body
        : JSON.stringify(body)
      : undefined,
    redirect: 'manual',
  });
  const newCookie = response.headers.get('set-cookie');
  if (newCookie && !options.anonymous) cookie = newCookie.split(';')[0];
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json')
    ? await response.json()
    : type.startsWith('image/')
      ? { bytes: (await response.arrayBuffer()).byteLength }
      : await response.text();
  assert.equal(
    response.status,
    status,
    `${url}: ${JSON.stringify(data).slice(0, 200)}`,
  );
  calls++;
  return data;
}
const password = 'Integration-test-only-37!';
const email = 'qa@example.invalid';
assert.equal((await call('/api/health')).status, 'ok');
await call('/api/admin', null, 401);
await call('/api/admin', { action: 'publish', revision: 1 }, 403, {
  origin: 'https://example.invalid',
});
await call(
  '/api/auth/setup',
  {
    name: 'Quality assurance',
    email,
    password,
    setupToken: 'wrong-token-that-is-long-enough',
  },
  403,
);
await call('/api/auth/setup', {
  name: 'Quality assurance',
  email,
  password,
  setupToken: token,
});
await call('/api/admin', null, 401);
const enrollment = await call('/api/auth/enroll');
const authenticator = new TOTP({
  issuer: 'District Lookup · Martinez',
  label: email,
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  secret: Secret.fromBase32(enrollment.secret),
});
const code = authenticator.generate();
const { recoveryCodes } = await call('/api/auth/enroll', { code });
assert.equal(recoveryCodes.length, 10);
let admin = await call('/api/admin');
assert.equal(admin.content.map.features.length, 4);
const address = (await call('/api/addresses?q=525%20Henrietta')).addresses[0];
assert.equal((await call('/api/lookup?id=' + address.id)).district, '1');
assert.equal(
  (await call('/api/addresses?q=1600%20Pennsylvania')).addresses.length,
  0,
);
await call('/api/lookup?id=invented', null, 404);
await call('/api/lookup?id=' + address.id + '&preview=1', null, 401, {
  anonymous: true,
});
const photo = new FormData();
photo.append(
  'photo',
  new Blob([readFileSync('public/portraits/1.jpg')], { type: 'image/jpeg' }),
  'portrait.jpg',
);
const uploaded = await call('/api/photos', photo);
await call(uploaded.url, null, 404, { anonymous: true });
const official = {
  ...admin.content.officials[0],
  bio: 'Integration test biography.',
  photo: uploaded.url,
};
await call('/api/admin', {
  action: 'official',
  official,
  revision: admin.revision,
});
await call(
  '/api/admin',
  { action: 'official', official, revision: admin.revision },
  409,
);
assert.ok(
  !(await call('/', null, 200, { anonymous: true })).includes(
    'Integration test biography.',
  ),
);
admin = await call('/api/admin');
assert.equal(admin.content.officials[0].bio, official.bio);
await call('/api/admin', { action: 'publish', revision: admin.revision });
assert.ok(
  (await call('/', null, 200, { anonymous: true })).includes(
    'Integration test biography.',
  ),
);
assert.ok(
  (await call(uploaded.url, null, 200, { anonymous: true })).bytes > 100,
);
const invalidPhoto = new FormData();
invalidPhoto.append(
  'photo',
  new Blob(['<script>bad()</script>'], { type: 'image/jpeg' }),
  'bad.jpg',
);
await call('/api/photos', invalidPhoto, 400);
admin = await call('/api/admin');
await call(
  '/api/admin',
  {
    action: 'map',
    revision: admin.revision,
    map: admin.content.map,
    field: 'WRONG_FIELD',
    mapName: 'Wrong',
    effectiveDate: '2022-04-06',
  },
  422,
);
await call('/api/admin', {
  action: 'map',
  revision: admin.revision,
  map: admin.content.map,
  field: 'district',
  mapName: 'Verified integration draft',
  effectiveDate: '2022-04-06',
});
admin = await call('/api/admin');
await call('/api/admin', { action: 'discard', revision: admin.revision });
await call('/api/auth/logout', {});
await call('/api/admin', null, 401);
await call('/api/auth/login', { email, password: 'incorrect-password' }, 401);
await call('/api/auth/login', { email, password });
await call('/api/admin', null, 401);
await call('/api/auth/verify', { code: '000000' }, 401);
await call('/api/auth/verify', { code: recoveryCodes[0], recovery: true });
await call('/api/admin');
await call('/api/auth/logout', {});
await call('/api/auth/login', { email, password });
await call('/api/auth/verify', { code: recoveryCodes[0], recovery: true }, 401);
await call('/api/auth/verify', { code: recoveryCodes[1], recovery: true });
await call('/api/auth/password', {
  currentPassword: password,
  password: 'Replacement-test-password!',
});
await call('/api/auth/logout', {});
await call('/api/auth/login', { email, password }, 401);
await call('/api/auth/login', {
  email,
  password: 'Replacement-test-password!',
});
await call('/api/auth/verify', { code: recoveryCodes[2], recovery: true });
await call('/api/admin');
console.log(
  `PASS: ${calls} HTTP assertions covering authentication, MFA, authorization, CSRF, address lookup, upload validation, draft isolation, publishing, concurrency, map upload, recovery and password change.`,
);
writeFileSync(
  '.test-build/browser-qa.json',
  JSON.stringify({
    email,
    password: 'Replacement-test-password!',
    recoveryCode: recoveryCodes[3],
  }),
);
