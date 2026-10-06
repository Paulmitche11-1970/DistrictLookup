// Integration checks against a disposable local database only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  clientPreviewPassword,
} = require('../.test-build/lib/client-preview-token.js');
const { origin, reviewPassword } = JSON.parse(
  readFileSync('.test-build/http-config.json', 'utf8'),
);
assert.equal(origin, 'http://localhost:3001');
const instances = JSON.parse(readFileSync('data/instances.json', 'utf8'));
let checks = 0;
async function call(
  path,
  cookie = '',
  body,
  status = 200,
  form = false,
  foreign = false,
) {
  const r = await fetch(origin + path, {
    redirect: 'manual',
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Cookie: cookie,
      Origin: foreign ? 'https://evil.invalid' : origin,
      ...(body === undefined
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
        : form
          ? new URLSearchParams(body)
          : JSON.stringify(body),
  });
  const text = await r.text();
  assert.equal(r.status, status, path + ' ' + text.slice(0, 180));
  checks++;
  let data;
  try {
    data = JSON.parse(text);
  } catch {}
  return { r, text, data };
}
const staff = await call(
  '/api/review',
  '',
  { scope: 'rp', password: reviewPassword, next: '/admin' },
  303,
  true,
);
const rp = staff.r.headers.get('set-cookie').split(';')[0];
const hub = (await call('/admin', rp)).text;
for (const { id } of instances) {
  const loginPath = `/api/previews/${id}/login`;
  assert.ok(hub.includes('/preview/' + id));
  const loginPage = await call('/preview/' + id);
  assert.ok(!loginPage.text.includes(clientPreviewPassword(id)));
  await call(`/api/previews/${id}/admin`, '', undefined, 401);
  const wrong = await call(
    loginPath,
    '',
    { password: 'WrongPassword' },
    303,
    true,
  );
  assert.match(wrong.r.headers.get('location'), /error=incorrect/);
  await call(
    loginPath,
    '',
    { password: clientPreviewPassword(id) },
    403,
    true,
    true,
  );
  const ok = await call(
    loginPath,
    '',
    { password: clientPreviewPassword(id) },
    303,
    true,
  );
  const cookie = ok.r.headers.get('set-cookie').split(';')[0];
  assert.match(ok.r.headers.get('set-cookie'), /HttpOnly/);
  const before = (await call(`/api/previews/${id}/admin`, cookie)).data;
  if (before.previewEdited)
    await call(`/api/previews/${id}/reset`, cookie, {
      revision: before.revision,
    });
  const gallery = await call('/' + id, cookie);
  assert.match(gallery.text, /Prepared default/);
  assert.doesNotMatch(gallery.text, /All agencies|Sending Link/);
  await call('/' + id + '/administration', cookie);
  await call('/' + id + '/preview', cookie);
  for (const path of ['/admin', '/logs', '/admin/boundaries', '/admin/website'])
    await call(path, cookie, undefined, 307);
  const other = id === 'galt' ? 'barstow-college' : 'galt';
  await call(`/api/previews/${other}/admin`, cookie, undefined, 401);
  await call(`/api/previews/${other}/reset`, cookie, { revision: 1 }, 401);
  const api =
    id === 'martinez'
      ? '/api'
      : id === 'arpeeville'
        ? '/api/arpeeville'
        : '/api/agencies/' + id;
  await call(api + '/admin', cookie, undefined, 401);
  await call(api + '/admin', cookie, { action: 'publish', revision: 1 }, 401);
  await call(`/api/previews/${id}/auth/password`, cookie, {}, 404);
  let current = (await call(`/api/previews/${id}/admin`, cookie)).data;
  const original = structuredClone(current.content);
  const edited = {
    ...current.content.officials[0],
    name: 'Preview QA ' + id,
    bio: '<p>Preview <strong>biography</strong><script>alert(1)</script></p>',
    bioFormat: 'html',
  };
  await call(`/api/previews/${id}/admin`, cookie, {
    action: 'official',
    official: edited,
    revision: current.revision,
  });
  await call(
    `/api/previews/${id}/reset`,
    cookie,
    { revision: current.revision },
    409,
  );
  current = (await call(`/api/previews/${id}/admin`, cookie)).data;
  assert.equal(current.previewEdited, true);
  assert.equal(current.content.officials[0].bio.includes('<script'), false);
  for (const design of ['classic', 'concierge', 'explorer', 'council']) {
    const page = await call('/' + id + '/' + design, cookie);
    assert.match(page.text, /Edited preview/);
    assert.ok(page.text.includes(edited.name));
  }
  const bio = await call('/' + id + '/officials/' + edited.id, cookie);
  assert.ok(bio.text.includes('Preview <strong>biography</strong>'));
  const live = await call('/' + id + '/classic');
  assert.ok(!live.text.includes(edited.name));
  await call(
    `/api/previews/${id}/admin`,
    cookie,
    { action: 'publish', revision: current.revision },
    400,
  );
  await call(`/api/previews/${id}/reset`, cookie, {
    revision: current.revision,
  });
  const restored = (await call(`/api/previews/${id}/admin`, cookie)).data;
  assert.equal(restored.previewEdited, false);
  assert.deepEqual(restored.content, original);
  await call(`/api/previews/${id}/logout`, cookie, {});
}
// Uploaded images are private to a preview, including when referenced from a biography.
const id = 'arpeeville';
const login = await call(
  `/api/previews/${id}/login`,
  '',
  { password: clientPreviewPassword(id) },
  303,
  true,
);
const cookie = login.r.headers.get('set-cookie').split(';')[0];
const form = new FormData();
form.set(
  'photo',
  new Blob([readFileSync('public/portraits/arpeeville/gabriella.jpg')], {
    type: 'image/jpeg',
  }),
  'portrait.jpg',
);
const uploaded = await fetch(origin + `/api/previews/${id}/photos`, {
  method: 'POST',
  headers: { Cookie: cookie, Origin: origin },
  body: form,
});
assert.equal(uploaded.status, 200);
checks++;
const { url } = await uploaded.json();
await call(url, '', undefined, 401);
await call(url, cookie);
const current = (await call(`/api/previews/${id}/admin`, cookie)).data;
const official = {
  ...current.content.officials[0],
  photo: url,
  bio: `<p>Photo</p><img src="${url}" alt="Test portrait">`,
  bioFormat: 'html',
};
await call(`/api/previews/${id}/admin`, cookie, {
  action: 'official',
  official,
  revision: current.revision,
});
const saved = (await call(`/api/previews/${id}/admin`, cookie)).data;
assert.equal(saved.content.officials[0].photo, url);
assert.ok(saved.content.officials[0].bio.includes(url));
await call(
  '/api/arpeeville/photos/' + url.split('/').at(-1),
  cookie,
  undefined,
  404,
);
await call(`/api/previews/${id}/reset`, cookie, { revision: saved.revision });
console.log(
  `PASS: ${checks} HTTP checks across ${instances.length} agencies: passwords, all layouts, biography, photo upload, reset, conflicting edits, CSRF, tenant isolation and denied live publication.`,
);
