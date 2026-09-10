import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptedRequestOrigin,
  trustedAppOrigins,
  type AppOriginConfig,
} from '../lib/app-origins';
import { checkOrigin, HttpError } from '../lib/security';
import { reviewDestination } from '../lib/review-destination';

const canonical = 'https://wheresmydistrict.com';
const www = 'https://www.wheresmydistrict.com';
const railway = 'https://district-lookup-production.up.railway.app';
const config: AppOriginConfig = {
  APP_URL: canonical,
  ADDITIONAL_APP_ORIGINS: `${www},${railway}`,
};
function request(origin?: string, url = 'http://127.0.0.1:3000/api/admin') {
  return new Request(url, {
    method: 'POST',
    headers: origin === undefined ? {} : { Origin: origin },
  });
}

void test('Canonical and explicitly listed aliases are trusted independently of the internal proxy URL', () => {
  const result = trustedAppOrigins(config);
  assert.equal(result.canonical, canonical);
  assert.deepEqual([...result.origins], [canonical, www, railway]);
  for (const origin of result.origins)
    assert.equal(acceptedRequestOrigin(request(origin), config), origin);
  assert.equal(
    acceptedRequestOrigin(request(www), { APP_URL: canonical }),
    null,
    'The www alias must be explicitly configured',
  );
  assert.equal(
    acceptedRequestOrigin(request(railway), { APP_URL: canonical }),
    null,
    'The Railway alias must be explicitly configured',
  );
});

void test('Missing, opaque, path-bearing, lookalike and unlisted origins remain rejected', () => {
  const denied = [
    undefined,
    '',
    'null',
    'http://wheresmydistrict.com',
    'https://wheresmydistrict.com:444',
    'https://admin.wheresmydistrict.com',
    'https://wheresmydistrict.com.attacker.invalid',
    'https://fakewheresmydistrict.com',
    'https://www.wheresmydistrict.com.attacker.invalid',
    'https://another-service.up.railway.app',
    'https://attacker.invalid',
    canonical + '/',
    canonical + '/admin',
    canonical + '?source=trusted',
    canonical + '#trusted',
    'https://attacker.invalid@wheresmydistrict.com',
    canonical + ', ' + www,
    canonical + ' ' + www,
  ];
  for (const origin of denied)
    assert.equal(acceptedRequestOrigin(request(origin), config), null, origin);
});

void test('Host and forwarded-host headers cannot grant origin trust', () => {
  const forged = new Request(canonical + '/api/review', {
    method: 'POST',
    headers: {
      Origin: 'https://attacker.invalid',
      Host: 'wheresmydistrict.com',
      'X-Forwarded-Host': 'www.wheresmydistrict.com',
      'X-Forwarded-Proto': 'https',
      Forwarded: 'host=wheresmydistrict.com;proto=https',
    },
  });
  assert.equal(acceptedRequestOrigin(forged, config), null);
});

void test('Malformed canonical or alias configuration fails closed instead of silently broadening trust', () => {
  const invalidOrigins = [
    canonical + '/',
    canonical + '/admin',
    canonical + '?query=1',
    canonical + '#fragment',
    'https://user:password@wheresmydistrict.com',
    'https://*.wheresmydistrict.com',
    'https://wheresmydistrict.com:*',
    '//wheresmydistrict.com',
    'wheresmydistrict.com',
    'null',
    'file:///tmp/test',
    'data:text/plain,example',
    'ftp://wheresmydistrict.com',
    'http://wheresmydistrict.com',
    'https://wheresmydistrict.com:443',
    'https://wheresmydistrict.com\\admin',
    'https://wheresmy\ndistrict.com',
  ];
  for (const value of invalidOrigins) {
    assert.throws(
      () =>
        acceptedRequestOrigin(request(canonical), {
          ...config,
          APP_URL: value,
        }),
      /APP_URL must contain exact HTTPS origins/,
      value,
    );
    assert.throws(
      () =>
        acceptedRequestOrigin(request(canonical), {
          APP_URL: canonical,
          ADDITIONAL_APP_ORIGINS: value,
        }),
      /ADDITIONAL_APP_ORIGINS must contain exact HTTPS origins/,
      value,
    );
  }
  for (const aliases of [',', `${www},`, `,${www}`, `${www},,${railway}`])
    assert.throws(() =>
      trustedAppOrigins({
        APP_URL: canonical,
        ADDITIONAL_APP_ORIGINS: aliases,
      }),
    );
  assert.throws(
    () => trustedAppOrigins({ ADDITIONAL_APP_ORIGINS: www }),
    /Set APP_URL before configuring/,
  );
});

void test('Whitespace and duplicate configured origins do not create additional trust', () => {
  const result = trustedAppOrigins({
    APP_URL: '  ' + canonical + '  ',
    ADDITIONAL_APP_ORIGINS: ` ${www} , ${railway}, ${www}, ${canonical} `,
  });
  assert.deepEqual([...result.origins], [canonical, www, railway]);
  assert.deepEqual(
    [
      ...trustedAppOrigins({
        APP_URL: canonical,
        ADDITIONAL_APP_ORIGINS: '   ',
      }).origins,
    ],
    [canonical],
  );
});

void test('Local development keeps exact same-origin fallback and localhost HTTP configuration', () => {
  for (const origin of [
    'http://localhost:3001',
    'http://127.0.0.1:4321',
    'http://[::1]:3000',
  ]) {
    assert.equal(
      acceptedRequestOrigin(request(origin, origin + '/api/review'), {}),
      origin,
    );
    assert.equal(
      acceptedRequestOrigin(request(origin, origin + '/api/review'), {
        APP_URL: origin,
      }),
      origin,
    );
    assert.equal(
      acceptedRequestOrigin(request(undefined, origin + '/api/review'), {}),
      null,
    );
    assert.equal(
      acceptedRequestOrigin(
        request('https://attacker.invalid', origin + '/api/review'),
        {},
      ),
      null,
    );
  }
  assert.equal(
    acceptedRequestOrigin(
      request('http://localhost:3002', 'http://localhost:3001/api/admin'),
      {},
    ),
    null,
  );
  assert.throws(
    () =>
      acceptedRequestOrigin(request(canonical, canonical + '/api/admin'), {}),
    /Set APP_URL/,
  );
  assert.throws(
    () =>
      acceptedRequestOrigin(
        request(
          'http://localhost.attacker.invalid',
          'http://localhost.attacker.invalid/api/admin',
        ),
        {},
      ),
    /Set APP_URL/,
  );
});

void test('Review destinations remain on the accepted alias and cannot become external redirects', () => {
  for (const origin of [canonical, www, railway]) {
    const accepted = acceptedRequestOrigin(request(origin), config)!;
    const next = reviewDestination('rp', '/arpeeville/administration');
    assert.equal(
      new URL(next, accepted).href,
      origin + '/arpeeville/administration',
    );
    assert.equal(new URL('/review-access', accepted).origin, origin);
    for (const unsafe of [
      'https://attacker.invalid/',
      '//attacker.invalid/',
      '/\\attacker.invalid/',
    ])
      assert.equal(
        new URL(reviewDestination('rp', unsafe), accepted).href,
        origin + '/',
      );
  }
});

void test('The API security guard returns only a trusted origin and rejects other requests with HTTP 403', () => {
  const previous = {
    APP_URL: process.env.APP_URL,
    ADDITIONAL_APP_ORIGINS: process.env.ADDITIONAL_APP_ORIGINS,
  };
  try {
    process.env.APP_URL = canonical;
    process.env.ADDITIONAL_APP_ORIGINS = `${www},${railway}`;
    for (const origin of [canonical, www, railway])
      assert.equal(checkOrigin(request(origin)), origin);
    for (const origin of [undefined, 'null', 'https://attacker.invalid'])
      assert.throws(
        () => checkOrigin(request(origin)),
        (error: unknown) => error instanceof HttpError && error.status === 403,
      );
    process.env.ADDITIONAL_APP_ORIGINS = www + '/unexpected-path';
    assert.throws(
      () => checkOrigin(request(canonical)),
      /ADDITIONAL_APP_ORIGINS/,
    );
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
