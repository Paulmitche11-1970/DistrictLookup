// Run only against a new disposable start-test-server.mjs instance.
import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TOTP, Secret } from 'otpauth';
const config = JSON.parse(readFileSync('.test-build/http-config.json', 'utf8'));
assert.equal(config.origin, 'http://localhost:3001');
assert.equal(
  path.dirname(realpathSync(config.dataDir)).toLowerCase(),
  realpathSync(tmpdir()).toLowerCase(),
);
assert.match(path.basename(config.dataDir), /^district-lookup-http-/);
let checks = 0;
for (const [slug, sample, district, count, mayor] of [
  ['belmont', '1 Aron Ct', '2', 7555, 'Julia Mates'],
  ['midpeninsula-water', '1075 Old County Rd', '5', 7824, null],
]) {
  let cookie = '';
  const base = '/api/agencies/' + slug;
  async function call(route, body, status = 200, auth = true) {
    const r = await fetch(config.origin + route, {
      method: body ? 'POST' : 'GET',
      redirect: 'manual',
      headers: {
        Origin: config.origin,
        ...(auth ? { Cookie: cookie } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = r.headers.get('content-type')?.includes('json')
      ? await r.json()
      : await r.text();
    assert.equal(
      r.status,
      status,
      route + ': ' + JSON.stringify(d).slice(0, 180),
    );
    checks++;
    if (r.headers.get('set-cookie'))
      cookie = r.headers.get('set-cookie').split(';')[0];
    return d;
  }
  const a = (
    await call(base + '/addresses?q=' + encodeURIComponent(sample))
  ).addresses.find((a) => a.label === sample);
  assert.ok(a);
  assert.equal((await call(base + '/lookup?id=' + a.id)).district, district);
  checks += 2;
  await call(base + '/admin', null, 401);
  await call('/api/admin', null, 401);
  const credentials = {
    email: slug + '@example.test',
    name: 'Agency Test',
    password: 'Independent-local-test-password-123!',
  };
  await call(
    base + '/auth/setup',
    { ...credentials, setupToken: config.setupToken },
    403,
  );
  await call(base + '/auth/setup', {
    ...credentials,
    setupToken: config.agencySetupTokens[slug],
  });
  await call(base + '/admin', null, 401);
  const enrollment = await call(base + '/auth/enroll');
  const token = new TOTP({
    issuer: 'District Lookup',
    label: credentials.email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(enrollment.secret),
  }).generate();
  await call(base + '/auth/enroll', { code: token });
  const dashboard = await call(base + '/admin');
  assert.equal(dashboard.addressCount, count);
  checks++;
  await call('/api/admin', null, 401);
  await call('/api/arpeeville/admin', null, 401);
  const original = dashboard.content.officials.find(
    (o) => o.district === district,
  );
  await call(
    base + '/admin',
    {
      action: 'official',
      revision: dashboard.revision,
      official: { ...original, photo: '/portraits/1.jpg' },
    },
    400,
  );
  const changed = {
    ...original,
    bio: 'Shared biography QA for ' + slug,
    bioFormat: 'text',
  };
  await call(base + '/admin', {
    action: 'official',
    revision: dashboard.revision,
    official: changed,
  });
  assert.ok(
    !(await call('/' + slug + '/classic', null, 200, false)).includes(
      '/officials/' + original.id,
    ),
  );
  checks++;
  const draft = await call(base + '/admin');
  await call(base + '/admin', { action: 'publish', revision: draft.revision });
  for (const design of ['classic', 'concierge', 'explorer', 'council']) {
    const html = await call('/' + slug + '/' + design, null, 200, false);
    assert.ok(
      html.includes(
        original.name.replaceAll('&', '&amp;').replaceAll('"', '&quot;'),
      ) || html.includes(original.name),
    );
    if (mayor) assert.ok(html.includes(mayor));
    if (slug === 'midpeninsula-water') {
      assert.ok(html.includes('Division'));
      assert.ok(!html.includes('City Council.'));
    }
    checks++;
  }
  const bio = await call(
    '/' + slug + '/officials/' + original.id,
    null,
    200,
    false,
  );
  assert.ok(bio.includes(changed.bio));
  checks++;
  const current = await call(base + '/admin');
  await call(base + '/admin', {
    action: 'official',
    revision: current.revision,
    official: original,
  });
  const restored = await call(base + '/admin');
  await call(base + '/admin', {
    action: 'publish',
    revision: restored.revision,
  });
  await call(
    '/api/agencies/' +
      (slug === 'belmont' ? 'midpeninsula-water' : 'belmont') +
      '/admin',
    null,
    401,
  );
  console.log(
    slug +
      ': address result, independent MFA administration, draft/publish, four shared layouts and tenant isolation passed.',
  );
}
console.log(checks + ' new-agency HTTP checks passed.');
