import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { cleanWebsiteDocument } from './website-html';
import type {
  WebsiteDocument,
  WebsiteMedia,
  WebsiteRecord,
  WebsiteSettings,
} from './website-model';

export class WebsiteError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function websiteDataDir() {
  return path.join(
    process.env.DATA_DIR || path.join(process.cwd(), '.data'),
    'rpdata-website',
  );
}
const databases = new Map<string, DatabaseSync>();
function db() {
  const dir = websiteDataDir();
  let database = databases.get(dir);
  if (database) return database;
  mkdirSync(dir, { recursive: true });
  database = new DatabaseSync(path.join(dir, 'website.sqlite'));
  database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, draft TEXT NOT NULL, published TEXT, revision INTEGER NOT NULL, published_revision INTEGER, updated_at TEXT NOT NULL, published_at TEXT);
    CREATE TABLE IF NOT EXISTS revisions (id INTEGER PRIMARY KEY AUTOINCREMENT, document_id TEXT NOT NULL, revision INTEGER NOT NULL, content TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, name TEXT NOT NULL, alt TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, created_at TEXT NOT NULL);`);
  // Seed only an empty website. Agency data and later editorial changes are never overwritten.
  database.exec('BEGIN IMMEDIATE');
  try {
    if (!database.prepare('SELECT id FROM documents LIMIT 1').get()) {
      const seed = JSON.parse(
        readFileSync(
          path.join(process.cwd(), 'data/website/seed.json'),
          'utf8',
        ),
      ) as Record<string, unknown>;
      const now = new Date().toISOString();
      for (const [id, value] of Object.entries(seed)) {
        const content = JSON.stringify(cleanWebsiteDocument(value));
        database
          .prepare('INSERT INTO documents VALUES (?, ?, ?, 1, 1, ?, ?)')
          .run(id, content, content, now, now);
        database
          .prepare(
            'INSERT INTO revisions(document_id,revision,content,action,created_at) VALUES (?,1,?,?,?)',
          )
          .run(id, content, 'Initial website', now);
      }
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    database.close();
    throw error;
  }
  databases.set(dir, database);
  return database;
}
type Row = {
  id: string;
  draft: string;
  published: string | null;
  revision: number;
  published_revision: number | null;
  updated_at: string;
  published_at: string | null;
};
function record(row: Row): WebsiteRecord {
  return {
    id: row.id,
    draft: cleanWebsiteDocument(JSON.parse(row.draft)),
    published: row.published
      ? cleanWebsiteDocument(JSON.parse(row.published))
      : null,
    revision: row.revision,
    publishedRevision: row.published_revision,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}
export function websiteRecords() {
  return (
    db()
      .prepare('SELECT * FROM documents ORDER BY updated_at DESC')
      .all() as Row[]
  ).map(record);
}
export function websiteRecord(id: string) {
  const row = db().prepare('SELECT * FROM documents WHERE id=?').get(id) as
    | Row
    | undefined;
  if (!row) throw new WebsiteError(404, 'Page not found.');
  return record(row);
}
export function publicWebsite() {
  const records = websiteRecords();
  return {
    settings: records.find((r) => r.id === 'settings')!
      .published as WebsiteSettings,
    pages: records
      .flatMap((r) => (r.published?.kind === 'page' ? [r.published] : []))
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
  };
}
export function publicWebsitePage(slug: string) {
  return publicWebsite().pages.find((p) => p.slug === slug);
}
function transaction<T>(fn: () => T) {
  const d = db();
  d.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    d.exec('COMMIT');
    return result;
  } catch (error) {
    d.exec('ROLLBACK');
    throw error;
  }
}
function validateDocument(id: string, doc: WebsiteDocument) {
  if ((id === 'settings') !== (doc.kind === 'settings'))
    throw new WebsiteError(400, 'Invalid document type.');
  if (doc.kind !== 'page') return;
  const builtins: Record<string, string> = {
    home: '',
    about: 'about',
    'what-we-do': 'what-we-do',
    'my-district': 'my-district',
  };
  if (id in builtins && doc.slug !== builtins[id])
    throw new WebsiteError(400, 'The address of this original page is fixed.');
  if (!doc.slug && id !== 'home')
    throw new WebsiteError(400, 'Enter an address for this page.');
  for (const other of websiteRecords()) {
    if (other.id === id) continue;
    if (
      [other.draft, other.published].some(
        (x) => x?.kind === 'page' && x.slug === doc.slug,
      )
    )
      throw new WebsiteError(
        409,
        'That address belongs to another page. Choose a different address.',
      );
  }
  if (new Set(doc.sections.map((s) => s.id)).size !== doc.sections.length)
    throw new WebsiteError(400, 'Section identifiers must be unique.');
}
function history(
  id: string,
  revision: number,
  document: WebsiteDocument,
  action: string,
) {
  db()
    .prepare(
      'INSERT INTO revisions(document_id,revision,content,action,created_at) VALUES(?,?,?,?,?)',
    )
    .run(
      id,
      revision,
      JSON.stringify(document),
      action,
      new Date().toISOString(),
    );
  db()
    .prepare(
      'DELETE FROM revisions WHERE document_id=? AND id NOT IN (SELECT id FROM revisions WHERE document_id=? ORDER BY id DESC LIMIT 100)',
    )
    .run(id, id);
}
export function createWebsitePage(value: unknown) {
  const doc = cleanWebsiteDocument(value);
  if (doc.kind !== 'page') throw new WebsiteError(400, 'Create a page.');
  return transaction(() => {
    if (websiteRecords().length >= 101)
      throw new WebsiteError(400, 'The website supports up to 100 pages.');
    const id = 'page-' + randomBytes(8).toString('hex');
    validateDocument(id, doc);
    db()
      .prepare('INSERT INTO documents VALUES (?,?,NULL,1,NULL,?,NULL)')
      .run(id, JSON.stringify(doc), new Date().toISOString());
    history(id, 1, doc, 'Created draft');
    return websiteRecord(id);
  });
}
export function saveWebsiteDocument(
  id: string,
  value: unknown,
  expectedRevision: number,
  publish: boolean,
) {
  const doc = cleanWebsiteDocument(value);
  return transaction(() => {
    const current = websiteRecord(id);
    if (current.revision !== expectedRevision)
      throw new WebsiteError(
        409,
        'This page changed in another window. Reload it before saving; your changes have not overwritten anyone else’s work.',
      );
    validateDocument(id, doc);
    const revision = current.revision + 1,
      now = new Date().toISOString(),
      content = JSON.stringify(doc);
    db()
      .prepare(
        'UPDATE documents SET draft=?,revision=?,updated_at=?,published=?,published_revision=?,published_at=? WHERE id=?',
      )
      .run(
        content,
        revision,
        now,
        publish
          ? content
          : current.published
            ? JSON.stringify(current.published)
            : null,
        publish ? revision : current.publishedRevision,
        publish ? now : current.publishedAt,
        id,
      );
    history(id, revision, doc, publish ? 'Published' : 'Saved draft');
    return websiteRecord(id);
  });
}
export function unpublishWebsitePage(id: string, expectedRevision: number) {
  return transaction(() => {
    const current = websiteRecord(id);
    if (['home', 'settings'].includes(id))
      throw new WebsiteError(
        400,
        'The homepage and shared website settings must stay published.',
      );
    if (current.revision !== expectedRevision)
      throw new WebsiteError(
        409,
        'This page changed in another window. Reload before unpublishing.',
      );
    db()
      .prepare(
        'UPDATE documents SET published=NULL,published_revision=NULL,published_at=NULL,revision=revision+1,updated_at=? WHERE id=?',
      )
      .run(new Date().toISOString(), id);
    history(id, current.revision + 1, current.draft, 'Unpublished');
    return websiteRecord(id);
  });
}
export function websiteHistory(id: string) {
  websiteRecord(id);
  return db()
    .prepare(
      'SELECT id,revision,action,created_at AS createdAt FROM revisions WHERE document_id=? ORDER BY id DESC LIMIT 50',
    )
    .all(id);
}
export function restoreWebsiteRevision(
  id: string,
  historyId: number,
  expectedRevision: number,
) {
  const old = db()
    .prepare('SELECT content FROM revisions WHERE id=? AND document_id=?')
    .get(historyId, id) as { content: string } | undefined;
  if (!old) throw new WebsiteError(404, 'Revision not found.');
  // Restoring is a draft operation; publication always requires an explicit Publish.
  return saveWebsiteDocument(
    id,
    JSON.parse(old.content),
    expectedRevision,
    false,
  );
}
export function addWebsiteMedia(media: Omit<WebsiteMedia, 'url'>) {
  db()
    .prepare('INSERT INTO media VALUES (?,?,?,?,?,?)')
    .run(
      media.id,
      media.name,
      media.alt,
      media.width,
      media.height,
      new Date().toISOString(),
    );
  return { ...media, url: '/api/website/media/' + media.id };
}
export function websiteMedia(): WebsiteMedia[] {
  const uploaded = (
    db()
      .prepare(
        'SELECT id,name,alt,width,height FROM media ORDER BY created_at DESC',
      )
      .all() as Omit<WebsiteMedia, 'url'>[]
  ).map((m) => ({ ...m, url: '/api/website/media/' + m.id }));
  const seed = JSON.parse(
    readFileSync(path.join(process.cwd(), 'data/website/seed.json'), 'utf8'),
  ) as Record<string, WebsiteDocument>;
  const assets = new Map<string, WebsiteMedia>();
  for (const doc of Object.values(seed))
    if (doc.kind === 'page')
      for (const s of doc.sections)
        for (const x of [s, ...s.items])
          if (x.image)
            assets.set(x.image, {
              id: x.image,
              url: x.image,
              name: x.alt || x.title,
              alt: x.alt,
              width: 0,
              height: 0,
            });
  return [...uploaded, ...assets.values()];
}
export function isWebsiteMediaPublished(id: string) {
  const url = '/api/website/media/' + id;
  return websiteRecords().some(
    (r) => r.published && JSON.stringify(r.published).includes(url),
  );
}
