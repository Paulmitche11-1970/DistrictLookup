import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
const config = JSON.parse(readFileSync('.test-build/http-config.json', 'utf8'));
const { origin, dataDir } = config;
assert.equal(
  origin,
  'http://localhost:3001',
  'Use only the disposable local server.',
);
let checks = 0;
async function call(
  url,
  { cookie = '', body, status = 200, form = false, foreign = false } = {},
) {
  const r = await fetch(origin + url, {
    method: body === undefined ? 'GET' : 'POST',
    redirect: 'manual',
    headers: {
      Origin: foreign ? 'https://evil.example' : origin,
      Cookie: cookie,
      'User-Agent': 'Mozilla/5.0 Outreach QA',
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
  assert.equal(r.status, status, url + ' ' + text.slice(0, 250));
  checks++;
  let data;
  try {
    data = JSON.parse(text);
  } catch {}
  return { r, text, data };
}
const visitId = randomUUID();
const attribution =
  'rp_activity_context=' +
  encodeURIComponent(
    JSON.stringify({
      id: visitId,
      touched: Date.now(),
      source: 'Campaign: outreach-test',
      referrerHost: '',
      medium: 'email',
      campaign: 'October trial',
    }),
  );
const event = (overrides = {}) => ({
  id: randomUUID(),
  visitId,
  path: '/preview/galt',
  type: 'page_view',
  utmSource: 'outreach-test',
  medium: 'email',
  campaign: 'October trial',
  ...overrides,
});
await call('/admin/outreach', { status: 307 });
await call('/api/implementation', { body: {}, status: 401 });
await call('/galt/implementation', { status: 307 });
await call('/api/implementation/galt', { body: {}, status: 401 });
await call('/api/activity', { body: event(), status: 204 });
const previewLogin = await call('/api/previews/galt/login', {
  cookie: attribution,
  body: { password: 'GALTPreview' },
  form: true,
  status: 303,
});
const client =
  previewLogin.r.headers.get('set-cookie').split(';')[0] + '; ' + attribution;
const entryRedirect = await call(
  '/preview/galt?utm_source=rp_outreach&utm_medium=email&utm_campaign=galt',
  { cookie: client, status: 307 },
);
assert.match(entryRedirect.r.headers.get('location'), /utm_source=rp_outreach/);
const gallery = await call('/galt', { cookie: client });
assert.match(gallery.text, /Use this tool/);
assert.match(gallery.text, /July 1, 2027/);
for (const p of [
  '/galt',
  '/galt/classic',
  '/galt/concierge',
  '/galt/council',
  '/galt/administration',
  '/galt/implementation',
])
  await call('/api/activity', {
    cookie: client,
    body: event({ path: p }),
    status: 204,
  });
await call('/api/activity', {
  body: event({ path: '/galt/administration' }),
  status: 401,
});
await call('/api/activity', {
  cookie: client,
  body: event({ path: '/martinez/administration' }),
  status: 401,
});
for (const type of [
  'preview_login',
  'preview_save',
  'preview_reset',
  'implementation_request',
])
  await call('/api/activity', {
    cookie: client,
    body: event({ type, path: '/galt' }),
    status: 400,
  });
const initial = (await call('/api/previews/galt/admin', { cookie: client }))
  .data;
const input = {
  requestKey: randomUUID(),
  revision: initial.revision,
  offerVersion: 'basic-2027-v1',
  name: 'Test contact',
  title: 'City administrator',
  email: 'test-contact@example.org',
  phone: '',
  website: 'https://agency.example.org',
  billingName: 'Accounts payable',
  billingEmail: 'billing@example.org',
  billingAddress: 'Test PO instructions',
  layout: 'concierge',
  delivery: 'both',
  frequency: 'annual',
  notes: 'Test requested adjustment',
  authorized: true,
  pricingAccepted: true,
};
await call('/api/implementation/galt', {
  cookie: client,
  body: input,
  foreign: true,
  status: 403,
});
await call('/api/implementation/martinez', {
  cookie: client,
  body: input,
  status: 401,
});
await call('/api/implementation/galt', {
  cookie: client,
  body: { ...input, authorized: false },
  status: 400,
});
await call('/api/implementation/galt', {
  cookie: client,
  body: { ...input, revision: initial.revision + 10 },
  status: 409,
});
const result = await call('/api/implementation/galt', {
  cookie: client,
  body: input,
  status: 201,
});
const id = result.data.id;
const again = await call('/api/implementation/galt', {
  cookie: client,
  body: input,
});
assert.equal(again.data.id, id);
await call('/api/implementation/galt', {
  cookie: client,
  body: { ...input, requestKey: randomUUID() },
  status: 409,
});
const receipt = await call('/galt/implementation', { cookie: client });
assert.match(receipt.text, /REQUEST RECEIVED/);
assert.ok(
  !receipt.text.includes('billing@example.org'),
  'Shared receipt must not expose billing details',
);
await call('/admin/outreach', { cookie: client, status: 307 });
await call('/admin/outreach/' + id, { cookie: client, status: 307 });
await call('/admin/outreach/' + id + '/snapshot', {
  cookie: client,
  status: 401,
});
await call('/api/implementation', { cookie: client, body: {}, status: 401 });
const login = await call('/api/review', {
  body: {
    scope: 'rp',
    password: config.reviewPassword,
    next: '/admin/outreach',
  },
  status: 303,
  form: true,
});
assert.equal(
  new URL(login.r.headers.get('location'), origin).pathname,
  '/admin/outreach',
);
const staff = login.r.headers.get('set-cookie').split(';')[0];
await call('/api/activity', {
  cookie: staff,
  body: event({ path: '/galt/classic' }),
  status: 204,
});
const dashboard = await call('/admin/outreach?agency=galt', { cookie: staff });
assert.match(dashboard.text, /test-contact@example.org/);
assert.match(dashboard.text, /outreach-test/);
assert.match(dashboard.text, /October trial/);
assert.match(dashboard.text, /concierge/);
const detail = await call('/admin/outreach/' + id, { cookie: staff });
assert.match(detail.text, /billing@example.org/);
assert.match(detail.text, /First invoice/);
assert.match(detail.r.headers.get('cache-control'), /no-store/);
assert.equal(detail.r.headers.get('x-frame-options'), 'DENY');
const snapshot = await call('/admin/outreach/' + id + '/snapshot', {
  cookie: staff,
});
assert.deepEqual(snapshot.data, initial.content);
const edited = { ...initial.content.officials[0], name: 'Outreach Test Edit' };
await call('/api/previews/galt/admin', {
  cookie: client,
  body: { action: 'official', official: edited, revision: initial.revision },
});
const after = (await call('/api/previews/galt/admin', { cookie: client })).data;
await call('/api/previews/galt/reset', {
  cookie: client,
  body: { revision: after.revision },
});
assert.deepEqual(
  (await call('/admin/outreach/' + id + '/snapshot', { cookie: staff })).data,
  snapshot.data,
);
const implementation = new DatabaseSync(
  path.join(dataDir, 'implementation.sqlite'),
  { readOnly: true },
);
assert.equal(
  implementation
    .prepare('SELECT COUNT(*) n FROM requests WHERE agency=?')
    .get('galt').n,
  1,
);
const saved = JSON.parse(
  implementation.prepare('SELECT payload FROM requests WHERE id=?').get(id)
    .payload,
);
assert.equal(saved.billingStarts, '2027-07-01');
assert.equal(saved.amountCents, 90000);
const update = {
  id,
  version: 1,
  status: 'reviewing',
  billingStatus: 'draft',
  serviceStart: '',
  owner: 'RP QA',
  invoiceReference: '',
  note: 'Reviewed locally',
};
await call('/api/implementation', { cookie: staff, body: update });
await call('/api/implementation', { cookie: staff, body: update, status: 409 });
await call('/api/implementation', {
  cookie: staff,
  body: {
    ...update,
    version: 2,
    status: 'live',
    serviceStart: '2026-10-07',
    billingStatus: 'issued',
    invoiceReference: 'TEST',
  },
  status: 400,
});
const activity = new DatabaseSync(path.join(dataDir, 'activity.sqlite'), {
  readOnly: true,
});
const rows = activity
  .prepare('SELECT * FROM events WHERE visitId=?')
  .all(visitId);
assert.equal(rows.filter((r) => r.type === 'implementation_request').length, 1);
assert.equal(
  rows.find((r) => r.type === 'preview_login').source,
  'Campaign: outreach-test',
);
assert.equal(
  rows.find((r) => r.type === 'preview_save').audience,
  'agency_preview',
);
assert.ok(rows.some((r) => r.type === 'preview_reset'));
assert.ok(rows.some((r) => r.audience === 'rp_staff'));
assert.ok(!JSON.stringify(rows).includes(input.email));
assert.ok(!JSON.stringify(rows).includes(input.notes));
const csv = await call(
  '/logs/export?agency=galt&audience=agency_preview&visit=' + visitId,
  { cookie: staff },
);
assert.match(csv.text, /Preview changes saved/);
assert.ok(!csv.text.includes('rp_staff'));
const sjeLogin = await call('/api/previews/san-jose-evergreen/login', {
  body: { password: 'SJECCDPreview' },
  form: true,
  status: 303,
});
const sje = sjeLogin.r.headers.get('set-cookie').split(';')[0];
const sjeForm = await call('/san-jose-evergreen/implementation', {
  cookie: sje,
});
assert.match(sjeForm.text, /December 31, 2031/);
assert.match(sjeForm.text, /January 1, 2032/);
assert.doesNotMatch(sjeForm.text, /July 1, 2027/);
const sjeState = (
  await call('/api/previews/san-jose-evergreen/admin', { cookie: sje })
).data;
await call('/api/implementation/san-jose-evergreen', {
  cookie: sje,
  body: { ...input, requestKey: randomUUID(), revision: sjeState.revision },
  status: 409,
});
await call('/api/implementation/san-jose-evergreen', {
  cookie: sje,
  body: {
    ...input,
    requestKey: randomUUID(),
    revision: sjeState.revision,
    offerVersion: 'sje-free-through-2031-v1',
  },
  status: 201,
});
const sjeSaved = JSON.parse(
  implementation
    .prepare('SELECT payload FROM requests WHERE agency=?')
    .get('san-jose-evergreen').payload,
);
assert.equal(sjeSaved.billingStarts, '2032-01-01');
activity.close();
implementation.close();
console.log(
  checks +
    ' outreach HTTP checks passed: attribution, audience isolation, server-verified actions, scoped requests, replay safety, immutable preview snapshot, pricing exceptions, workflow conflicts and billing safeguards.',
);
