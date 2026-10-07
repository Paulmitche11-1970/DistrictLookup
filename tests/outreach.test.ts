import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  activityDatabase,
  recordActivity,
  activityRows,
} from '../lib/activity-store';
import { outreachReport } from '../lib/outreach-report';
import { activityFilters } from '../lib/activity-model';
import { reviewDestination } from '../lib/review-destination';
void test('Outreach sign-in keeps its destination for RP staff only', () => {
  assert.equal(reviewDestination('rp', '/admin/outreach'), '/admin/outreach');
  assert.equal(reviewDestination('martinez', '/admin/outreach'), '/martinez');
  assert.equal(
    reviewDestination('rp', '/admin/outreach/' + 'x'.repeat(36)),
    '/',
  );
});
void test('Existing logs migrate without loss; outreach excludes public/staff, groups pages and sessions, and filters by agency', () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'rp-outreach-unit-'));
  const legacy = new DatabaseSync(
    path.join(process.env.DATA_DIR, 'activity.sqlite'),
  );
  legacy.exec(
    `CREATE TABLE events(id TEXT PRIMARY KEY,visitId TEXT,createdAt INTEGER,day TEXT,agency TEXT,layout TEXT,path TEXT,type TEXT,source TEXT,referrerHost TEXT,medium TEXT,campaign TEXT,target TEXT,address TEXT,district TEXT,device TEXT);`,
  );
  legacy.close();
  const db = activityDatabase();
  assert.ok(
    db
      .prepare('PRAGMA table_info(events)')
      .all()
      .some((c) => c.name === 'audience'),
  );
  const visitId = randomUUID();
  const base = {
    id: randomUUID(),
    visitId,
    agency: 'galt',
    layout: 'classic',
    path: '/galt/classic',
    type: 'page_view' as const,
    source: 'Campaign: rp_outreach',
    referrerHost: '',
    medium: 'email',
    campaign: 'galt',
    target: '',
    address: '',
    district: '',
    device: 'Desktop',
  };
  recordActivity({ ...base, audience: 'public' });
  recordActivity({ ...base, id: randomUUID(), audience: 'rp_staff' });
  recordActivity({ ...base, id: randomUUID(), audience: 'agency_preview' });
  recordActivity({
    ...base,
    id: randomUUID(),
    audience: 'agency_preview',
    type: 'preview_save',
    path: '/galt/administration',
    layout: '',
  });
  recordActivity({
    ...base,
    id: randomUUID(),
    visitId: randomUUID(),
    agency: 'martinez',
    path: '/preview/martinez',
    audience: 'preview_entry',
  });
  const filters = activityFilters({ agency: 'galt' });
  const report = outreachReport(filters);
  assert.equal(report.agencies.length, 1);
  assert.equal(report.agencies[0].views, 1);
  assert.equal(report.agencies[0].saves, 1);
  assert.equal(report.agencies[0].visits, 1);
  assert.equal(report.sessions.length, 1);
  assert.equal(report.pages[0].path, '/galt/classic');
  assert.equal(outreachReport(filters, true).agencies[0].views, 2);
  assert.equal(activityRows({ ...filters, audience: 'rp_staff' }).length, 1);
  assert.equal(activityRows({ ...filters, visit: randomUUID() }).length, 0);
});
