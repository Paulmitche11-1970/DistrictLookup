import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import type { Content, Address } from './model';
import { currentAgencyId, currentInstance } from './agency-scope';
import { visibleOfficial } from './representation';
import { sanitizeBiography } from './biography-html';
const databases = new Map<string, DatabaseSync>();
let postalCodes: Record<string, string> | undefined;
function withPostalCode(address: Address): Address {
  if (currentAgencyId() !== 'martinez')
    return { ...address, city: address.city || currentInstance().shortName };
  postalCodes ||= JSON.parse(
    readFileSync(
      path.join(process.cwd(), 'data/address-postal-codes.json'),
      'utf8',
    ),
  );
  return {
    ...address,
    ...(postalCodes?.[address.id] ? { zip: postalCodes[address.id] } : {}),
  };
}
export function dataDir() {
  const base = process.env.DATA_DIR || path.join(process.cwd(), '.data');
  return currentAgencyId() === 'martinez'
    ? base
    : path.join(/* turbopackIgnore: true */ base, currentAgencyId());
}
export function database() {
  const dir = dataDir();
  const existing = databases.get(dir);
  if (existing) return existing;
  const seedDir = path.join(
    process.cwd(),
    'data',
    currentInstance().seedDirectory,
  );
  mkdirSync(dir, { recursive: true });
  const conn = new DatabaseSync(path.join(dir, 'district-lookup.sqlite'));
  conn.exec(
    'PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;',
  );
  conn.exec(
    `CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), draft TEXT NOT NULL, published TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, published_revision INTEGER NOT NULL DEFAULT 1, published_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password TEXT NOT NULL,totp_secret TEXT,totp_active INTEGER NOT NULL DEFAULT 0,last_totp INTEGER NOT NULL DEFAULT -1,created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,admin_id TEXT NOT NULL REFERENCES admins(id),stage TEXT NOT NULL,expires_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS sessions_admin ON sessions(admin_id); CREATE TABLE IF NOT EXISTS recovery_codes (hash TEXT PRIMARY KEY,admin_id TEXT NOT NULL REFERENCES admins(id)); CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY,mime TEXT NOT NULL,created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS addresses (id TEXT PRIMARY KEY,label TEXT NOT NULL,search TEXT NOT NULL,lon REAL NOT NULL,lat REAL NOT NULL); CREATE INDEX IF NOT EXISTS addresses_search ON addresses(search);`,
  );
  const addressColumns = conn.prepare('PRAGMA table_info(addresses)').all() as {
    name: string;
  }[];
  for (const column of ['city', 'zip']) {
    if (!addressColumns.some((c) => c.name === column))
      conn.exec(`ALTER TABLE addresses ADD COLUMN ${column} TEXT`);
  }
  if (!conn.prepare('SELECT id FROM app_state WHERE id=1').get()) {
    const content = readFileSync(path.join(seedDir, 'seed.json'), 'utf8');
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
    const compressed = path.join(seedDir, 'addresses.json.gz');
    const records = JSON.parse(
      existsSync(compressed)
        ? gunzipSync(readFileSync(compressed)).toString('utf8')
        : readFileSync(path.join(seedDir, 'addresses.json'), 'utf8'),
    ) as Address[];
    const insert = conn.prepare(
      'INSERT INTO addresses (id,label,search,lon,lat,city,zip) VALUES (?,?,?,?,?,?,?)',
    );
    conn.exec('BEGIN');
    try {
      for (const a of records)
        insert.run(
          a.id,
          a.label,
          normalizeSearch(a.label),
          a.lon,
          a.lat,
          a.city || null,
          a.zip || null,
        );
      conn.exec('COMMIT');
    } catch (e) {
      conn.exec('ROLLBACK');
      throw e;
    }
  }
  conn.exec('CREATE TABLE IF NOT EXISTS app_migrations (id TEXT PRIMARY KEY)');
  if (
    !conn
      .prepare('SELECT id FROM app_migrations WHERE id=?')
      .get('address-search-locality-v1')
  ) {
    // Rebuild old databases too: residents often paste the entire displayed address.
    const content = JSON.parse(
      (
        conn.prepare('SELECT draft FROM app_state WHERE id=1').get() as {
          draft: string;
        }
      ).draft,
    ) as Content;
    const stateName = content.agency.state;
    const stateCode =
      (
        { California: 'CA', Arizona: 'AZ', 'New York': 'NY' } as Record<
          string,
          string
        >
      )[stateName] || '';
    const addresses = conn
      .prepare('SELECT id,label,lon,lat,city,zip FROM addresses')
      .all() as Address[];
    const update = conn.prepare('UPDATE addresses SET search=? WHERE id=?');
    conn.exec('BEGIN');
    try {
      for (const row of addresses) {
        const address = withPostalCode(row);
        update.run(
          normalizeSearch(
            [
              address.label,
              address.city || content.agency.shortName,
              stateName,
              stateCode,
              address.zip || '',
              'USA United States',
            ].join(' '),
          ),
          address.id,
        );
      }
      conn
        .prepare('INSERT INTO app_migrations(id) VALUES(?)')
        .run('address-search-locality-v1');
      conn.exec('COMMIT');
    } catch (error) {
      conn.exec('ROLLBACK');
      throw error;
    }
  }
  if (
    currentAgencyId() === 'arpeeville' &&
    !conn
      .prepare('SELECT id FROM app_migrations WHERE id=?')
      .get('arpeeville-jokes-and-mayor-v1')
  ) {
    const jokes = JSON.parse(
      readFileSync(path.join(seedDir, 'joke-addresses.json'), 'utf8'),
    ) as Address[];
    const insert = conn.prepare(
      'INSERT OR IGNORE INTO addresses (id,label,search,lon,lat,city,zip) VALUES (?,?,?,?,?,?,?)',
    );
    conn.exec('BEGIN');
    try {
      for (const address of jokes)
        insert.run(
          address.id,
          address.label,
          normalizeSearch(
            [address.label, 'Arpeeville California CA USA United States'].join(
              ' ',
            ),
          ),
          address.lon,
          address.lat,
          'Arpeeville',
          null,
        );
      // Apply this default once so a later administrative choice stays authoritative.
      const row = conn
        .prepare('SELECT draft,published FROM app_state WHERE id=1')
        .get() as { draft: string; published: string };
      const markMayor = (raw: string) => {
        const content = JSON.parse(raw) as Content;
        for (const official of content.officials)
          if (
            official.district === null &&
            official.name === 'Liz Stitt' &&
            official.selectionMethod === undefined
          )
            official.selectionMethod = 'elected';
        return JSON.stringify(content);
      };
      conn
        .prepare('UPDATE app_state SET draft=?,published=? WHERE id=1')
        .run(markMayor(row.draft), markMayor(row.published));
      conn
        .prepare('INSERT INTO app_migrations(id) VALUES(?)')
        .run('arpeeville-jokes-and-mayor-v1');
      conn.exec('COMMIT');
    } catch (error) {
      conn.exec('ROLLBACK');
      throw error;
    }
  }
  if (
    currentAgencyId() === 'arpeeville' &&
    !conn
      .prepare('SELECT id FROM app_migrations WHERE id=?')
      .get('arpeeville-spread-addresses-v2')
  ) {
    // Reposition only the known fictional addresses; preserve all client drafts and settings.
    const records = ['addresses.json', 'joke-addresses.json'].flatMap(
      (file) =>
        JSON.parse(readFileSync(path.join(seedDir, file), 'utf8')) as Address[],
    );
    const update = conn.prepare('UPDATE addresses SET lon=?,lat=? WHERE id=?');
    conn.exec('BEGIN');
    try {
      for (const address of records)
        update.run(address.lon, address.lat, address.id);
      conn
        .prepare('INSERT INTO app_migrations(id) VALUES(?)')
        .run('arpeeville-spread-addresses-v2');
      conn.exec('COMMIT');
    } catch (error) {
      conn.exec('ROLLBACK');
      throw error;
    }
  }
  databases.set(dir, conn);
  return conn;
}
export function normalizeSearch(value: string) {
  const synonyms: Record<string, string> = {
    street: 'st',
    avenue: 'ave',
    av: 'ave',
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
    draft: withInstance(JSON.parse(r.draft) as Content),
    published: withInstance(JSON.parse(r.published) as Content),
    revision: r.revision,
    publishedRevision: r.published_revision,
    publishedAt: r.published_at,
  };
}
function withInstance(content: Content): Content {
  const instance = currentInstance();
  if (content.management === undefined && instance.id === 'martinez')
    content.management = JSON.parse(
      readFileSync(
        path.join(process.cwd(), 'data/management-seed.json'),
        'utf8',
      ),
    );
  if (instance.sandbox) {
    // Normalize the original placeholder copy while preserving subsequent custom edits.
    if (
      content.agency.intro ===
      'Explore our fictional city. Try a sample address to meet your councilmember, or browse the five districts.'
    )
      content.agency.intro =
        'Enter your street address to find your district and connect with your councilmember.';
    content.officials = content.officials.map((official) => ({
      ...official,
      bio:
        official.bio ===
        'Fictional office assignment for the Arpeeville demonstration. Contact details and term dates are sample data.'
          ? ''
          : official.bio,
      phoneLabel:
        official.phoneLabel === 'Demo office line'
          ? 'Office'
          : official.phoneLabel,
      staffName:
        official.staffName === 'Demo constituent services'
          ? 'Constituent services'
          : official.staffName,
    }));
  }
  return {
    ...content,
    agency: {
      ...content.agency,
      instanceId: instance.id,
      kind: instance.kind,
      logo: instance.logo,
      slogan: instance.slogan,
      addressMode: instance.addressMode,
      sampleAddress: instance.sampleAddress,
      addressNote: instance.addressNote,
      ...(instance.sandbox ? { sandbox: true } : {}),
    },
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
      .filter((o) => visibleOfficial(content, o))
      .map((o) => ({
        ...o,
        photo: a.showPhotos ? o.photo : '',
        email: a.showEmail ? o.email : '',
        phone: a.showPhone ? o.phone : '',
        phoneLabel: a.showPhone ? o.phoneLabel : '',
        website: a.showWebsite ? o.website : '',
        termEnd: a.showTerm ? o.termEnd : '',
        bio:
          a.showBiographies === false || o.vacant
            ? ''
            : o.bioFormat === 'html'
              ? sanitizeBiography(o.bio, a.showPhotos)
              : o.bio,
        staffName: a.showStaff ? o.staffName : '',
        staffEmail: a.showStaff ? o.staffEmail : '',
        staffPhone: a.showStaff ? o.staffPhone : '',
      })),
    management:
      a.showManagement === false
        ? []
        : (content.management || [])
            .filter((p) => p.visible)
            .map((p) => ({
              ...p,
              photo: a.showPhotos ? p.photo : '',
              email: a.showEmail ? p.email : '',
              phone: a.showPhone ? p.phone : '',
              phoneLabel: a.showPhone ? p.phoneLabel : '',
              website: a.showWebsite ? p.website : '',
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
  const address = database()
    .prepare('SELECT id,label,lon,lat,city,zip FROM addresses WHERE id=?')
    .get(id) as Address | undefined;
  return address ? withPostalCode(address) : undefined;
}
export function addressSearch(query: string) {
  const q = normalizeSearch(query);
  if (q.length < (currentAgencyId() === 'arpeeville' ? 1 : 2)) return [];
  const tokens = q.split(' ').slice(0, 8);
  const clauses = tokens.map(() => `(' '||search) LIKE ?`).join(' AND ');
  const addresses = database()
    .prepare(
      `SELECT id,label,lon,lat,city,zip FROM addresses WHERE ${clauses} ORDER BY CASE WHEN search LIKE ? THEN 0 ELSE 1 END,label LIMIT 40`,
    )
    .all(...tokens.map((t) => '% ' + t + '%'), q + '%') as Address[];
  return addresses.map(withPostalCode);
}
export function randomArpeevilleAddresses() {
  if (currentAgencyId() !== 'arpeeville') return [];
  return (
    database()
      .prepare(
        'SELECT id,label,lon,lat,city,zip FROM addresses ORDER BY RANDOM()',
      )
      .all() as Address[]
  ).map(withPostalCode);
}
