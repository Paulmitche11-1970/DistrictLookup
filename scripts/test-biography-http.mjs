// Run only against the fresh disposable database from start-test-server.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
const config = JSON.parse(readFileSync('.test-build/http-config.json', 'utf8'));
const { origin } = config;
assert.equal(origin, 'http://localhost:3001');
let checks = 0;
async function call(url, { body, cookie = '', status = 200 } = {}) {
  const response = await fetch(origin + url, {
    method: body ? 'POST' : 'GET',
    redirect: 'manual',
    headers: {
      Origin: origin,
      Cookie: cookie,
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
  const result = response.headers.get('content-type')?.includes('json')
    ? await response.json()
    : await response.text();
  assert.equal(
    response.status,
    status,
    url + ': ' + JSON.stringify(result).slice(0, 350),
  );
  checks++;
  return result;
}
await call('/api/health');
const martinez = new DatabaseSync(
  path.join(config.dataDir, 'district-lookup.sqlite'),
  { readOnly: true },
);
const snapshot = () =>
  JSON.stringify(martinez.prepare('SELECT * FROM app_state').all());
const before = snapshot();
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
const cookie = login.headers.get('set-cookie').split(';')[0];
let dashboard = await call('/api/arpeeville/admin', { cookie });
const original = JSON.parse(readFileSync('data/arpeeville/seed.json', 'utf8'));
const member = original.officials.find((o) => o.district === '1');
const mayor = original.officials.find((o) => o.district === null);
const profile = '/arpeeville/officials/' + member.id;
const layouts = ['classic', 'concierge', 'explorer', 'council'];
async function mutate(body, status = 200) {
  await call('/api/arpeeville/admin', {
    cookie,
    body: { revision: dashboard.revision, ...body },
    status,
  });
  dashboard = await call('/api/arpeeville/admin', { cookie });
}
const save = (official) => mutate({ action: 'official', official });
await call(profile + '?preview=1', { status: 307 });
await call('/martinez/officials/1?preview=1', { cookie, status: 307 });
await save({ ...member, bio: '', bioFormat: 'text' });
await mutate({ action: 'publish' });
await call(profile, { status: 404 });
const plain =
  'Local draft biography test.\n\nSecond paragraph keeps <literal> text safe.';
await save({ ...member, bio: plain, bioFormat: 'text' });
await call(profile, { status: 404 });
const preview = await call(profile + '?preview=1', { cookie });
assert.ok(preview.includes('Local draft biography test.'));
assert.ok(preview.includes('&lt;literal&gt;'));
assert.ok(preview.includes('Unpublished biography preview'));
await mutate({ action: 'publish' });
assert.ok((await call(profile)).includes('Local draft biography test.'));

const upload = new FormData();
upload.append(
  'photo',
  new Blob([readFileSync('public/portraits/arpeeville/kimi.jpg')], {
    type: 'image/jpeg',
  }),
  'biography-test.jpg',
);
const { url } = await call('/api/arpeeville/photos', { cookie, body: upload });
await call(url, { status: 404 });
await call(url, { cookie });
const rich = `<h2>Serving our community</h2><p><strong>Biography integration fixture</strong> supports <em>formatted text</em>.</p><ul><li>Neighborhood services</li><li>Open government</li></ul><img src="${url}" alt="Community portrait" /><a href="https://example.com">Read more</a><script>alert('unsafe')</script><img src="https://foreign.example/tracker.png" onerror="alert(1)" /><img src="/portraits/1.jpg" /><a href="javascript:alert(1)">Bad link</a>`;
const richMember = {
  ...member,
  name: 'Biography QA Councilmember',
  termEnd: '2030-11',
  bioFormat: 'html',
  bio: rich,
};
await save(richMember);
const stored = dashboard.content.officials.find((o) => o.id === member.id);
assert.match(stored.bio, /<strong>Biography integration fixture<\/strong>/);
assert.match(stored.bio, /Community portrait/);
assert.doesNotMatch(
  stored.bio,
  /script|onerror|foreign\.example|javascript:|\/portraits\/1\.jpg/,
);
await call(url, { status: 404 });
assert.ok(!(await call(profile)).includes('Biography integration fixture'));
assert.ok(
  (await call(profile + '?preview=1', { cookie })).includes(
    'Biography integration fixture',
  ),
);
for (const layout of layouts) {
  assert.ok(!(await call('/arpeeville/' + layout)).includes(richMember.name));
  const design = layout === 'council' ? 'directory' : layout;
  assert.ok(
    (await call('/arpeeville/preview?design=' + design, { cookie })).includes(
      richMember.name,
    ),
  );
}
await mutate({ action: 'publish' });
const publicPage = await call(profile);
assert.ok(
  publicPage.includes('<strong>Biography integration fixture</strong>'),
);
assert.ok(
  publicPage.replace(/<!--.*?-->/g, '').includes('Term ends November 2030'),
);
assert.ok(publicPage.includes(member.email));
await call(url);
await call(url.replace('/arpeeville', ''), { cookie, status: 404 });
for (const layout of layouts) {
  const html = await call('/arpeeville/' + layout);
  assert.ok(html.includes(richMember.name));
  assert.ok(html.includes('2030-11'));
}
await call('/arpeeville/officials/unknown-profile', { status: 404 });
for (const [key, value] of [
  ['showBiographies', false],
  ['showPhotos', false],
]) {
  await mutate({
    action: 'agency',
    agency: { ...original.agency, [key]: value },
  });
  await mutate({ action: 'publish' });
  await call(url, { status: 404 });
  if (key === 'showBiographies') await call(profile, { status: 404 });
  else assert.ok(!(await call(profile)).includes('src="' + url + '"'));
  assert.equal(
    dashboard.content.officials.find((o) => o.id === member.id).bio,
    stored.bio,
  );
}
await mutate({ action: 'agency', agency: original.agency });
await save({ ...stored, vacant: true });
await mutate({ action: 'publish' });
await call(profile, { status: 404 });
await call(url, { status: 404 });
await save({ ...stored, vacant: false });
await mutate({ action: 'publish' });
await call(profile);
await call(url);
assert.equal(snapshot(), before, 'Biography operations modified Martinez');
// Leave ordinary local profiles with sample text for manual editor/visual QA.
await save({
  ...member,
  bioFormat: 'html',
  bio: '<h2>Serving Arpeeville</h2><p>Gabriella works with residents to strengthen <strong>neighborhood services</strong> and make local government easy to reach.</p><h3>Community priorities</h3><ul><li>Welcoming public spaces</li><li>Responsive constituent service</li><li>Open and accessible government</li></ul>',
});
await save({
  ...mayor,
  bioFormat: 'text',
  bio: 'Liz serves the entire city as mayor.\n\nThis sample biography is for local testing of the biography page.',
});
await mutate({ action: 'publish' });
assert.equal(snapshot(), before);
martinez.close();
console.log(
  `${checks} biography HTTP checks passed: legacy text, formatting sanitation, image ownership/privacy, preview/publish, all four layouts, visibility settings, vacancies and Martinez isolation.`,
);
