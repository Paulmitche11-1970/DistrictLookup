import type { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Content } from './model';

export const portraitBackfillId = 'official-portraits-20260911-v1';
type Portrait = { id: string; district: string; name: string; photo: string };
type Manifest = Record<string, Portrait[]>;
let manifest: Manifest | undefined;

function normalizedName(value: string) {
  // Preserve punctuation and accents: only case and whitespace may differ.
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function fillEmptyPortraits(raw: string, portraits: Portrait[]) {
  const content = JSON.parse(raw) as Content;
  let added = 0;
  for (const official of content.officials) {
    if (
      official.vacant !== false ||
      official.photo !== '' ||
      typeof official.name !== 'string'
    )
      continue;
    const match = portraits.find(
      (portrait) =>
        official.id === portrait.id &&
        official.district === portrait.district &&
        normalizedName(official.name) === normalizedName(portrait.name),
    );
    if (match) {
      official.photo = match.photo;
      added++;
    }
  }
  // Keep the original serialized value untouched when nothing matches.
  return { raw: added ? JSON.stringify(content) : raw, added };
}

export function backfillOfficialPortraits(
  conn: DatabaseSync,
  agencyId: string,
) {
  if (!['san-mateo', 'burlingame', 'millbrae'].includes(agencyId)) return;
  manifest ||= JSON.parse(
    readFileSync(
      path.join(process.cwd(), 'data/portrait-backfill-20260911.json'),
      'utf8',
    ),
  ) as Manifest;
  const portraits = manifest[agencyId];
  if (!portraits?.length)
    throw Error('Missing frozen portrait migration data.');

  // Acquire the write lock before reading the marker or either content version.
  // This also keeps another process from running the same migration concurrently.
  conn.exec('BEGIN IMMEDIATE');
  try {
    if (
      conn
        .prepare('SELECT id FROM app_migrations WHERE id=?')
        .get(portraitBackfillId)
    ) {
      conn.exec('COMMIT');
      return;
    }
    const row = conn
      .prepare('SELECT draft,published FROM app_state WHERE id=1')
      .get() as { draft: string; published: string } | undefined;
    if (!row) throw Error('Missing content for portrait migration.');

    // Never publish a draft, restore an earlier occupant, or overwrite an upload.
    const draft = fillEmptyPortraits(row.draft, portraits);
    const published = fillEmptyPortraits(row.published, portraits);
    if (draft.added || published.added)
      conn
        .prepare('UPDATE app_state SET draft=?,published=? WHERE id=1')
        .run(draft.raw, published.raw);
    conn
      .prepare(
        'INSERT INTO audit(actor,action,detail,created_at) VALUES(?,?,?,?)',
      )
      .run(
        'system',
        'Official portraits added',
        JSON.stringify({
          migration: portraitBackfillId,
          draftPhotosAdded: draft.added,
          publishedPhotosAdded: published.added,
        }),
        new Date().toISOString(),
      );
    conn
      .prepare('INSERT INTO app_migrations(id) VALUES(?)')
      .run(portraitBackfillId);
    conn.exec('COMMIT');
  } catch (error) {
    conn.exec('ROLLBACK');
    throw error;
  }
}
