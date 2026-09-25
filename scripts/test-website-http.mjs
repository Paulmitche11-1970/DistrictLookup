// Disposable localhost only. Exercises the same authentication and APIs as the editor.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { request as httpRequest } from 'node:http';
const config = JSON.parse(readFileSync('.test-build/http-config.json', 'utf8'));
const { origin, reviewPassword } = config;
assert.equal(origin, 'http://localhost:3001');
let checks = 0;
async function call(
  url,
  { cookie = '', body, status = 200, headers = {} } = {},
) {
  const r = headers.Host
    ? await new Promise((resolve, reject) => {
        const req = httpRequest(origin + url, { headers }, (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () =>
            resolve(
              new Response(Buffer.concat(chunks), {
                status: res.statusCode,
                headers: res.headers,
              }),
            ),
          );
        });
        req.on('error', reject);
        req.end();
      })
    : await fetch(origin + url, {
        method: body ? 'POST' : 'GET',
        redirect: 'manual',
        headers: {
          Origin: origin,
          Cookie: cookie,
          ...(body && !(body instanceof FormData)
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...headers,
        },
        body: body
          ? body instanceof FormData
            ? body
            : JSON.stringify(body)
          : undefined,
      });
  const result = r.headers.get('content-type')?.includes('json')
    ? await r.json()
    : await r.text();
  assert.equal(
    r.status,
    status,
    url + ': ' + JSON.stringify(result).slice(0, 220),
  );
  checks++;
  return { r, result };
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
      password: reviewPassword,
      next: '/admin/website',
    }),
  });
  assert.equal(r.status, 303);
  return {
    cookie: r.headers.get('set-cookie').split(';')[0],
    location: r.headers.get('location'),
  };
}
await call('/api/health');
const agency = new DatabaseSync(
  path.join(config.dataDir, 'district-lookup.sqlite'),
  { readOnly: true },
);
const before = JSON.stringify(agency.prepare('SELECT * FROM app_state').all());
await call('/api/website', { status: 401 });
await call('/admin/website', { status: 307 });
await call('/admin/website/preview/home', { status: 307 });
const rp = await login('rp'),
  martinez = await login('martinez');
assert.equal(new URL(rp.location).pathname, '/admin/website');
await call('/api/website', { cookie: martinez.cookie, status: 401 });
await call('/api/website', {
  cookie: rp.cookie,
  body: { action: 'create' },
  headers: { Origin: 'https://evil.test' },
  status: 403,
});
const hub = (await call('/admin', { cookie: rp.cookie })).result;
const sending = hub.match(/\/send\/galt\/[A-Za-z0-9_-]{43}/)[0];
const sent = await call(sending, { status: 303 });
const agencyCookie = sent.r.headers.get('set-cookie').split(';')[0];
await call('/api/website', { cookie: agencyCookie, status: 401 });
await call('/api/website', {
  cookie: agencyCookie,
  body: { action: 'create' },
  status: 401,
});
const dashboard = await call('/admin/website', { cookie: rp.cookie });
assert.match(dashboard.result, /Website editor/);
assert.match(dashboard.r.headers.get('cache-control'), /no-store/);
const initial = (await call('/api/website', { cookie: rp.cookie })).result;
assert.equal(initial.records.length, 5);
const originalHome = (await call('/rpdata')).result;
const uploadedForm = new FormData();
uploadedForm.append('alt', 'Test staff portrait');
uploadedForm.append(
  'image',
  new Blob([readFileSync('public/rpdata/team/paul.jpg')], {
    type: 'image/jpeg',
  }),
  'portrait.jpg',
);
const uploaded = (
  await call('/api/website/media', { cookie: rp.cookie, body: uploadedForm })
).result.media;
assert.ok(uploaded.width > 0 && uploaded.width <= 2000);
await call(uploaded.url, { status: 404 });
await call(uploaded.url, { cookie: rp.cookie });
const malicious = new FormData();
malicious.append('alt', 'Not an image');
malicious.append(
  'image',
  new Blob(['<svg onload="alert(1)"></svg>'], { type: 'image/png' }),
  'pretend.png',
);
await call('/api/website/media', {
  cookie: rp.cookie,
  body: malicious,
  status: 400,
});
await call('/api/website/media', {
  cookie: martinez.cookie,
  body: malicious,
  status: 401,
});
let page = {
  kind: 'page',
  slug: 'cms-test',
  title: 'CMS integration test',
  description: 'Test description',
  navLabel: 'CMS test',
  order: 80,
  showInNav: true,
  sections: [
    {
      id: 'intro',
      type: 'intro',
      title: 'Private draft heading',
      eyebrow: 'Test only',
      body: '<p><strong>Formatted text</strong></p><script>alert(1)</script>',
      image: uploaded.url,
      alt: 'Test staff portrait',
      link: '/about',
      linkLabel: 'About the team',
      items: [],
    },
  ],
};
let record = (
  await call('/api/website', {
    cookie: rp.cookie,
    body: { action: 'create', document: page },
  })
).result.record;
await call('/rpdata/cms-test', { status: 404 });
assert.doesNotMatch(
  (await call('/rpdata')).result,
  /CMS test|Private draft heading/,
);
const preview = await call('/admin/website/preview/' + record.id, {
  cookie: rp.cookie,
});
assert.match(preview.result, /Private draft heading/);
assert.match(preview.result, /noindex/);
assert.doesNotMatch(preview.result, /<script>alert\(1\)/);
record = (
  await call('/api/website', {
    cookie: rp.cookie,
    body: {
      action: 'publish',
      id: record.id,
      revision: record.revision,
      document: record.draft,
    },
  })
).result.record;
await call(uploaded.url);
assert.match((await call('/rpdata')).result, /CMS test/);
assert.match((await call('/rpdata/cms-test')).result, /Formatted text/);
const hostPage = await call('/cms-test', { headers: { Host: 'rpdata.net' } });
assert.match(hostPage.result, /Private draft heading/);
assert.match(hostPage.result, /href="\/about"/);
const alias = await call('/about', { headers: { Host: 'www.rpdata.net' } });
assert.match(alias.result, /Liz Stitt/);
const redirect = await call('/admin', {
  headers: { Host: 'rpdata.net' },
  status: 307,
});
assert.equal(
  redirect.r.headers.get('location'),
  'https://wheresmydistrict.com/admin/website',
);
page = { ...record.draft, title: 'Second draft title' };
const oldRevision = record.revision;
record = (
  await call('/api/website', {
    cookie: rp.cookie,
    body: {
      action: 'save',
      id: record.id,
      revision: record.revision,
      document: page,
    },
  })
).result.record;
assert.doesNotMatch(
  (await call('/rpdata/cms-test')).result,
  /Second draft title/,
);
await call('/api/website', {
  cookie: rp.cookie,
  body: {
    action: 'publish',
    id: record.id,
    revision: oldRevision,
    document: page,
  },
  status: 409,
});
const histories = (
  await call('/api/website?history=' + record.id, { cookie: rp.cookie })
).result.history;
assert.ok(histories.length >= 3);
record = (
  await call('/api/website', {
    cookie: rp.cookie,
    body: {
      action: 'restore',
      id: record.id,
      revision: record.revision,
      historyId: histories.at(-1).id,
    },
  })
).result.record;
assert.equal(record.draft.title, 'CMS integration test');
record = (
  await call('/api/website', {
    cookie: rp.cookie,
    body: { action: 'unpublish', id: record.id, revision: record.revision },
  })
).result.record;
await call('/rpdata/cms-test', { status: 404 });
await call(uploaded.url, { status: 404 });
let settings = initial.records.find((r) => r.id === 'settings');
settings = (
  await call('/api/website', {
    cookie: rp.cookie,
    body: {
      action: 'save',
      id: 'settings',
      revision: settings.revision,
      document: { ...settings.draft, contactTitle: 'PRIVATE CONTACT' },
    },
  })
).result.record;
assert.doesNotMatch((await call('/rpdata/about')).result, /PRIVATE CONTACT/);
settings = (
  await call('/api/website', {
    cookie: rp.cookie,
    body: {
      action: 'publish',
      id: 'settings',
      revision: settings.revision,
      document: settings.draft,
    },
  })
).result.record;
for (const route of [
  '/rpdata',
  '/rpdata/about',
  '/rpdata/what-we-do',
  '/rpdata/my-district',
])
  assert.match((await call(route)).result, /PRIVATE CONTACT/);
await call('/api/website', {
  cookie: rp.cookie,
  body: {
    action: 'publish',
    id: 'settings',
    revision: settings.revision,
    document: initial.records.find((r) => r.id === 'settings').draft,
  },
});
assert.match(originalHome, /Good data/);
assert.equal(
  JSON.stringify(agency.prepare('SELECT * FROM app_state').all()),
  before,
  'CMS must not change agency data',
);
agency.close();
console.log(
  `Passed ${checks} HTTP checks: staff-only access, CSRF, private drafts/media, real uploads, preview, publication, host routing, conflicts, history, unpublish, shared settings, and agency isolation.`,
);
