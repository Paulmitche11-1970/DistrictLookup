import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  biographyEditorHtml,
  biographyPath,
  hasBiography,
} from '../lib/biography';
import {
  biographyHtml,
  biographyImages,
  sanitizeBiography,
} from '../lib/biography-html';
import { inArpeeville } from '../lib/agency-scope';
import { visibleContent } from '../lib/store';
import { officialSchema } from '../lib/validation';
import type { Content } from '../lib/model';

void test('Legacy plain biographies retain paragraphs and literal text without becoming executable HTML', () => {
  const official = {
    bio: 'A & B <script>alert(1)</script>\nSecond line\n\nNext paragraph.',
  };
  const html = biographyHtml(official);
  assert.match(html, /A &amp; B &lt;script&gt;/);
  assert.match(html, /<br\s*\/>Second line/);
  assert.match(html, /<p>Next paragraph\.<\/p>/);
  assert.doesNotMatch(html, /<script/);
  assert.ok(hasBiography(official));
});
void test('Rich biographies allow useful formatting while removing executable HTML and unsafe URLs', () => {
  const raw =
    '<h2>Public service</h2><p style="text-align:center;position:fixed;background:url(https://bad.example)"><strong>Experience</strong> and <u>education</u></p><ul><li>One</li></ul><script>alert(1)</script><iframe src="https://bad.example"></iframe><svg onload="alert(1)"></svg><a href="javascript:alert(1)" onclick="alert(1)">Bad</a><a href="https://example.org" target="_self">Website</a>';
  const html = sanitizeBiography(raw);
  assert.match(html, /<h2>Public service<\/h2>/);
  assert.match(html, /style="text-align:center"/);
  assert.match(html, /<ul><li>One<\/li><\/ul>/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(
    html,
    /script|iframe|svg|onclick|javascript|position:|background:|bad\.example/,
  );
  assert.equal(sanitizeBiography(html), html);
});
void test('Biography pictures stay in their agency scope and respect the photo display setting', () => {
  const id = 'a'.repeat(32);
  const src = '/api/arpeeville/photos/' + id;
  const html = `<p>Welcome</p><img src="${src}" alt="At a community meeting" onerror="alert(1)"><img src="https://foreign.example/pixel"><img src="/api/photos/${id}"><img src="data:image/svg+xml,test">`;
  inArpeeville(() => {
    const clean = sanitizeBiography(html);
    assert.deepEqual(biographyImages({ bio: clean, bioFormat: 'html' }), [src]);
    assert.doesNotMatch(clean, /foreign|onerror|data:image/);
    assert.doesNotMatch(sanitizeBiography(html, false), /<img/);
  });
  assert.doesNotMatch(sanitizeBiography(html), /arpeeville/);
});
void test('Empty biographies have no links; a supported picture counts as biography content', () => {
  assert.equal(hasBiography({ bio: '  ' }), false);
  assert.equal(
    hasBiography({ bio: '<p><br></p><p>&nbsp;</p>', bioFormat: 'html' }),
    false,
  );
  assert.equal(hasBiography({ bio: '<p>Career</p>', bioFormat: 'html' }), true);
  assert.equal(
    hasBiography({ bio: '<img src="/portraits/1.jpg">', bioFormat: 'html' }),
    true,
  );
  assert.equal(biographyEditorHtml({ bio: '' }), '');
  assert.equal(
    biographyPath('arpeeville', 'liz', true, 'directory'),
    '/arpeeville/officials/liz?design=directory&preview=1',
  );
});
void test('Biographies use shared visibility settings without overwriting stored draft content', () => {
  const content = JSON.parse(
    readFileSync('data/arpeeville/seed.json', 'utf8'),
  ) as Content;
  content.officials[0].bio =
    '<h2>Career</h2><img src="/portraits/arpeeville/liz.jpg">';
  content.officials[0].bioFormat = 'html';
  inArpeeville(() => {
    content.agency.showPhotos = false;
    assert.doesNotMatch(visibleContent(content).officials[0].bio, /<img/);
    assert.match(content.officials[0].bio, /<img/);
    content.agency.showBiographies = false;
    assert.equal(visibleContent(content).officials[0].bio, '');
    assert.match(content.officials[0].bio, /Career/);
  });
  assert.ok(
    officialSchema.safeParse({
      ...content.officials[0],
      bio: '<p>' + 'A'.repeat(12000) + '</p>',
    }).success,
  );
  assert.equal(
    officialSchema.safeParse({
      ...content.officials[0],
      bio: 'a'.repeat(50001),
    }).success,
    false,
  );
});
