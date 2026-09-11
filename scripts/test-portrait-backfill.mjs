import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Transpile only the migration; use in-memory databases, never the app's data dir.
mkdirSync('.test-build/portrait-backfill', { recursive: true });
const compiled = '.test-build/portrait-backfill/migration.cjs';
writeFileSync(
  compiled,
  ts.transpileModule(readFileSync('lib/portrait-backfill.ts', 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText,
);
const require = createRequire(import.meta.url);
const { backfillOfficialPortraits, portraitBackfillId } = require(
  '../' + compiled,
);
const manifest = JSON.parse(
  readFileSync('data/portrait-backfill-20260911.json'),
);
let checks = 0;
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks++;
};
const source = (agency) => ({
  agency: { name: 'Client settings', showPhotos: false, showBiographies: true },
  officials: manifest[agency].map((p) => ({
    id: p.id,
    district: p.district,
    name: p.name,
    photo: '',
    vacant: false,
    bio: '<p>Private unfinished draft detail</p>',
    bioFormat: 'html',
    email: 'unpublished@example.test',
    termEnd: '2030-12',
    title: 'Client-selected title',
    additionalTitles: ['Secretary'],
  })),
  map: { type: 'FeatureCollection', features: [] },
  management: [
    { name: 'Unpublished staff', visible: false, photo: '/custom.webp' },
  ],
  districtElections: { 1: { status: 'transition', firstElection: '2028-11' } },
  dataReviewedAt: '2020-01-01',
  unknownFutureField: { keep: [1, 2, 3] },
});
const db = (draft, published) => {
  const conn = new DatabaseSync(':memory:');
  conn.exec(`CREATE TABLE app_state (
    id INTEGER PRIMARY KEY,draft TEXT NOT NULL,published TEXT NOT NULL,
    revision INTEGER,published_revision INTEGER,published_at TEXT);
    CREATE TABLE app_migrations(id TEXT PRIMARY KEY);
    CREATE TABLE audit(id INTEGER PRIMARY KEY,actor TEXT,action TEXT,detail TEXT,created_at TEXT);`);
  conn
    .prepare('INSERT INTO app_state VALUES(1,?,?,17,9,?)')
    .run(
      JSON.stringify(draft, null, 2),
      JSON.stringify(published, null, 2),
      '2026-08-01T00:00:00Z',
    );
  return conn;
};
const read = (conn) => conn.prepare('SELECT * FROM app_state WHERE id=1').get();
const metadata = (row) => ({
  revision: row.revision,
  published_revision: row.published_revision,
  published_at: row.published_at,
});
const exceptPhotos = (content) => ({
  ...content,
  officials: content.officials.map(({ photo: _photo, ...rest }) => rest),
});
const audit = (conn) => conn.prepare('SELECT * FROM audit').all();

for (const [agency, portraits] of Object.entries(manifest)) {
  const content = source(agency);
  const conn = db(content, content);
  const before = read(conn);
  backfillOfficialPortraits(conn, agency);
  const after = read(conn);
  for (const version of ['draft', 'published']) {
    const result = JSON.parse(after[version]);
    equal(
      result.officials.map((o) => o.photo),
      portraits.map((p) => p.photo),
      agency + ' all correct portraits',
    );
    equal(
      exceptPhotos(result),
      exceptPhotos(content),
      agency + ' all non-photo fields retained',
    );
  }
  equal(
    metadata(after),
    metadata(before),
    agency + ' revisions and publication date retained',
  );
  equal(
    JSON.parse(audit(conn)[0].detail),
    {
      migration: portraitBackfillId,
      draftPhotosAdded: portraits.length,
      publishedPhotosAdded: portraits.length,
    },
    agency + ' audit contains counts only',
  );
  const firstAudit = audit(conn);
  backfillOfficialPortraits(conn, agency);
  equal(read(conn), after, agency + ' repeat does not change state');
  equal(audit(conn), firstAudit, agency + ' repeat does not add audit');
  equal(
    conn.prepare('SELECT COUNT(*) AS n FROM app_migrations').get().n,
    1,
    agency + ' one marker',
  );
  for (const p of portraits)
    equal(
      existsSync('public' + p.photo),
      true,
      agency + ' referenced asset exists',
    );
  conn.close();
}

// Draft and published must be matched independently, including already-uploaded photos.
{
  const draft = source('san-mateo');
  const published = structuredClone(draft);
  draft.officials[0].name = 'Incoming Person';
  draft.officials[1].photo = '/api/agencies/san-mateo/photos/client-upload';
  draft.officials[2].vacant = true;
  draft.officials[3].district = '2';
  draft.officials[4].id = 'replacement';
  published.officials[0].photo = '/portraits/custom-client.webp';
  published.officials[2].name = ' Rob  NEWSOM Jr. ';
  published.agency.name = 'Published settings';
  published.officials.forEach((o) => {
    o.bio = 'Published biography';
    o.email = 'public@example.test';
  });
  const conn = db(draft, published);
  const before = read(conn);
  backfillOfficialPortraits(conn, 'san-mateo');
  const after = read(conn);
  equal(
    after.draft,
    before.draft,
    'entire non-matching draft remains byte-for-byte unchanged',
  );
  const expected = structuredClone(published);
  for (let i = 1; i < expected.officials.length; i++)
    expected.officials[i].photo = manifest['san-mateo'][i].photo;
  equal(
    JSON.parse(after.published),
    expected,
    'only independently eligible published photos change',
  );
  equal(
    metadata(after),
    metadata(before),
    'unpublished revision state remains unchanged',
  );
  equal(
    JSON.parse(audit(conn)[0].detail).draftPhotosAdded,
    0,
    'audit reports skipped draft',
  );
  equal(
    JSON.parse(audit(conn)[0].detail).publishedPhotosAdded,
    4,
    'audit reports four published additions',
  );
  // A later client removal must remain removed after a restart/rerun.
  expected.officials[1].photo = '';
  conn
    .prepare('UPDATE app_state SET published=? WHERE id=1')
    .run(JSON.stringify(expected));
  backfillOfficialPortraits(conn, 'san-mateo');
  equal(
    JSON.parse(read(conn).published),
    expected,
    'later client removal is never reapplied',
  );
  conn.close();
}

// No fuzzy name matching, no missing or malformed field repair, and no agency crossover.
for (const patch of [
  { name: 'Lisa Diaz-Nash' },
  { name: 'Lísa Diaz Nash' },
  { name: 'Lisa Nash' },
  { id: '01' },
  { district: 1 },
  { district: null },
  { vacant: true },
  { vacant: undefined },
  { photo: null },
  { photo: undefined },
  { photo: ' ' },
  { name: null },
]) {
  const content = source('san-mateo');
  content.officials = [{ ...content.officials[0], ...patch }];
  const conn = db(content, content);
  const before = read(conn);
  backfillOfficialPortraits(conn, 'san-mateo');
  equal(
    read(conn),
    before,
    'ambiguous or edited official unchanged: ' + JSON.stringify(patch),
  );
  equal(
    JSON.parse(audit(conn)[0].detail).draftPhotosAdded,
    0,
    'skipped candidate counted correctly',
  );
  conn.close();
}
for (const agency of ['martinez', 'arpeeville', 'unknown', 'burlingame']) {
  const content = source('san-mateo');
  const conn = db(content, content);
  const before = read(conn);
  backfillOfficialPortraits(conn, agency);
  equal(
    read(conn),
    before,
    'unrelated agency/content cannot receive a portrait: ' + agency,
  );
  if (agency !== 'burlingame')
    equal(audit(conn).length, 0, 'non-target agency has no audit or migration');
  conn.close();
}

// Failure must roll back both content versions, audit, and marker atomically.
{
  const content = source('san-mateo');
  const conn = db(content, content);
  const before = read(conn);
  conn.exec(
    "CREATE TRIGGER fail_audit BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT, 'test audit failure'); END;",
  );
  assert.throws(
    () => backfillOfficialPortraits(conn, 'san-mateo'),
    /test audit failure/,
  );
  checks++;
  equal(read(conn), before, 'audit failure rolls back content');
  equal(audit(conn).length, 0, 'audit failure leaves no audit');
  equal(
    conn.prepare('SELECT COUNT(*) AS n FROM app_migrations').get().n,
    0,
    'failed migration leaves no marker',
  );
  conn.exec('DROP TRIGGER fail_audit');
  backfillOfficialPortraits(conn, 'san-mateo');
  equal(
    JSON.parse(read(conn).published).officials[0].photo,
    manifest['san-mateo'][0].photo,
    'migration may safely retry after rollback',
  );
  conn.close();
}
console.log(`Portrait backfill: ${checks} checks passed.`);
