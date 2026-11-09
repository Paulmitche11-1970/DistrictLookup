// Exercise only the disposable local database created by start-test-server.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
const { origin, dataDir } = JSON.parse(
  readFileSync('.test-build/http-config.json', 'utf8'),
);
assert.equal(origin, 'http://localhost:3001');
assert.ok(
  path
    .resolve(dataDir)
    .startsWith(path.join(tmpdir(), 'district-lookup-http-')),
);
let checks = 0;
async function call(
  url,
  { cookie = '', body, status = 200, form = false, foreign = false } = {},
) {
  const r = await fetch(origin + url, {
    redirect: 'manual',
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Cookie: cookie,
      Origin: foreign ? 'https://untrusted.invalid' : origin,
      ...(body === undefined || body instanceof FormData
        ? {}
        : {
            'Content-Type': form
              ? 'application/x-www-form-urlencoded'
              : 'application/json',
          }),
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : form
            ? new URLSearchParams(body)
            : JSON.stringify(body),
  });
  const text = await r.text();
  assert.equal(r.status, status, url + ' ' + text.slice(0, 180));
  checks++;
  let data;
  try {
    data = JSON.parse(text);
  } catch {}
  return { r, text, data };
}
const agency = 'barstow-college',
  api = '/api/transitions/' + agency;
await call('/barstow-college/classic');
await call(api, { status: 401 });
await call(api, {
  body: { action: 'create', title: 'Unauthorized' },
  status: 401,
});
const db = new DatabaseSync(
  path.join(dataDir, agency, 'district-lookup.sqlite'),
);
const token = randomBytes(32).toString('hex'),
  limited = randomBytes(32).toString('hex');
db.prepare(
  "INSERT INTO admins(id,email,name,password,totp_secret,totp_active,last_totp,created_at) VALUES('transition-qa','qa@example.invalid','Transition QA','unused',NULL,1,-1,?)",
).run(new Date().toISOString());
const session = (token, stage) =>
  db
    .prepare(
      "INSERT INTO sessions(token_hash,admin_id,stage,expires_at) VALUES(?,'transition-qa',?,?)",
    )
    .run(
      createHash('sha256').update(token).digest('hex'),
      stage,
      Date.now() + 3600000,
    );
session(token, 'full');
session(limited, 'verify');
const admin = 'dl_session_' + agency + '=' + token;
await call(api, {
  cookie: 'dl_session_' + agency + '=' + limited,
  status: 401,
});
const original = JSON.parse(
  db.prepare('SELECT published FROM app_state WHERE id=1').get().published,
);
await call(api, {
  cookie: admin,
  body: { action: 'create', title: 'Incoming trustees' },
  foreign: true,
  status: 403,
});
await call(api, {
  cookie: admin,
  body: {
    action: 'create',
    title: 'Incoming trustees',
    swearingIn: '2026-12-01',
  },
});
let dashboard = (await call(api, { cookie: admin })).data;
const input = await sharp({
  create: { width: 400, height: 500, channels: 3, background: '#139a88' },
})
  .png()
  .toBuffer();
const upload = new FormData();
upload.set('photo', new Blob([input], { type: 'image/png' }), 'test.png');
const photo = (
  await call('/api/agencies/' + agency + '/photos', {
    cookie: admin,
    body: upload,
  })
).data.url;
const board = structuredClone(dashboard.transition.board);
board.officials[0].name = 'Incoming Test Trustee';
board.officials[0].photo = photo;
board.officials[0].bioFormat = 'html';
board.officials[0].bio =
  '<p>Incoming trustee biography.</p><img src="' +
  photo +
  '" alt="Incoming biography photo">';
await call(api, {
  cookie: admin,
  body: { action: 'save', ...dashboard.transition, board },
});
await call(api, {
  cookie: admin,
  body: { action: 'save', ...dashboard.transition, board },
  status: 409,
});
dashboard = (await call(api, { cookie: admin })).data;
assert.deepEqual(
  JSON.parse(
    db.prepare('SELECT published FROM app_state WHERE id=1').get().published,
  ),
  original,
);
await call(photo, { status: 404 });
await call(api + '/access?key=invalid', { status: 403 });
const access = await call(
  api + '/access?key=' + dashboard.transition.shareKey,
  { status: 303 },
);
assert.equal(access.r.headers.get('location'), '/barstow-college/transition');
const staff = access.r.headers.get('set-cookie').split(';')[0];
for (const design of ['classic', 'concierge', 'explorer', 'directory']) {
  const page = await call('/barstow-college/transition?design=' + design, {
    cookie: staff,
  });
  assert.match(page.text, /Incoming Test Trustee/);
  assert.match(page.text, /Private staff preview/);
  assert.equal(page.r.headers.get('referrer-policy'), 'no-referrer');
  assert.match(page.r.headers.get('cache-control'), /no-store/);
}
const bio = await call(
  '/barstow-college/transition?official=' + board.officials[0].id,
  { cookie: staff },
);
assert.match(bio.text, /Incoming trustee biography/);
assert.match(bio.text, /Incoming biography photo/);
await call(photo, { cookie: staff });
const addresses = (await call(api + '/addresses?q=100', { cookie: staff })).data
  .addresses;
assert.ok(addresses.length);
const lookup = (
  await call(api + '/lookup?id=' + addresses[0].id, { cookie: staff })
).data;
assert.ok(lookup.district);
await call(api, { cookie: staff, status: 401 });
await call(api, {
  cookie: staff,
  body: {
    action: 'launch',
    ...dashboard.transition,
    liveRevision: dashboard.liveRevision,
    confirm: 'LAUNCH',
  },
  status: 401,
});
await call('/api/transitions/martinez/addresses?q=100', {
  cookie: staff,
  status: 403,
});
await call('/api/agencies/' + agency + '/admin', {
  cookie: staff,
  status: 401,
});
await call(api, {
  cookie: admin,
  body: { action: 'rotate', ...dashboard.transition },
});
await call(api + '/addresses?q=100', { cookie: staff, status: 403 });
await call(photo, { cookie: staff, status: 404 });
await call(api + '/access?key=' + dashboard.transition.shareKey, {
  status: 403,
});
dashboard = (await call(api, { cookie: admin })).data;
await call(api, {
  cookie: admin,
  body: {
    action: 'launch',
    ...dashboard.transition,
    liveRevision: dashboard.liveRevision,
    confirm: 'LAUNCH',
  },
});
const after = (await call(api, { cookie: admin })).data;
assert.equal(after.transition, null);
assert.equal(after.archives.length, 1);
await call(api + '/archive?id=' + after.archives[0].id, {
  cookie: staff,
  status: 401,
});
const archive = (
  await call(api + '/archive?id=' + after.archives[0].id, { cookie: admin })
).data.content;
assert.equal(archive.officials[0].name, original.officials[0].name);
for (const design of ['classic', 'concierge', 'explorer', 'council'])
  assert.match(
    (await call('/barstow-college/' + design)).text,
    /Incoming Test Trustee/,
  );
await call(photo); // Newly published media is now public.
await call(api, {
  cookie: admin,
  body: {
    action: 'restore',
    archiveId: after.archives[0].id,
    title: 'Restore outgoing',
  },
});
const restored = (await call(api, { cookie: admin })).data;
assert.equal(
  restored.transition.board.officials[0].name,
  original.officials[0].name,
);
assert.equal(
  JSON.parse(
    db.prepare('SELECT published FROM app_state WHERE id=1').get().published,
  ).officials[0].name,
  'Incoming Test Trustee',
);
await call(api, {
  cookie: admin,
  body: { action: 'discard', ...restored.transition },
});
// A client preview uses an entirely separate transition and archive.
const login = await call('/api/previews/' + agency + '/login', {
  body: { password: 'BARSTOWPreview' },
  form: true,
  status: 303,
});
const demo = login.r.headers.get('set-cookie').split(';')[0];
await call(api, { cookie: demo, status: 401 });
await call(api + '?demo=1', {
  cookie: demo,
  body: { action: 'create', title: 'Demo transition' },
});
let demoState = (await call(api + '?demo=1', { cookie: demo })).data;
const demoUpload = new FormData();
demoUpload.set('photo', new Blob([input], { type: 'image/png' }), 'demo.png');
const demoPhoto = (
  await call('/api/previews/' + agency + '/photos', {
    cookie: demo,
    body: demoUpload,
  })
).data.url;
demoState.transition.board.officials[0].photo = demoPhoto;
demoState.transition.board.officials[0].name = 'Preview Only Trustee';
await call(api + '?demo=1', {
  cookie: demo,
  body: { action: 'save', ...demoState.transition },
});
demoState = (await call(api + '?demo=1', { cookie: demo })).data;
const demoAccess = await call(
  api + '/access?demo=1&key=' + demoState.transition.shareKey,
  { status: 303 },
);
const demoStaff = demoAccess.r.headers.get('set-cookie').split(';')[0];
await call(demoPhoto, { status: 401 });
await call(demoPhoto, { cookie: demoStaff });
assert.match(
  (await call('/barstow-college/transition?demo=1', { cookie: demoStaff }))
    .text,
  /Preview Only Trustee/,
);
await call(api + '?demo=1', { cookie: demoStaff, status: 401 });
await call(api + '/addresses?q=100', { cookie: demoStaff, status: 403 });
await call(api + '?demo=1', {
  cookie: demo,
  body: {
    action: 'launch',
    ...demoState.transition,
    liveRevision: demoState.liveRevision,
    confirm: 'LAUNCH',
  },
});
assert.equal(
  JSON.parse(
    db.prepare('SELECT published FROM app_state WHERE id=1').get().published,
  ).officials[0].name,
  'Incoming Test Trustee',
);
await call(api + '/access?demo=1&key=' + demoState.transition.shareKey, {
  status: 403,
});
console.log(
  `${checks} transition HTTP checks passed: MFA/agency isolation, CSRF, staff read-only access, four layouts, biography, uploads, lookup, revocation, archive/restore and demo isolation.`,
);
