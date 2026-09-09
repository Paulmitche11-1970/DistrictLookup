import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  passwordHash,
  passwordMatches,
  encrypt,
  decrypt,
  newTotpSecret,
  totp,
  confirmTotp,
  recoveryCodes,
  recover,
  rateLimit,
  boundedBody,
  type Admin,
} from '../lib/security';
import { database, visibleContent } from '../lib/store';
import { readFileSync } from 'node:fs';
process.env.DATA_DIR = mkdtempSync(
  path.join(tmpdir(), 'district-lookup-tests-'),
);
process.env.APP_SECRET = 'unit-test-key-'.repeat(4);
void test('Password hashes are salted and reject incorrect input', () => {
  const hash = passwordHash('This is a test password');
  assert.notEqual(hash, passwordHash('This is a test password'));
  assert.equal(passwordMatches('This is a test password', hash), true);
  assert.equal(passwordMatches('wrong password', hash), false);
});
void test('TOTP encryption, enrollment code replay, and recovery code replay', () => {
  const secret = newTotpSecret();
  const encrypted = encrypt(secret);
  assert.equal(decrypt(encrypted), secret);
  assert.notEqual(encrypted, secret);
  assert.throws(() => decrypt(encrypted.slice(0, -2) + '00'));
  const admin: Admin = {
    id: 'test',
    email: 'test@example.invalid',
    name: 'Test',
    password: 'unused',
    totp_secret: encrypted,
    totp_active: 0,
    last_totp: -1,
  };
  database()
    .prepare(
      'INSERT INTO admins(id,email,name,password,totp_secret,created_at) VALUES(?,?,?,?,?,?)',
    )
    .run(
      admin.id,
      admin.email,
      admin.name,
      admin.password,
      encrypted,
      new Date().toISOString(),
    );
  const code = totp(secret, admin.email).generate();
  assert.equal(confirmTotp(admin, code), true);
  assert.equal(confirmTotp(admin, code), false);
  const codes = recoveryCodes(admin.id);
  assert.equal(codes.length, 10);
  assert.equal(recover(admin, codes[0]), true);
  assert.equal(recover(admin, codes[0]), false);
  rateLimit('test-limit', 1);
  assert.throws(() => rateLimit('test-limit', 1), /Too many/);
});
void test('Hidden public contact and portrait fields are absent from the client payload', () => {
  const c = JSON.parse(readFileSync('data/seed.json', 'utf8'));
  c.agency.showEmail = false;
  c.agency.showPhotos = false;
  c.agency.showStaff = false;
  c.agency.showMayor = false;
  c.officials[0].staffEmail = 'private@example.invalid';
  const result = visibleContent(c);
  assert.ok(
    result.officials.every(
      (o) => !o.email && !o.photo && !o.staffEmail && o.district !== null,
    ),
  );
});
void test('Chunked requests enforce size limits without a Content-Length header', async () => {
  const request = new Request('http://localhost', {
    method: 'POST',
    body: 'x'.repeat(101),
  });
  await assert.rejects(boundedBody(request, 100), /too large/);
});
