// Start a NEW disposable server with `node scripts/start-test-server.mjs` first.
// Then run this script once. Do not reuse a database initialized by another HTTP suite.
import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { TOTP, Secret } from 'otpauth';

const config = JSON.parse(readFileSync('.test-build/http-config.json', 'utf8'));
assert.equal(
  config.origin,
  'http://localhost:3001',
  'Only the disposable localhost harness is allowed',
);
const dataDir = realpathSync(config.dataDir);
assert.equal(
  path.dirname(dataDir).toLowerCase(),
  realpathSync(tmpdir()).toLowerCase(),
);
assert.match(path.basename(dataDir), /^district-lookup-http-/);
assert.ok(
  config.setupToken && config.reviewPassword,
  'Fresh test-server credentials are required',
);
const origin = config.origin;
let calls = 0;
const client = { cookie: '' };
const sandbox = { cookie: '' };
const anonymous = { cookie: '' };

async function call(route, { body, actor = anonymous, status = 200 } = {}) {
  assert.ok(route.startsWith('/') && !route.startsWith('//'));
  const response = await fetch(origin + route, {
    method: body === undefined ? 'GET' : 'POST',
    redirect: 'manual',
    headers: {
      Origin: origin,
      Cookie: actor.cookie,
      ...(body !== undefined && !(body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const cookie = response.headers.get('set-cookie');
  if (cookie && actor !== anonymous) actor.cookie = cookie.split(';')[0];
  const type = response.headers.get('content-type') || '';
  const data = type.includes('json')
    ? await response.json()
    : type.startsWith('image/')
      ? { bytes: (await response.arrayBuffer()).byteLength }
      : await response.text();
  assert.equal(
    response.status,
    status,
    `${route}: ${JSON.stringify(data).slice(0, 180)}`,
  );
  calls++;
  return data;
}

assert.equal(
  (await call('/api/auth/status')).setupRequired,
  true,
  'Restart start-test-server.mjs with a fresh disposable database before running this suite',
);
await call('/api/admin', { status: 401 });
const email = 'representation-qa@example.invalid';
await call('/api/auth/setup', {
  actor: client,
  body: {
    email,
    name: 'Representation QA',
    password: randomBytes(24).toString('hex'),
    setupToken: config.setupToken,
  },
});
await call('/api/admin', { actor: client, status: 401 });
const enrollment = await call('/api/auth/enroll', { actor: client });
const token = new TOTP({
  issuer: 'District Lookup · Martinez',
  label: email,
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  secret: Secret.fromBase32(enrollment.secret),
}).generate();
await call('/api/auth/enroll', { actor: client, body: { code: token } });
const login = await fetch(origin + '/api/review', {
  method: 'POST',
  redirect: 'manual',
  headers: {
    Origin: origin,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    scope: 'rp',
    password: config.reviewPassword,
    next: '/arpeeville/administration',
  }),
});
assert.equal(login.status, 303);
sandbox.cookie = login.headers.get('set-cookie').split(';')[0];
await call('/api/admin', { actor: sandbox, status: 401 });
await call('/api/arpeeville/admin', { actor: client, status: 401 });

function editor(base, actor, initial) {
  let dashboard = initial;
  return {
    get current() {
      return dashboard;
    },
    async refresh() {
      dashboard = await call(base + '/admin', { actor });
    },
    async mutate(body, status = 200) {
      const before = structuredClone(dashboard);
      await call(base + '/admin', {
        actor,
        body: { revision: dashboard.revision, ...body },
        status,
      });
      dashboard = await call(base + '/admin', { actor });
      if (status !== 200) {
        assert.equal(
          dashboard.revision,
          before.revision,
          'Rejected edit changed the revision',
        );
        assert.deepEqual(
          dashboard.content,
          before.content,
          'Rejected edit changed the saved draft',
        );
      } else if (body.action !== 'publish') {
        assert.equal(dashboard.revision, before.revision + 1);
      } else {
        assert.equal(dashboard.publishedRevision, dashboard.revision);
        assert.equal(dashboard.hasChanges, false);
      }
      return dashboard;
    },
  };
}
const martinez = editor(
  '/api',
  client,
  await call('/api/admin', { actor: client }),
);
const arpeeville = editor(
  '/api/arpeeville',
  sandbox,
  await call('/api/arpeeville/admin', { actor: sandbox }),
);
assert.equal(martinez.current.revision, 1, 'Martinez test state must be fresh');
assert.equal(
  arpeeville.current.revision,
  1,
  'Arpeeville test state must be fresh',
);
const sandboxBeforeManagement = structuredClone(arpeeville.current.content);
const martinezSeed = structuredClone(martinez.current.content);
const arpeevilleSeed = structuredClone(arpeeville.current.content);
assert.equal(martinez.current.hasChanges, false);
assert.equal(arpeeville.current.hasChanges, false);
const pages = [
  '/martinez/classic',
  '/martinez/concierge',
  '/martinez/explorer',
  '/martinez/council',
];
async function pageContains(marker, expected, routes = pages) {
  for (const route of routes) {
    const html = await call(route);
    assert.equal(html.includes(marker), expected, `${route}: marker ${marker}`);
  }
}
async function upload() {
  const form = new FormData();
  form.append(
    'photo',
    new Blob([readFileSync('public/portraits/1.jpg')], { type: 'image/jpeg' }),
    'qa.jpg',
  );
  return (await call('/api/photos', { body: form, actor: client })).url;
}
async function restore(target, seed) {
  await target.refresh();
  const seedIds = new Set(seed.officials.map((person) => person.id));
  for (const person of seed.officials) {
    if (
      !target.current.content.officials.some(
        (current) => current.id === person.id,
      )
    )
      await target.mutate({
        action: 'official-add',
        official: { ...person, district: null },
      });
  }
  await target.mutate({
    action: 'representation',
    assignments: target.current.content.officials.map((person) => {
      const original = seed.officials.find(
        (current) => current.id === person.id,
      );
      return {
        id: person.id,
        district: original?.district ?? null,
        selectionMethod: original?.selectionMethod,
      };
    }),
    districtElections: seed.districtElections || {},
  });
  for (const person of target.current.content.officials) {
    if (!seedIds.has(person.id))
      await target.mutate({ action: 'official-remove', id: person.id });
  }
  for (const person of seed.officials)
    await target.mutate({ action: 'official', official: person });
  await target.mutate({
    action: 'management',
    management: seed.management || [],
  });
  await target.mutate({ action: 'agency', agency: seed.agency });
  await target.mutate({ action: 'publish' });
  const byId = (people) => [...people].sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(
    byId(target.current.content.officials),
    byId(seed.officials),
  );
  assert.deepEqual(
    target.current.content.management || [],
    seed.management || [],
  );
  assert.deepEqual(
    target.current.content.districtElections || {},
    seed.districtElections || {},
  );
  assert.deepEqual(target.current.content.agency, seed.agency);
  assert.equal(target.current.hasChanges, false);
}
let failure;
try {
  const photo = await upload();
  const hiddenPhoto = await upload();
  const atLargePhoto = await upload();
  const profile = {
    id: 'qa-management-visible',
    name: 'QA Visible Manager',
    title: 'Deputy City Manager',
    email: 'visible-manager@example.invalid',
    phone: '555-010-9817 ext. 23',
    phoneLabel: 'QA_MANAGEMENT_PHONE_LABEL',
    website: 'https://example.invalid/qa-visible-management',
    photo,
    bio: 'QA_VISIBLE_MANAGEMENT_BIO',
    visible: true,
  };
  const hidden = {
    ...profile,
    id: 'qa-management-hidden',
    name: 'QA Hidden Manager',
    email: 'hidden-manager@example.invalid',
    bio: 'QA_HIDDEN_MANAGEMENT_BIO',
    photo: hiddenPhoto,
    visible: false,
  };
  await martinez.mutate(
    {
      action: 'management',
      management: [profile, { ...hidden, id: profile.id }],
    },
    400,
  );
  await martinez.mutate(
    {
      action: 'management',
      management: [{ ...profile, photo: '/portraits/arpeeville/kimi.jpg' }],
    },
    400,
  );
  await martinez.mutate(
    {
      action: 'management',
      management: [{ ...profile, photo: '/api/photos/' + 'f'.repeat(32) }],
    },
    400,
  );
  await martinez.mutate(
    {
      action: 'management',
      management: [{ ...profile, photo: 'https://example.invalid/photo.jpg' }],
    },
    400,
  );
  await arpeeville.mutate({ action: 'management', management: [profile] }, 400);
  const staleRevision = martinez.current.revision;
  await martinez.mutate({
    action: 'management',
    management: [profile, hidden],
  });
  await martinez.mutate(
    { action: 'management', management: [], revision: staleRevision },
    409,
  );
  await pageContains(profile.name, false);
  await call(photo, { status: 404 });
  await call(photo, { actor: client });
  await martinez.mutate({ action: 'publish' });
  await pageContains(profile.name, true);
  await pageContains(hidden.name, false);
  await pageContains(hidden.email, false);
  await pageContains(hidden.bio, false);
  assert.ok((await call(photo)).bytes > 100);
  await call(hiddenPhoto, { status: 404 });
  await call('/api/arpeeville/photos/' + photo.split('/').at(-1), {
    status: 404,
  });
  assert.deepEqual(
    (await call('/api/arpeeville/admin', { actor: sandbox })).content,
    sandboxBeforeManagement,
  );

  await martinez.mutate({
    action: 'agency',
    agency: {
      ...martinez.current.content.agency,
      showPhotos: false,
      showEmail: false,
      showPhone: false,
      showWebsite: false,
    },
  });
  await martinez.mutate({ action: 'publish' });
  await pageContains(profile.name, true);
  for (const value of [
    profile.email,
    profile.phone,
    profile.phoneLabel,
    profile.website,
    profile.photo,
  ])
    await pageContains(value, false);
  await call(photo, { status: 404 });
  await martinez.mutate({
    action: 'agency',
    agency: { ...martinez.current.content.agency, showManagement: false },
  });
  await martinez.mutate({ action: 'publish' });
  await pageContains(profile.name, false);
  assert.equal(
    martinez.current.content.management.length,
    2,
    'Hidden profiles must remain editable',
  );

  const atLarge = {
    ...martinez.current.content.officials[0],
    id: 'qa-at-large-appointed',
    district: null,
    name: 'QA Appointed Councilmember',
    title: 'Councilmember',
    additionalTitles: [],
    selectionMethod: 'appointed',
    photo: atLargePhoto,
  };
  await martinez.mutate({ action: 'official-add', official: atLarge });
  await martinez.mutate({
    action: 'agency',
    agency: {
      ...martinez.current.content.agency,
      showMayor: false,
      showManagement: true,
      showPhotos: true,
      showEmail: true,
      showPhone: true,
      showWebsite: true,
    },
  });
  await martinez.mutate({ action: 'publish' });
  await pageContains(profile.name, true);
  await pageContains(atLarge.name, true);
  assert.ok(
    (await call(atLargePhoto)).bytes > 100,
    'showMayor=false must not hide a nonmayor at-large photo',
  );
  assert.ok((await call(photo)).bytes > 100);

  const extra = {
    ...arpeeville.current.content.officials.find(
      (person) => person.district !== null,
    ),
    id: 'qa-continuing-member',
    district: null,
    name: 'QA Continuing At Large',
    title: 'Councilmember',
    additionalTitles: [],
    selectionMethod: 'appointed',
    photo: '',
  };
  await arpeeville.mutate(
    { action: 'official-add', official: { ...extra, district: '1' } },
    400,
  );
  await arpeeville.mutate({ action: 'official-add', official: extra });
  await arpeeville.mutate({ action: 'official-add', official: extra }, 409);
  const districtOne = arpeeville.current.content.officials.find(
    (person) => person.district === '1',
  );
  const originalAtLarge = arpeeville.current.content.officials.find(
    (person) => person.district === null && person.id !== extra.id,
  );
  assert.ok(districtOne && originalAtLarge);
  await arpeeville.mutate(
    { action: 'official-remove', id: districtOne.id },
    400,
  );
  const assignments = () =>
    arpeeville.current.content.officials.map(
      ({ id, district, selectionMethod }) => ({
        id,
        district,
        selectionMethod,
      }),
    );
  const transitions = { 1: { status: 'transition', firstElection: '2026-11' } };
  await arpeeville.mutate(
    {
      action: 'representation',
      assignments: assignments(),
      districtElections: transitions,
    },
    422,
  );
  await arpeeville.mutate(
    {
      action: 'representation',
      assignments: assignments().slice(1),
      districtElections: {},
    },
    400,
  );
  await arpeeville.mutate(
    {
      action: 'representation',
      assignments: assignments().map((person, index) =>
        index === 1 ? assignments()[0] : person,
      ),
      districtElections: {},
    },
    400,
  );
  const continuingAssignments = assignments().map((person) =>
    person.id === districtOne.id ? { ...person, district: null } : person,
  );
  await arpeeville.mutate(
    {
      action: 'representation',
      assignments: continuingAssignments,
      districtElections: {},
    },
    422,
  );
  await arpeeville.mutate({
    action: 'representation',
    assignments: continuingAssignments,
    districtElections: transitions,
  });
  await pageContains('2026-11', false, ['/arpeeville/classic']);
  await arpeeville.mutate({ action: 'publish' });
  await pageContains('2026-11', true, [
    '/arpeeville/classic',
    '/arpeeville/concierge',
    '/arpeeville/explorer',
    '/arpeeville/council',
  ]);
  await pageContains(extra.name, true, ['/arpeeville/classic']);
  const address = (await call('/api/arpeeville/addresses?q=Democracy'))
    .addresses[0];
  assert.equal(
    (await call('/api/arpeeville/lookup?id=' + encodeURIComponent(address.id)))
      .district,
    '1',
  );

  await arpeeville.mutate({ action: 'official-remove', id: extra.id });
  await pageContains(extra.name, true, ['/arpeeville/classic']);
  await arpeeville.mutate({
    action: 'official-remove',
    id: originalAtLarge.id,
  });
  await arpeeville.mutate(
    { action: 'official-remove', id: districtOne.id },
    422,
  );
  await arpeeville.mutate({ action: 'publish' });
  await pageContains(extra.name, false, ['/arpeeville/classic']);
  await arpeeville.mutate({
    action: 'representation',
    assignments: assignments().map((person) =>
      person.id === districtOne.id
        ? { ...person, district: '1', selectionMethod: 'elected' }
        : person,
    ),
    districtElections: { 1: { status: 'district', firstElection: '2026-11' } },
  });
  await arpeeville.mutate({ action: 'publish' });
  assert.equal(
    arpeeville.current.content.officials.filter(
      (person) => person.district === '1',
    ).length,
    1,
  );
  assert.equal(
    arpeeville.current.content.districtElections['1'].status,
    'district',
  );
  await martinez.mutate({ action: 'official-remove', id: atLarge.id });
  await martinez.mutate({ action: 'management', management: [] });
  await martinez.mutate({ action: 'publish' });
  await pageContains(profile.name, false);
  await pageContains(atLarge.name, false);
  await call(photo, { status: 404 });
  await call(atLargePhoto, { status: 404 });
} catch (error) {
  failure = error;
} finally {
  for (const [target, seed] of [
    [martinez, martinezSeed],
    [arpeeville, arpeevilleSeed],
  ]) {
    try {
      await restore(target, seed);
    } catch (cleanupError) {
      failure = failure
        ? new AggregateError(
            [failure, cleanupError],
            'HTTP checks and seed restoration failed',
          )
        : cleanupError;
    }
  }
}
if (failure) throw failure;
console.log(
  `PASS: ${calls} local HTTP checks for management privacy, scoped photos, revision protection, mixed representation and district transitions. Original profiles/settings restored and published; only test audit history and unreferenced uploads remain in the disposable data directory.`,
);
