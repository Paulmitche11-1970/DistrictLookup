import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes, scryptSync } from 'node:crypto';
import { tmpdir } from 'node:os';
// A fresh disposable database, with independent credentials, never .data or a Railway volume.
const dataDir = mkdtempSync(path.join(tmpdir(), 'district-lookup-http-'));
const setupToken = randomBytes(24).toString('hex');
const solanoSetupToken = randomBytes(24).toString('hex');
const agencySetupTokens = Object.fromEntries(
  JSON.parse(readFileSync('data/instances.json', 'utf8'))
    .filter((agency) => !['martinez', 'arpeeville'].includes(agency.id))
    .map((agency) => [
      agency.id,
      agency.id === 'solano-county'
        ? solanoSetupToken
        : randomBytes(24).toString('hex'),
    ]),
);
const reviewPassword = randomBytes(16).toString('hex');
const reviewSalt = randomBytes(16).toString('hex');
const reviewHash = `scrypt:${reviewSalt}:${scryptSync(reviewPassword, reviewSalt, 64).toString('hex')}`;
writeFileSync(
  '.test-build/http-config.json',
  JSON.stringify({
    dataDir,
    setupToken,
    solanoSetupToken,
    agencySetupTokens,
    reviewPassword,
    origin: 'http://localhost:3001',
  }),
);
const child = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    process.argv.includes('--dev') ? 'dev' : 'start',
    '--hostname',
    '127.0.0.1',
    '--port',
    '3001',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      APP_SECRET: randomBytes(32).toString('hex'),
      ADMIN_SETUP_TOKEN: setupToken,
      ADMIN_SETUP_TOKEN_SOLANO_COUNTY: solanoSetupToken,
      ...Object.fromEntries(
        Object.entries(agencySetupTokens).map(([id, token]) => [
          'ADMIN_SETUP_TOKEN_' + id.replaceAll('-', '_').toUpperCase(),
          token,
        ]),
      ),
      APP_URL: 'http://localhost:3001',
      RP_REVIEW_PASSWORD_HASH: reviewHash,
      MARTINEZ_REVIEW_PASSWORD_HASH: reviewHash,
      ...(process.argv.includes('--dev') ? { NEXT_DIST_DIR: '.next-qa' } : {}),
    },
  },
);
child.on('exit', (code) => process.exit(code ?? 1));
