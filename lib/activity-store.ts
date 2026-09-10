import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  pacificDay,
  shiftDay,
  RETENTION_DAYS,
  type ActivityFilters,
  type ActivityType,
} from './activity-model';

export type ActivityEvent = {
  id: string;
  visitId: string;
  agency: string;
  layout: string;
  path: string;
  type: ActivityType;
  source: string;
  referrerHost: string;
  medium: string;
  campaign: string;
  target: string;
  address: string;
  district: string;
  device: string;
};
export type ActivityRow = ActivityEvent & { createdAt: number; day: string };
let connection: DatabaseSync | undefined;
let lastPruned = '';
export function activityDatabase() {
  if (!connection) {
    const dir = process.env.DATA_DIR || path.join(process.cwd(), '.data');
    mkdirSync(dir, { recursive: true });
    connection = new DatabaseSync(path.join(dir, 'activity.sqlite'));
    connection.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY, visitId TEXT NOT NULL, createdAt INTEGER NOT NULL, day TEXT NOT NULL,
        agency TEXT NOT NULL, layout TEXT NOT NULL, path TEXT NOT NULL, type TEXT NOT NULL,
        source TEXT NOT NULL, referrerHost TEXT NOT NULL, medium TEXT NOT NULL, campaign TEXT NOT NULL,
        target TEXT NOT NULL, address TEXT NOT NULL, district TEXT NOT NULL, device TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_day ON events(day, createdAt);
      CREATE INDEX IF NOT EXISTS events_agency_day ON events(agency, day);
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    connection
      .prepare('INSERT OR IGNORE INTO metadata(key,value) VALUES(?,?)')
      .run('startedAt', new Date().toISOString());
  }
  const today = pacificDay();
  if (lastPruned !== today) {
    connection
      .prepare('DELETE FROM events WHERE day < ?')
      .run(shiftDay(today, -RETENTION_DAYS + 1));
    lastPruned = today;
  }
  return connection;
}
export function recordActivity(event: ActivityEvent, now = new Date()) {
  activityDatabase()
    .prepare(`INSERT OR IGNORE INTO events(id,visitId,createdAt,day,agency,layout,path,type,source,referrerHost,medium,campaign,target,address,district,device)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(
      event.id,
      event.visitId,
      now.getTime(),
      pacificDay(now),
      event.agency,
      event.layout,
      event.path,
      event.type,
      event.source,
      event.referrerHost,
      event.medium,
      event.campaign,
      event.target,
      event.address,
      event.district,
      event.device,
    );
}
function where(filters: ActivityFilters) {
  const clauses = ['day >= ?', 'day <= ?'];
  const values: SQLInputValue[] = [filters.from, filters.to];
  for (const [key, val] of [
    ['agency', filters.agency],
    ['type', filters.type],
    ['source', filters.source],
  ]) {
    if (val) {
      clauses.push(key + ' = ?');
      values.push(val === 'directory' && key === 'agency' ? '' : val);
    }
  }
  if (filters.query) {
    clauses.push("(address LIKE ? ESCAPE '\\' OR target LIKE ? ESCAPE '\\')");
    const query = '%' + filters.query.replace(/[\\%_]/g, '\\$&') + '%';
    values.push(query, query);
  }
  return { sql: 'WHERE ' + clauses.join(' AND '), values };
}
export function activityRows(
  filters: ActivityFilters,
  limit = 50,
  offset = (filters.page - 1) * 50,
) {
  const { sql, values } = where(filters);
  return activityDatabase()
    .prepare(
      `SELECT * FROM events ${sql} ORDER BY createdAt DESC, id DESC LIMIT ? OFFSET ?`,
    )
    .all(...values, limit, offset) as ActivityRow[];
}
export function activityReport(filters: ActivityFilters) {
  const db = activityDatabase();
  const { sql, values } = where(filters);
  const summary = db
    .prepare(`SELECT COUNT(*) events,
    COALESCE(SUM(type='page_view'),0) pageViews,
    COUNT(DISTINCT visitId) visits,
    COALESCE(SUM(type='address_lookup'),0) lookups,
    COALESCE(SUM(type IN ('search_no_match','lookup_error')),0) unsuccessful,
    COALESCE(SUM(type NOT IN ('page_view','address_lookup','search_no_match','lookup_error')),0) clicks
    FROM events ${sql}`)
    .get(...values) as {
    events: number;
    pageViews: number;
    visits: number;
    lookups: number;
    unsuccessful: number;
    clicks: number;
  };
  const daily = db
    .prepare(
      `SELECT day, SUM(type='page_view') views, SUM(type='address_lookup') lookups FROM events ${sql} GROUP BY day ORDER BY day`,
    )
    .all(...values) as { day: string; views: number; lookups: number }[];
  const agencies = db
    .prepare(
      `SELECT agency, SUM(type='page_view') views, SUM(type='address_lookup') lookups, COUNT(*) events FROM events ${sql} GROUP BY agency ORDER BY views DESC, events DESC`,
    )
    .all(...values) as {
    agency: string;
    views: number;
    lookups: number;
    events: number;
  }[];
  const sources = db
    .prepare(
      `SELECT source, COUNT(DISTINCT visitId) visits, SUM(type='page_view') views, SUM(type='address_lookup') lookups FROM events ${sql} GROUP BY source ORDER BY visits DESC LIMIT 12`,
    )
    .all(...values) as {
    source: string;
    visits: number;
    views: number;
    lookups: number;
  }[];
  const layouts = db
    .prepare(
      `SELECT layout, SUM(type='page_view') views, SUM(type='address_lookup') lookups FROM events ${sql} GROUP BY layout HAVING layout != '' ORDER BY views DESC`,
    )
    .all(...values) as { layout: string; views: number; lookups: number }[];
  const actions = db
    .prepare(
      `SELECT type, COUNT(*) count FROM events ${sql} GROUP BY type ORDER BY count DESC`,
    )
    .all(...values) as { type: ActivityType; count: number }[];
  const sourceOptions = db
    .prepare('SELECT DISTINCT source FROM events ORDER BY source LIMIT 200')
    .all() as { source: string }[];
  const startedAt = (
    db.prepare("SELECT value FROM metadata WHERE key='startedAt'").get() as {
      value: string;
    }
  ).value;
  const rows = activityRows(filters);
  return {
    summary,
    daily,
    agencies,
    sources,
    layouts,
    actions,
    sourceOptions,
    startedAt,
    rows,
  };
}
