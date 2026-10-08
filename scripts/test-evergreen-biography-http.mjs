// Exercises real server rendering and editable previews against disposable local data only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  clientPreviewPassword,
} = require('../.test-build/lib/client-preview-token.js');
const { origin } = JSON.parse(
  readFileSync('.test-build/http-config.json', 'utf8'),
);
assert.equal(origin, 'http://localhost:3001');
const agency = 'san-jose-evergreen';
const api = '/api/previews/' + agency;
const profile = '/' + agency + '/officials/';
const fallback =
  /An administrator can add biographical information in the\s*backend editor\./;
let checks = 0;
async function call(path, cookie = '', body, status = 200, form = false) {
  const response = await fetch(origin + path, {
    redirect: 'manual',
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Cookie: cookie,
      Origin: origin,
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
  const text = await response.text();
  assert.equal(response.status, status, path + ' ' + text.slice(0, 200));
  checks++;
  return { response, text, json: () => JSON.parse(text) };
}
for (const design of ['classic', 'concierge', 'explorer', 'directory']) {
  const tony = await call(profile + '3?design=' + design);
  assert.match(tony.text, /JW Consulting Group/);
  assert.match(
    tony.text,
    /class="official-portrait biography-portrait"[^>]*><img src="\/portraits\/san-jose-evergreen\/3.webp"/,
  );
  assert.ok(tony.text.includes('/san-jose-evergreen/lookup?design=' + design));
  assert.match((await call(profile + '1?design=' + design)).text, fallback);
}
const login = await call(
  api + '/login',
  '',
  { password: clientPreviewPassword(agency) },
  303,
  true,
);
const cookie = login.response.headers.get('set-cookie').split(';')[0];
const getState = async () => (await call(api + '/admin', cookie)).json();
let current = await getState();
assert.equal(current.previewEdited, false);
assert.match(
  current.content.officials.find((o) => o.id === '3').bio,
  /JW Consulting Group/,
);
const edited = {
  ...current.content.officials.find((o) => o.id === '3'),
  bio: '<p>Our edited trustee biography.</p>',
  bioFormat: 'html',
};
await call(api + '/admin', cookie, {
  action: 'official',
  official: edited,
  revision: current.revision,
});
for (const design of ['classic', 'concierge', 'explorer', 'directory']) {
  const page = await call(profile + '3?design=' + design, cookie);
  assert.match(page.text, /Our edited trustee biography/);
  assert.doesNotMatch(page.text, /JW Consulting Group/);
}
assert.match((await call(profile + '3')).text, /JW Consulting Group/);
current = await getState();
await call(api + '/admin', cookie, {
  action: 'agency',
  revision: current.revision,
  agency: {
    ...current.content.agency,
    showPhotos: false,
    showEmail: false,
    showWebsite: false,
    showTerm: false,
  },
});
const hiddenContact = (await call(profile + '3', cookie)).text;
assert.doesNotMatch(
  hiddenContact,
  /class="official-portrait biography-portrait"|mailto:|Term ends|Official website/,
);
assert.match(hiddenContact, /Our edited trustee biography/);
current = await getState();
await call(api + '/admin', cookie, {
  action: 'agency',
  revision: current.revision,
  agency: { ...current.content.agency, showBiographies: false },
});
// Next may stream the shell with 200; either way the protected content must be absent.
const hiddenResponse = await fetch(origin + profile + '3', {
  headers: { Cookie: cookie },
});
const hidden = await hiddenResponse.text();
assert.ok(
  hiddenResponse.status === 404 ||
    hidden.includes('NEXT_HTTP_ERROR_FALLBACK;404'),
);
assert.doesNotMatch(
  hidden,
  /Our edited trustee biography|class="official-portrait biography-portrait"/,
);
checks++;
current = await getState();
await call(api + '/reset', cookie, { revision: current.revision });
current = await getState();
assert.equal(current.previewEdited, false);
assert.match((await call(profile + '3', cookie)).text, /JW Consulting Group/);
assert.match((await call(profile + '1', cookie)).text, fallback);
await call(api + '/logout', cookie, {});
console.log(
  `Passed ${checks} biography HTTP checks (profiles, four layout return links, preview editing, visibility, reset and live isolation).`,
);
