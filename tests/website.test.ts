import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cleanWebsiteDocument, sanitizeWebsiteHtml } from '../lib/website-html';
import {
  pageSchema,
  emptySection,
  safeWebsiteLink,
} from '../lib/website-model';
import {
  websiteRecord,
  publicWebsite,
  createWebsitePage,
  saveWebsiteDocument,
  unpublishWebsitePage,
  websiteHistory,
  restoreWebsiteRevision,
  isWebsiteMediaPublished,
  WebsiteError,
} from '../lib/website-store';
import { reviewDestination } from '../lib/review-destination';

void test('website drafts, publication, restoration, conflicts, and navigation stay separate', () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'rpdata-unit-'));
  assert.equal(publicWebsite().pages.length, 4);
  const home = websiteRecord('home');
  assert.equal(home.draft.kind, 'page');
  if (home.draft.kind !== 'page') throw Error('page');
  const original = publicWebsite().pages.find((p) => !p.slug)!.title;
  const draft = saveWebsiteDocument(
    'home',
    { ...home.draft, title: 'Private title' },
    home.revision,
    false,
  );
  assert.equal(publicWebsite().pages.find((p) => !p.slug)!.title, original);
  assert.throws(
    () => saveWebsiteDocument('home', home.draft, home.revision, true),
    (e: unknown) => e instanceof WebsiteError && e.status === 409,
  );
  const published = saveWebsiteDocument(
    'home',
    draft.draft,
    draft.revision,
    true,
  );
  assert.equal(
    publicWebsite().pages.find((p) => !p.slug)!.title,
    'Private title',
  );
  const earliest = websiteHistory('home').at(-1)!;
  const restored = restoreWebsiteRevision(
    'home',
    Number(earliest.id),
    published.revision,
  );
  assert.equal(
    restored.draft.kind === 'page' && restored.draft.title,
    original,
  );
  assert.equal(
    publicWebsite().pages.find((p) => !p.slug)!.title,
    'Private title',
  );
  assert.throws(() => unpublishWebsitePage('home', restored.revision));
  const section = {
    ...emptySection('text'),
    body: '<p>Private news</p><img src="/api/website/media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" alt="Test">',
  };
  const page = createWebsitePage({
    kind: 'page',
    slug: 'news',
    title: 'News',
    description: '',
    showInNav: true,
    navLabel: 'News',
    order: 50,
    sections: [section],
  });
  assert.equal(
    publicWebsite().pages.some((p) => p.slug === 'news'),
    false,
  );
  assert.equal(isWebsiteMediaPublished('a'.repeat(32)), false);
  assert.throws(() => createWebsitePage(page.draft), /belongs to another/);
  const live = saveWebsiteDocument(page.id, page.draft, page.revision, true);
  assert.equal(
    publicWebsite().pages.some((p) => p.slug === 'news' && p.showInNav),
    true,
  );
  assert.equal(isWebsiteMediaPublished('a'.repeat(32)), true);
  unpublishWebsitePage(page.id, live.revision);
  assert.equal(
    publicWebsite().pages.some((p) => p.slug === 'news'),
    false,
  );
  assert.equal(isWebsiteMediaPublished('a'.repeat(32)), false);
  assert.equal(websiteRecord(page.id).draft.kind, 'page');
  assert.throws(
    () =>
      saveWebsiteDocument(
        'home',
        { ...home.draft, slug: 'moved' },
        restored.revision,
        true,
      ),
    /fixed/,
  );
  assert.throws(
    () =>
      saveWebsiteDocument(
        'home',
        { ...home.draft, sections: [section, section] },
        restored.revision,
        true,
      ),
    /unique/,
  );
});
void test('website HTML preserves useful formatting while rejecting executable content and remote tracking images', () => {
  const result = sanitizeWebsiteHtml(
    '<script>alert(1)</script><p style="text-align:center;background:url(javascript:alert(1))" onclick="bad()">Hello <strong>world</strong></p><iframe src="https://bad.test"></iframe><a href="javascript:alert(1)">Bad</a><img src="https://tracker.test/pixel"><img src="/api/website/media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" alt="Fine"><a href="/about">About</a>',
  );
  assert.ok(result.includes('<strong>world</strong>'));
  assert.ok(result.includes('text-align:center'));
  assert.ok(result.includes('/api/website/media/'));
  assert.ok(result.includes('href="/about"'));
  assert.equal(
    /script|onclick|iframe|javascript|tracker\.test|background/.test(result),
    false,
  );
  assert.equal(safeWebsiteLink('https://user:pass@example.com'), false);
  assert.equal(safeWebsiteLink('//evil.test'), false);
  assert.equal(safeWebsiteLink('https://example.com/about'), true);
  const seed = {
    kind: 'page',
    slug: 'admin',
    title: 'Admin',
    description: '',
    showInNav: false,
    navLabel: 'Admin',
    order: 1,
    sections: [emptySection()],
  };
  assert.equal(pageSchema.safeParse(seed).success, false);
  assert.throws(() =>
    cleanWebsiteDocument({
      ...seed,
      slug: 'news',
      sections: [{ ...emptySection(), image: 'data:image/svg+xml,bad' }],
    }),
  );
});
void test('website login destinations are limited to RP staff and internal routes', () => {
  assert.equal(reviewDestination('rp', '/admin/website'), '/admin/website');
  assert.equal(
    reviewDestination('rp', '/admin/website/preview/home'),
    '/admin/website/preview/home',
  );
  assert.notEqual(
    reviewDestination('martinez', '/admin/website'),
    '/admin/website',
  );
  assert.notEqual(
    reviewDestination('rp', '//evil.test/admin/website'),
    '//evil.test/admin/website',
  );
});
