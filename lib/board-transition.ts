import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Content } from './model';
import { database, state, stateTable, audit, photoTable } from './store';
import { isClientPreview } from './client-preview-scope';
import { photoInScope, photoPrefix } from './agency-scope';
import {
  officialSchema,
  districtElectionSchema,
  photoAspectRatioSchema,
} from './validation';
import { sanitizeBiography, biographyImages } from './biography-html';
import { validateRepresentation } from './representation';

// A transition contains only board information. Maps, agency copy and display
// preferences always come from the current published site at preview/launch time.
export const boardSchema = z.object({
  officials: z.array(officialSchema).min(1).max(100),
  districtElections: z.record(
    z.string().min(1).max(20),
    districtElectionSchema,
  ),
  photoAspectRatio: photoAspectRatioSchema,
});
export type Board = z.infer<typeof boardSchema>;
export type BoardTransition = {
  id: string;
  revision: number;
  title: string;
  swearingIn: string;
  board: Board;
  shareKey: string;
  updatedAt: string;
};
export type BoardArchive = {
  id: string;
  title: string;
  createdAt: string;
  actor: string;
  memberCount: number;
};
export class TransitionError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const scope = () => (isClientPreview() ? 'preview' : 'live');
function db() {
  state(); // Initialize the correctly scoped state and audit tables first.
  const conn = database();
  conn.exec(`CREATE TABLE IF NOT EXISTS board_transition (
    scope TEXT PRIMARY KEY, id TEXT NOT NULL, revision INTEGER NOT NULL,
    title TEXT NOT NULL, swearing_in TEXT NOT NULL, board TEXT NOT NULL,
    share_key TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS board_archive (
    id TEXT PRIMARY KEY, scope TEXT NOT NULL, title TEXT NOT NULL,
    content TEXT NOT NULL, created_at TEXT NOT NULL, actor TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS board_archive_scope ON board_archive(scope,created_at);`);
  return conn;
}
export function boardFrom(content: Content): Board {
  return structuredClone({
    officials: content.officials,
    districtElections: content.districtElections || {},
    photoAspectRatio: content.agency.photoAspectRatio || 'auto',
  });
}
export function withBoard(content: Content, board: Board): Content {
  return {
    ...content,
    officials: board.officials,
    districtElections: board.districtElections,
    agency: { ...content.agency, photoAspectRatio: board.photoAspectRatio },
  };
}
export function transition(): BoardTransition | null {
  const row = db()
    .prepare('SELECT * FROM board_transition WHERE scope=?')
    .get(scope()) as
    | {
        id: string;
        revision: number;
        title: string;
        swearing_in: string;
        board: string;
        share_key: string;
        updated_at: string;
      }
    | undefined;
  return row
    ? {
        id: row.id,
        revision: row.revision,
        title: row.title,
        swearingIn: row.swearing_in,
        board: JSON.parse(row.board),
        shareKey: row.share_key,
        updatedAt: row.updated_at,
      }
    : null;
}
export function transitionContent() {
  const current = transition();
  if (!current)
    throw new TransitionError(
      404,
      'There is no incoming board preview. It may have been launched or removed.',
    );
  return withBoard(state().published, current.board);
}
export function transitionKeyValid(value: string | undefined) {
  if (!value || !/^[a-f0-9]{64}$/.test(value)) return false;
  const current = transition();
  return (
    !!current &&
    timingSafeEqual(Buffer.from(value), Buffer.from(current.shareKey))
  );
}
function checked(id: string, revision: number) {
  const current = transition();
  if (!current || current.id !== id || current.revision !== revision)
    throw new TransitionError(
      409,
      'The transition changed. Reload before continuing.',
    );
  return current;
}
export function transitionReadiness(content: Content): string | null {
  try {
    validateRepresentation(content);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
function validBoard(input: unknown, base: Content, complete = true) {
  const board = boardSchema.parse(input);
  if (
    board.officials.some((o) => !o.id) ||
    new Set(board.officials.map((o) => o.id)).size !== board.officials.length
  )
    throw new TransitionError(
      422,
      'Every official needs a unique profile identifier.',
    );
  const checkPhoto = (photo: string) => {
    if (!photoInScope(photo))
      throw new TransitionError(422, 'Use photos uploaded for this agency.');
    if (
      photo.startsWith(photoPrefix()) &&
      !database()
        .prepare(`SELECT id FROM ${photoTable()} WHERE id=?`)
        .get(photo.split('/').at(-1)!)
    )
      throw new TransitionError(
        422,
        'An uploaded photo is missing. Please upload it again.',
      );
  };
  for (const official of board.officials) {
    checkPhoto(official.photo);
    // Validate before sanitizing, so foreign-agency embedded images are rejected.
    biographyImages(official).forEach(checkPhoto);
    if (official.bioFormat === 'html')
      official.bio = sanitizeBiography(official.bio);
  }
  const issue = complete ? transitionReadiness(withBoard(base, board)) : null;
  if (issue) throw new TransitionError(422, issue);
  return board;
}
const titleSchema = z.string().trim().min(1).max(120);
const dateSchema = z.union([z.literal(''), z.iso.date()]);
export function createTransition(
  title: string,
  swearingIn: string,
  actor: string,
  archiveId?: string,
) {
  const conn = db();
  if (transition())
    throw new TransitionError(
      409,
      'An incoming board is already being prepared. Finish or discard it first.',
    );
  const board = boardFrom(
    archiveId ? archiveContent(archiveId) : state().published,
  );
  // Restored historical assignments can be reconciled with today's map in the
  // editor. Every save and launch is validated against that map.
  const result = conn
    .prepare(`INSERT OR IGNORE INTO board_transition
    (scope,id,revision,title,swearing_in,board,share_key,updated_at) VALUES(?,?,1,?,?,?,?,?)`)
    .run(
      scope(),
      randomUUID(),
      titleSchema.parse(title),
      dateSchema.parse(swearingIn),
      JSON.stringify(board),
      randomBytes(32).toString('hex'),
      new Date().toISOString(),
    );
  if (!result.changes)
    throw new TransitionError(
      409,
      'Another administrator created a transition. Reload to view it.',
    );
  audit(
    actor,
    archiveId
      ? 'Board archive restored to transition'
      : 'Board transition created',
    title,
  );
  return transition()!;
}
export function saveTransition(
  id: string,
  revision: number,
  input: unknown,
  title: string,
  swearingIn: string,
  actor: string,
) {
  checked(id, revision);
  // Staging may be incomplete while staff add seats or reconcile a historical
  // roster with a newer map. Launch always requires complete representation.
  const board = validBoard(input, state().published, false);
  const result = db()
    .prepare(`UPDATE board_transition SET board=?,title=?,swearing_in=?,revision=revision+1,updated_at=?
    WHERE scope=? AND id=? AND revision=?`)
    .run(
      JSON.stringify(board),
      titleSchema.parse(title),
      dateSchema.parse(swearingIn),
      new Date().toISOString(),
      scope(),
      id,
      revision,
    );
  if (!result.changes)
    throw new TransitionError(
      409,
      'The transition changed. Reload before saving.',
    );
  audit(actor, 'Board transition saved', title);
}
export function rotateTransitionKey(
  id: string,
  revision: number,
  actor: string,
) {
  checked(id, revision);
  const result = db()
    .prepare(
      `UPDATE board_transition SET share_key=?,revision=revision+1 WHERE scope=? AND id=? AND revision=?`,
    )
    .run(randomBytes(32).toString('hex'), scope(), id, revision);
  if (!result.changes)
    throw new TransitionError(409, 'The transition changed. Reload first.');
  audit(
    actor,
    'Transition sharing link replaced',
    'Previously shared links and preview sessions revoked.',
  );
}
export function discardTransition(id: string, revision: number, actor: string) {
  checked(id, revision);
  const result = db()
    .prepare(
      'DELETE FROM board_transition WHERE scope=? AND id=? AND revision=?',
    )
    .run(scope(), id, revision);
  if (!result.changes)
    throw new TransitionError(409, 'The transition changed. Reload first.');
  audit(
    actor,
    'Board transition discarded',
    'The current board was not changed.',
  );
}
export function boardArchives(): BoardArchive[] {
  return (
    db()
      .prepare(
        "SELECT id,title,created_at,actor,json_array_length(content,'$.officials') AS member_count FROM board_archive WHERE scope=? ORDER BY created_at DESC",
      )
      .all(scope()) as {
      id: string;
      title: string;
      created_at: string;
      actor: string;
      member_count: number;
    }[]
  ).map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.created_at,
    actor: r.actor,
    memberCount: r.member_count,
  }));
}
export function archiveContent(id: string): Content {
  const row = db()
    .prepare('SELECT content FROM board_archive WHERE scope=? AND id=?')
    .get(scope(), id) as { content: string } | undefined;
  if (!row) throw new TransitionError(404, 'That board archive was not found.');
  return JSON.parse(row.content);
}
export function launchTransition(
  id: string,
  revision: number,
  liveRevision: number,
  actor: string,
) {
  const conn = db();
  const table = stateTable();
  // Publication, historical snapshot, consumed preview and audit are one commit.
  conn.exec('BEGIN IMMEDIATE');
  try {
    const incoming = checked(id, revision);
    const live = state();
    if (live.revision !== liveRevision)
      throw new TransitionError(
        409,
        'The current site changed. Reload and review it before launching.',
      );
    if (JSON.stringify(live.draft) !== JSON.stringify(live.published))
      throw new TransitionError(
        409,
        'There are unpublished edits to the current site. Publish or discard those edits before launching the incoming board.',
      );
    const board = validBoard(incoming.board, live.published);
    const next = JSON.stringify(withBoard(live.published, board));
    const now = new Date().toISOString();
    conn
      .prepare(
        'INSERT INTO board_archive(id,scope,title,content,created_at,actor) VALUES(?,?,?,?,?,?)',
      )
      .run(
        randomUUID(),
        scope(),
        'Board before ' + incoming.title,
        JSON.stringify(live.published),
        now,
        actor,
      );
    const changed = conn
      .prepare(
        `UPDATE ${table} SET draft=?,published=?,revision=revision+1,published_revision=revision+1,published_at=? WHERE id=1 AND revision=?`,
      )
      .run(next, next, now, liveRevision);
    if (!changed.changes)
      throw new TransitionError(
        409,
        'The site changed. Reload before launching.',
      );
    conn
      .prepare(
        'DELETE FROM board_transition WHERE scope=? AND id=? AND revision=?',
      )
      .run(scope(), id, revision);
    audit(
      actor,
      isClientPreview()
        ? 'Preview board transition launched'
        : 'Board transition launched',
      incoming.title + '; outgoing board archived.',
    );
    conn.exec('COMMIT');
  } catch (error) {
    conn.exec('ROLLBACK');
    throw error;
  }
}
