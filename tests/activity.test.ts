import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  activityContext,
  referralSource,
  activityFilters,
  pacificDay,
  shiftDay,
  csvCell,
  cleanActivityText,
} from '../lib/activity-model';
import {
  activityDatabase,
  activityReport,
  activityRows,
  recordActivity,
  type ActivityEvent,
} from '../lib/activity-store';

void test('Activity only accepts known public agency pages, including four layouts and embeds', () => {
  assert.equal(activityContext('/arpeeville/council')?.layout, 'directory');
  assert.equal(
    activityContext('/carpinteria/lookup', 'concierge')?.layout,
    'concierge',
  );
  assert.equal(activityContext('/embed', 'explorer')?.agency, 'martinez');
  assert.equal(activityContext('/arpeeville/officials/liz')?.page, 'Biography');
  for (const p of [
    '/logs',
    '/logs/export',
    '/admin',
    '/arpeeville/administration',
    '/arpeeville/preview',
    '/martinez/admin',
    '/api/admin',
    '/unknown/classic',
    '/martinez/classic/extra',
  ])
    assert.equal(activityContext(p), null, p);
});
void test('Attribution keeps the referral host, discards query/path information and labels uncertainty', () => {
  assert.deepEqual(
    referralSource(
      'https://www.google.com/search?q=private',
      'wheresmydistrict.com',
    ),
    { source: 'Google', referrerHost: 'google.com' },
  );
  assert.equal(
    referralSource(
      'https://www.cityofmartinez.org/council?token=private',
      'wheresmydistrict.com',
    ).source,
    'Website: cityofmartinez.org',
  );
  assert.equal(
    referralSource(
      'https://wheresmydistrict.com/arpeeville',
      'wheresmydistrict.com',
    ).source,
    'Direct / unknown',
  );
  assert.equal(
    referralSource('https://google.com.evil.example/', 'wheresmydistrict.com')
      .source,
    'Website: google.com.evil.example',
  );
  assert.equal(
    referralSource('not a URL', 'wheresmydistrict.com').source,
    'Direct / unknown',
  );
  assert.equal(
    referralSource(
      'https://bing.com',
      'wheresmydistrict.com',
      'agency newsletter',
    ).source,
    'Campaign: agency newsletter',
  );
});
void test('Date filters use Pacific days and bound invalid or oversized ranges and query inputs', () => {
  assert.equal(pacificDay(new Date('2026-09-10T06:30:00Z')), '2026-09-09');
  assert.equal(pacificDay(new Date('2026-01-10T07:30:00Z')), '2026-01-09');
  const f = activityFilters(
    {
      from: '2020-01-01',
      to: '2099-01-01',
      agency: 'unknown',
      type: '__proto__',
      page: '-3',
    },
    '2026-09-10',
  );
  assert.equal(f.from, '2026-06-13');
  assert.equal(f.to, '2026-09-10');
  assert.equal(f.page, 1);
  assert.equal(f.agency, '');
  assert.equal(f.type, '');
  assert.equal(
    activityFilters({ from: '2026-02-31' }, '2026-09-10').from,
    '2026-08-12',
  );
  assert.equal(shiftDay('2026-03-08', 1), '2026-03-09');
  assert.equal(cleanActivityText('hello\nworld\0'), 'helloworld');
});
void test('CSV exports neutralize spreadsheet formulas and preserve quotes and line breaks', () => {
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.equal(csvCell('99 Bottles of Beer'), '"99 Bottles of Beer"');
  assert.equal(csvCell('line 1\nline 2'), '"line 1\nline 2"');
});
void test('Activity counts deduplicate retries, separate visits, filter literal searches, paginate, and prune retained data', () => {
  process.env.DATA_DIR = mkdtempSync(
    path.join(tmpdir(), 'lookup-activity-unit-'),
  );
  const now = new Date();
  const today = pacificDay(now);
  const make = (overrides: Partial<ActivityEvent> = {}): ActivityEvent => ({
    id: randomUUID(),
    visitId: 'one-visit',
    agency: 'arpeeville',
    layout: 'classic',
    path: '/arpeeville/classic',
    type: 'page_view',
    source: 'Google',
    referrerHost: 'google.com',
    medium: '',
    campaign: '',
    target: '',
    address: '',
    district: '',
    device: 'Desktop / other',
    ...overrides,
  });
  const first = make();
  recordActivity(first, now);
  recordActivity(first, now);
  recordActivity(
    make({
      type: 'address_lookup',
      address: '100 Democracy Way',
      district: '1',
    }),
    now,
  );
  recordActivity(
    make({ type: 'search_no_match', address: '100% Main_Street' }),
    now,
  );
  recordActivity(
    make({ type: 'biography_click', target: 'Biography of Gabriella' }),
    now,
  );
  recordActivity(
    make({
      agency: 'martinez',
      visitId: 'another-visit',
      source: 'Direct / unknown',
    }),
    now,
  );
  const filters = activityFilters({ from: today, to: today });
  const report = activityReport(filters);
  assert.deepEqual(
    { ...report.summary },
    {
      events: 5,
      pageViews: 2,
      visits: 2,
      lookups: 1,
      unsuccessful: 1,
      clicks: 1,
    },
  );
  assert.equal(
    activityReport({ ...filters, agency: 'arpeeville' }).summary.events,
    4,
  );
  assert.equal(
    activityReport({ ...filters, source: 'Google', type: 'address_lookup' })
      .summary.lookups,
    1,
  );
  assert.equal(activityRows({ ...filters, query: '100% Main_' }).length, 1);
  assert.equal(activityRows({ ...filters, query: "' OR 1=1 --" }).length, 0);
  assert.equal(activityRows(filters, 2, 2).length, 2);
  assert.equal(report.daily[0].day, today);
  assert.equal(report.agencies.length, 2);
  // Old rows are excluded by bounded date filters; the next daily prune removes them.
  const old = make();
  recordActivity(old, new Date(shiftDay(today, -95) + 'T12:00:00Z'));
  assert.equal(activityReport(filters).summary.events, 5);
  assert.ok(
    activityDatabase()
      .prepare('SELECT value FROM metadata WHERE key=?')
      .get('startedAt'),
  );
});
