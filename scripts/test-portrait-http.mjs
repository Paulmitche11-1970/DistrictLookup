// Disposable local data only. Exercise uploads, shared shapes, reversible crops,
// preview isolation, validation, stale edits and reset through the real API.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
const {
  clientPreviewPassword,
} = require('../.test-build/lib/client-preview-token.js');
const { origin } = JSON.parse(
  readFileSync('.test-build/http-config.json', 'utf8'),
);
assert.equal(origin, 'http://localhost:3001');
const id = 'san-jose-evergreen';
const api = '/api/previews/' + id;
let checks = 0;
async function call(path, cookie = '', body, status = 200, form = false) {
  const response = await fetch(origin + path, {
    redirect: 'manual',
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Cookie: cookie,
      Origin: origin,
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
  const text = await response.text();
  assert.equal(response.status, status, path + ' ' + text.slice(0, 200));
  checks++;
  return { response, text, json: () => JSON.parse(text) };
}
const login = await call(
  api + '/login',
  '',
  { password: clientPreviewPassword(id) },
  303,
  true,
);
const cookie = login.response.headers.get('set-cookie').split(';')[0];
const getState = async () => (await call(api + '/admin', cookie)).json();
let current = await getState();
assert.equal(current.content.agency.sourcePhotoAspectRatio, 0.8);
const original = structuredClone(current.content);
const originalPhoto = original.officials.find((o) => o.id === '3').photo;
const input = await sharp({
  create: { width: 900, height: 600, channels: 3, background: '#e89955' },
})
  .webp()
  .toBuffer();
const upload = new FormData();
upload.set(
  'photo',
  new Blob([input], { type: 'image/webp' }),
  'landscape.webp',
);
const { url } = (await call(api + '/photos', cookie, upload)).json();
assert.ok(url.startsWith(api + '/photos/'));
const file = await fetch(origin + url, { headers: { Cookie: cookie } });
assert.equal(file.status, 200);
const bytes = Buffer.from(await file.arrayBuffer());
const metadata = await sharp(bytes).metadata();
assert.ok(
  Math.abs(metadata.width / metadata.height - 1.5) < 0.005,
  'Upload changed the original proportions',
);
await call(url, '', undefined, 401);
const crop = { x: 0.25, y: 0.75, zoom: 1.6 };
const official = {
  ...original.officials.find((o) => o.id === '3'),
  photo: url,
  photoCrop: crop,
};
await call(api + '/admin', cookie, {
  action: 'official',
  official,
  photoAspectRatio: '4:3',
  revision: current.revision,
});
await call(
  api + '/admin',
  cookie,
  {
    action: 'official',
    official,
    photoAspectRatio: '1:1',
    revision: current.revision,
  },
  409,
);
current = await getState();
assert.deepEqual(
  current.content.officials.find((o) => o.id === '3').photoCrop,
  crop,
);
assert.equal(current.content.agency.photoAspectRatio, '4:3');
for (const layout of ['classic', 'concierge', 'explorer', 'council']) {
  const html = (await call('/' + id + '/' + layout, cookie)).text;
  assert.match(html, /--official-photo-ratio:1\.333333/);
  assert.match(html, /object-position:25% 75%;transform:scale\(1\.6\)/);
}
const profile = (await call('/' + id + '/officials/3', cookie)).text;
assert.match(profile, /--official-photo-ratio:1\.333333/);
assert.match(profile, /object-position:25% 75%;transform:scale\(1\.6\)/);
const publicPage = (await call('/' + id + '/officials/3')).text;
assert.ok(publicPage.includes(originalPhoto));
assert.ok(!publicPage.includes(url));
assert.match(publicPage, /--official-photo-ratio:0\.8/);
for (const bad of [
  { photoAspectRatio: '8:1' },
  { official: { ...official, photoCrop: { ...crop, zoom: 99 } } },
  {
    official: {
      ...official,
      photo: '/api/previews/arpeeville/photos/' + 'a'.repeat(32),
    },
  },
])
  await call(
    api + '/admin',
    cookie,
    { action: 'official', official, revision: current.revision, ...bad },
    400,
  );
assert.equal((await getState()).revision, current.revision);
await call(api + '/admin', cookie, {
  action: 'agency',
  agency: { ...current.content.agency, photoAspectRatio: '1:1' },
  revision: current.revision,
});
current = await getState();
assert.deepEqual(
  current.content.officials.find((o) => o.id === '3').photoCrop,
  crop,
);
const after = await fetch(origin + url, { headers: { Cookie: cookie } });
assert.deepEqual(
  Buffer.from(await after.arrayBuffer()),
  bytes,
  'Changing the frame modified the stored original',
);
await call(api + '/reset', cookie, { revision: current.revision });
current = await getState();
assert.equal(current.previewEdited, false);
assert.deepEqual(current.content, original);
await call(api + '/logout', cookie, {});
console.log(
  `Passed ${checks} portrait HTTP checks: upload proportions, shared shapes, per-official crops, validation, stale saves, reset and live isolation.`,
);
