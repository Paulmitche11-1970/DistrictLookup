import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { backfillOfficialBiographies } from '../lib/biography-backfill';

const original = {
  agency: { name: 'Agency', showBiographies: true },
  officials: [
    {
      id: '3',
      district: '3',
      name: 'Tony Alexander',
      vacant: false,
      bio: '',
      photo: '/custom.webp',
    },
  ],
};
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE app_migrations (id TEXT PRIMARY KEY);
    CREATE TABLE app_state (id INTEGER PRIMARY KEY, draft TEXT, published TEXT, revision INTEGER, published_revision INTEGER, published_at TEXT);
    CREATE TABLE audit (actor TEXT, action TEXT, detail TEXT, created_at TEXT);
    CREATE TABLE client_preview_state (id INTEGER PRIMARY KEY, draft TEXT, published TEXT, baseline TEXT, revision INTEGER, published_revision INTEGER, published_at TEXT);
    CREATE TABLE client_preview_audit (actor TEXT, action TEXT, detail TEXT, created_at TEXT);`);
  const raw = JSON.stringify(original);
  db.prepare('INSERT INTO app_state VALUES(1,?,?,7,7,?)').run(
    raw,
    raw,
    'original-date',
  );
  db.prepare('INSERT INTO client_preview_state VALUES(1,?,?,?,11,11,?)').run(
    raw,
    raw,
    raw,
    'original-date',
  );
  return db;
}
function row(db: DatabaseSync, table = 'app_state') {
  return db.prepare(`SELECT * FROM ${table}`).get() as {
    draft: string;
    published: string;
    baseline: string;
    revision: number;
    published_revision: number;
    published_at: string;
  };
}
void test('Adds an official bio to live and existing preview defaults, preserving all other content and invalidating stale saves', () => {
  const db = fixture();
  try {
    for (const table of ['app_state', 'client_preview_state'] as const) {
      const before = row(db, table);
      backfillOfficialBiographies(db, 'san-jose-evergreen', table);
      const after = row(db, table);
      const content = JSON.parse(after.draft);
      assert.match(content.officials[0].bio, /JW Consulting Group/);
      assert.match(content.officials[0].bio, /https:\/\/sjeccd.edu\//);
      assert.equal(content.officials[0].bioFormat, 'html');
      const {
        bio: _bio,
        bioFormat: _bioFormat,
        ...person
      } = content.officials[0];
      const { bio: _oldBio, ...oldPerson } = original.officials[0];
      assert.deepEqual(person, oldPerson);
      assert.deepEqual(content.agency, original.agency);
      assert.equal(after.draft, after.published);
      if (table === 'client_preview_state')
        assert.equal(after.draft, after.baseline);
      assert.ok(after.revision > before.revision);
      assert.equal(after.revision, after.published_revision);
      assert.equal(
        db
          .prepare(`UPDATE ${table} SET draft=? WHERE revision=?`)
          .run('stale', before.revision).changes,
        0,
      );
    }
  } finally {
    db.close();
  }
});
void test('Preserves client biographies, photos and unpublished edits; updates the reset baseline independently', () => {
  const db = fixture();
  try {
    const custom = structuredClone(original);
    custom.officials[0].bio = 'Biography written by the client';
    custom.agency.name = 'Client draft name';
    const raw = JSON.stringify(custom);
    db.prepare('UPDATE app_state SET draft=?,revision=9').run(raw);
    db.prepare('UPDATE client_preview_state SET draft=?,published=?').run(
      raw,
      raw,
    );
    backfillOfficialBiographies(db, 'san-jose-evergreen');
    backfillOfficialBiographies(
      db,
      'san-jose-evergreen',
      'client_preview_state',
    );
    const live = row(db);
    assert.equal(live.draft, raw);
    assert.equal(JSON.parse(live.published).agency.name, 'Agency');
    assert.match(
      JSON.parse(live.published).officials[0].bio,
      /JW Consulting Group/,
    );
    assert.ok(live.revision > live.published_revision);
    const preview = row(db, 'client_preview_state');
    assert.equal(preview.draft, raw);
    assert.equal(preview.published, raw);
    assert.match(
      JSON.parse(preview.baseline).officials[0].bio,
      /JW Consulting Group/,
    );
    assert.equal(preview.published_at, 'original-date');
  } finally {
    db.close();
  }
});
void test('Does not change another agency, a new occupant, a different district, or a vacant seat', () => {
  const db = fixture();
  try {
    const untouched = row(db);
    backfillOfficialBiographies(db, 'martinez');
    assert.deepEqual(row(db), untouched);
    for (const change of [
      { name: 'New Trustee' },
      { district: '4' },
      { id: 'other' },
      { vacant: true },
    ]) {
      const content = structuredClone(original);
      Object.assign(content.officials[0], change);
      const raw = JSON.stringify(content);
      db.exec('DELETE FROM app_migrations');
      db.prepare('UPDATE app_state SET draft=?,published=?').run(raw, raw);
      backfillOfficialBiographies(db, 'san-jose-evergreen');
      assert.equal(row(db).draft, raw);
      assert.equal(row(db).published, raw);
      assert.equal(row(db).revision, untouched.revision);
    }
  } finally {
    db.close();
  }
});
void test('Runs once, so a subsequently cleared biography remains cleared', () => {
  const db = fixture();
  try {
    backfillOfficialBiographies(db, 'san-jose-evergreen');
    const raw = JSON.stringify(original);
    db.prepare('UPDATE app_state SET draft=?,published=?').run(raw, raw);
    const before = row(db);
    backfillOfficialBiographies(db, 'san-jose-evergreen');
    assert.deepEqual(row(db), before);
    assert.equal(
      (db.prepare('SELECT COUNT(*) AS n FROM audit').get() as { n: number }).n,
      1,
    );
  } finally {
    db.close();
  }
});
void test('Defers preview migration until a preview exists and rolls back on failure', () => {
  const db = fixture();
  try {
    db.exec('DELETE FROM client_preview_state');
    backfillOfficialBiographies(
      db,
      'san-jose-evergreen',
      'client_preview_state',
    );
    assert.equal(
      (
        db.prepare('SELECT COUNT(*) AS n FROM app_migrations').get() as {
          n: number;
        }
      ).n,
      0,
    );
    const raw = JSON.stringify(original);
    db.prepare('INSERT INTO client_preview_state VALUES(1,?,?,?,1,1,?)').run(
      raw,
      raw,
      raw,
      'date',
    );
    db.exec(
      "CREATE TRIGGER reject_audit BEFORE INSERT ON client_preview_audit BEGIN SELECT RAISE(ABORT, 'test rollback'); END;",
    );
    const before = row(db, 'client_preview_state');
    assert.throws(
      () =>
        backfillOfficialBiographies(
          db,
          'san-jose-evergreen',
          'client_preview_state',
        ),
      /test rollback/,
    );
    assert.deepEqual(row(db, 'client_preview_state'), before);
    assert.equal(
      (
        db.prepare('SELECT COUNT(*) AS n FROM app_migrations').get() as {
          n: number;
        }
      ).n,
      0,
    );
    db.exec('DROP TRIGGER reject_audit');
    backfillOfficialBiographies(
      db,
      'san-jose-evergreen',
      'client_preview_state',
    );
    assert.match(
      JSON.parse(row(db, 'client_preview_state').baseline).officials[0].bio,
      /JW Consulting Group/,
    );
  } finally {
    db.close();
  }
});
