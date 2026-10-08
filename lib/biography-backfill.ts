import type { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Content } from './model';
import { hasBiography } from './biography';

const migrationId = 'official-biographies-20261007-v1';
type Biography = { id: string; district: string; name: string; bio: string };
type Manifest = Record<string, Biography[]>;
let manifest: Manifest | undefined;
const normalizedName = (name: string) =>
  name.trim().replace(/\s+/g, ' ').toLowerCase();

function fillEmptyBiographies(raw: string, biographies: Biography[]) {
  const content = JSON.parse(raw) as Content;
  let added = 0;
  for (const official of content.officials) {
    if (official.vacant !== false || hasBiography(official)) continue;
    const match = biographies.find(
      (bio) =>
        official.id === bio.id &&
        official.district === bio.district &&
        normalizedName(official.name) === normalizedName(bio.name),
    );
    if (match) {
      official.bio = match.bio;
      official.bioFormat = 'html';
      added++;
    }
  }
  return { raw: added ? JSON.stringify(content) : raw, added };
}

// Frozen, identity-matched additions only. Never publish a draft or replace a
// client's biography. Each version, including the reset baseline, stays separate.
export function backfillOfficialBiographies(
  db: DatabaseSync,
  agencyId: string,
  table: 'app_state' | 'client_preview_state' = 'app_state',
) {
  if (agencyId !== 'san-jose-evergreen') return;
  const marker = `${migrationId}:${table}`;
  if (db.prepare('SELECT id FROM app_migrations WHERE id=?').get(marker))
    return;
  if (
    !db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(table)
  )
    return;
  manifest ||= JSON.parse(
    readFileSync(
      path.join(process.cwd(), 'data/biography-backfill-20261007.json'),
      'utf8',
    ),
  ) as Manifest;
  const biographies = manifest[agencyId];
  if (!biographies?.length)
    throw Error('Missing frozen biography migration data.');
  db.exec('BEGIN IMMEDIATE');
  try {
    if (db.prepare('SELECT id FROM app_migrations WHERE id=?').get(marker)) {
      db.exec('COMMIT');
      return;
    }
    const row = db.prepare(`SELECT * FROM ${table} WHERE id=1`).get() as
      | {
          draft: string;
          published: string;
          baseline?: string;
          revision: number;
          published_revision: number;
          published_at: string;
        }
      | undefined;
    if (!row) {
      db.exec('COMMIT');
      return;
    }
    const draft = fillEmptyBiographies(row.draft, biographies);
    const published = fillEmptyBiographies(row.published, biographies);
    const baseline =
      row.baseline === undefined
        ? undefined
        : fillEmptyBiographies(row.baseline, biographies);
    if (draft.added || published.added || baseline?.added) {
      // Advance the editor's CAS revision so an already-open editor cannot
      // silently overwrite the addition. Distinct drafts remain unpublished.
      const publishedRevision = published.added
        ? Math.max(row.revision, row.published_revision) + 1
        : row.published_revision;
      const revision =
        draft.raw === published.raw
          ? Math.max(row.revision + 1, publishedRevision)
          : Math.max(row.revision, publishedRevision) + 1;
      const values = [
        draft.raw,
        published.raw,
        revision,
        publishedRevision,
        published.added ? new Date().toISOString() : row.published_at,
      ];
      if (baseline) values.push(baseline.raw);
      db.prepare(
        `UPDATE ${table} SET draft=?,published=?,revision=?,published_revision=?,published_at=?${baseline ? ',baseline=?' : ''} WHERE id=1`,
      ).run(...values);
      db.prepare(
        `INSERT INTO ${table === 'app_state' ? 'audit' : 'client_preview_audit'}(actor,action,detail,created_at) VALUES(?,?,?,?)`,
      ).run(
        'system',
        'Official biography added',
        JSON.stringify({
          migration: marker,
          draftBiosAdded: draft.added,
          publishedBiosAdded: published.added,
          baselineBiosAdded: baseline?.added || 0,
        }),
        new Date().toISOString(),
      );
    }
    db.prepare('INSERT INTO app_migrations(id) VALUES(?)').run(marker);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
