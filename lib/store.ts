import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Content, Address } from './model';
let db: DatabaseSync | undefined;
export function dataDir() {
  return process.env.DATA_DIR || path.join(process.cwd(), '.data');
}
export function database() {
  if (db) return db;
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  const conn = new DatabaseSync(path.join(dir, 'district-lookup.sqlite'));
  conn.exec(
    'PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;',
  );
  conn.exec(
    `CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), draft TEXT NOT NULL, published TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, published_revision INTEGER NOT NULL DEFAULT 1, published_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password TEXT NOT NULL,totp_secret TEXT,totp_active INTEGER NOT NULL DEFAULT 0,last_totp INTEGER NOT NULL DEFAULT -1,created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,admin_id TEXT NOT NULL REFERENCES admins(id),stage TEXT NOT NULL,expires_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS sessions_admin ON sessions(admin_id); CREATE TABLE IF NOT EXISTS recovery_codes (hash TEXT PRIMARY KEY,admin_id TEXT NOT NULL REFERENCES admins(id)); CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY,mime TEXT NOT NULL,created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS addresses (id TEXT PRIMARY KEY,label TEXT NOT NULL,search TEXT NOT NULL,lon REAL NOT NULL,lat REAL NOT NULL); CREATE INDEX IF NOT EXISTS addresses_search ON addresses(search);`,
  );
  if (!conn.prepare('SELECT id FROM app_state WHERE id=1').get()) {
    const content = readFileSync(
      path.join(process.cwd(), 'data/seed.json'),
      'utf8',
    );
    conn
      .prepare(
        'INSERT INTO app_state (id,draft,published,published_at) VALUES (1,?,?,?)',
      )
      .run(content, content, new Date().toISOString());
  }
  if (
    !(
      conn.prepare('SELECT COUNT(*) AS n FROM addresses').get() as { n: number }
    ).n
  ) {
    const records = JSON.parse(
      readFileSync(path.join(process.cwd(), 'data/addresses.json'), 'utf8'),
    ) as Address[];
    const insert = conn.prepare(
      'INSERT INTO addresses (id,label,search,lon,lat) VALUES (?,?,?,?,?)',
    );
    conn.exec('BEGIN');
    try {
      for (const a of records)
        insert.run(a.id, a.label, normalizeSearch(a.label), a.lon, a.lat);
      conn.exec('COMMIT');
    } catch (e) {
      conn.exec('ROLLBACK');
      throw e;
    }
  }
  db = conn;
  return db;
}
export function normalizeSearch(value: string) {
  const synonyms: Record<string, string> = {
    street: 'st',
    avenue: 'ave',
    boulevard: 'blvd',
    drive: 'dr',
    road: 'rd',
    court: 'ct',
    lane: 'ln',
    place: 'pl',
    circle: 'cir',
    way: 'way',
    north: 'n',
    south: 's',
    east: 'e',
    west: 'w',
  };
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => synonyms[t] || t)
    .join(' ');
}
export function state() {
  const r = database().prepare('SELECT * FROM app_state WHERE id=1').get() as {
    draft: string;
    published: string;
    revision: number;
    published_revision: number;
    published_at: string;
  };
  return {
    draft: JSON.parse(r.draft) as Content,
    published: JSON.parse(r.published) as Content,
    revision: r.revision,
    publishedRevision: r.published_revision,
    publishedAt: r.published_at,
  };
}
export function publicContent() {
  return visibleContent(state().published);
}
// Display preferences also govern the payload sent to the public browser.
export function visibleContent(content: Content): Content {
  const a = content.agency;
  return {
    ...content,
    officials: content.officials
      .filter((o) => o.district !== null || a.showMayor)
      .map((o) => ({
        ...o,
        photo: a.showPhotos ? o.photo : '',
        email: a.showEmail ? o.email : '',
        phone: a.showPhone ? o.phone : '',
        phoneLabel: a.showPhone ? o.phoneLabel : '',
        website: a.showWebsite ? o.website : '',
        termEnd: a.showTerm ? o.termEnd : '',
        staffName: a.showStaff ? o.staffName : '',
        staffEmail: a.showStaff ? o.staffEmail : '',
        staffPhone: a.showStaff ? o.staffPhone : '',
      })),
  };
}
export function audit(actor: string, action: string, detail: string) {
  database()
    .prepare(
      'INSERT INTO audit(actor,action,detail,created_at) VALUES(?,?,?,?)',
    )
    .run(actor, action, detail, new Date().toISOString());
}
export function changeDraft(
  revision: number,
  content: Content,
  actor: string,
  detail: string,
) {
  const result = database()
    .prepare(
      'UPDATE app_state SET draft=?,revision=revision+1 WHERE id=1 AND revision=?',
    )
    .run(JSON.stringify(content), revision);
  if (Number(result.changes) !== 1)
    throw Error('Another edit was saved. Reload to avoid overwriting it.');
  audit(actor, 'Draft saved', detail);
  return state();
}
export function publish(revision: number, actor: string) {
  const result = database()
    .prepare(
      'UPDATE app_state SET published=draft,published_revision=revision,published_at=? WHERE id=1 AND revision=?',
    )
    .run(new Date().toISOString(), revision);
  if (Number(result.changes) !== 1)
    throw Error('The draft changed. Refresh and review before publishing.');
  audit(actor, 'Published', 'Council information and map published');
  return state();
}
export function addressById(id: string) {
  return database()
    .prepare('SELECT id,label,lon,lat FROM addresses WHERE id=?')
    .get(id) as Address | undefined;
}
export function addressSearch(query: string) {
  const q = normalizeSearch(query);
  if (q.length < 2) return [];
  const tokens = q.split(' ').slice(0, 8);
  const clauses = tokens.map(() => `(' '||search) LIKE ?`).join(' AND ');
  return database()
    .prepare(
      `SELECT id,label,lon,lat FROM addresses WHERE ${clauses} ORDER BY CASE WHEN search LIKE ? THEN 0 ELSE 1 END,label LIMIT 40`,
    )
    .all(...tokens.map((t) => '% ' + t + '%'), q + '%') as Address[];
}
