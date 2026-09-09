import {
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
import { cookies } from 'next/headers';
import { TOTP, Secret } from 'otpauth';
import { database } from './store';
export const SESSION_COOKIE = 'dl_session';
export type Admin = {
  id: string;
  email: string;
  name: string;
  password: string;
  totp_secret: string | null;
  totp_active: number;
  last_totp: number;
};
export type Session = { admin: Admin; stage: string; tokenHash: string };
export function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
export function passwordHash(value: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(value, salt, 64).toString('hex')}`;
}
export function passwordMatches(value: string, stored: string) {
  try {
    const [scheme, salt, hash] = stored.split(':');
    if (scheme !== 'scrypt' || !salt || hash?.length !== 128) return false;
    return timingSafeEqual(
      scryptSync(value, salt, 64),
      Buffer.from(hash, 'hex'),
    );
  } catch {
    return false;
  }
}
export function equalsSecret(a: string, b: string) {
  return timingSafeEqual(Buffer.from(digest(a)), Buffer.from(digest(b)));
}
function encryptionKey() {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32)
    throw Error('Server security configuration is incomplete.');
  return createHash('sha256').update(secret).digest();
}
export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  return [
    iv.toString('hex'),
    cipher.getAuthTag().toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}
export function decrypt(value: string) {
  const [iv, tag, data] = value.split(':');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(iv, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
export function totp(secret: string, email: string) {
  return new TOTP({
    issuer: 'District Lookup · Martinez',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  });
}
export function newTotpSecret() {
  return new Secret({ size: 20 }).base32;
}
export function confirmTotp(admin: Admin, code: string) {
  if (!/^\d{6}$/.test(code) || !admin.totp_secret) return false;
  const now = Date.now();
  const delta = totp(decrypt(admin.totp_secret), admin.email).validate({
    token: code,
    timestamp: now,
    window: 1,
  });
  if (delta === null) return false;
  const step = Math.floor(now / 30000) + delta;
  return (
    Number(
      database()
        .prepare('UPDATE admins SET last_totp=? WHERE id=? AND last_totp<?')
        .run(step, admin.id, step).changes,
    ) === 1
  );
}
export async function session(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = digest(token);
  const r = database()
    .prepare(
      'SELECT a.*,s.stage FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.expires_at>?',
    )
    .get(tokenHash, Date.now()) as (Admin & { stage: string }) | undefined;
  return r ? { admin: r, stage: r.stage, tokenHash } : null;
}
export async function requireAdmin() {
  const s = await session();
  if (!s || s.stage !== 'full' || s.admin.totp_active !== 1)
    throw new HttpError(
      401,
      'Please sign in and complete two-factor authentication.',
    );
  return s;
}
export async function createSession(adminId: string, stage: string) {
  const jar = await cookies();
  const old = jar.get(SESSION_COOKIE)?.value;
  if (old)
    database()
      .prepare('DELETE FROM sessions WHERE token_hash=?')
      .run(digest(old));
  const token = randomBytes(32).toString('hex');
  const seconds = stage === 'full' ? 8 * 60 * 60 : 10 * 60;
  database()
    .prepare(
      'INSERT INTO sessions(token_hash,admin_id,stage,expires_at) VALUES(?,?,?,?)',
    )
    .run(digest(token), adminId, stage, Date.now() + seconds * 1000);
  database().prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: seconds,
  });
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token)
    database()
      .prepare('DELETE FROM sessions WHERE token_hash=?')
      .run(digest(token));
  jar.delete(SESSION_COOKIE);
}
export function checkOrigin(request: Request) {
  const expected = process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : new URL(request.url).origin;
  const origin = request.headers.get('origin');
  if (origin !== expected)
    throw new HttpError(403, 'This request did not come from the application.');
}
export function rateLimit(key: string, max = 8, seconds = 900) {
  const db = database();
  const now = Date.now();
  db.prepare('DELETE FROM rate_limits WHERE expires_at<?').run(now);
  db.prepare(
    'INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',
  ).run(key, now + seconds * 1000);
  const row = db
    .prepare('SELECT count FROM rate_limits WHERE key=?')
    .get(key) as { count: number };
  if (row.count > max)
    throw new HttpError(
      429,
      'Too many attempts. Please wait before trying again.',
    );
}
export function recover(admin: Admin, code: string) {
  return (
    Number(
      database()
        .prepare('DELETE FROM recovery_codes WHERE admin_id=? AND hash=?')
        .run(admin.id, digest(code.toUpperCase().replace(/\s/g, ''))).changes,
    ) === 1
  );
}
export function recoveryCodes(adminId: string) {
  const codes = Array.from({ length: 10 }, () =>
    randomBytes(6).toString('hex').toUpperCase(),
  );
  database()
    .prepare('DELETE FROM recovery_codes WHERE admin_id=?')
    .run(adminId);
  for (const code of codes)
    database()
      .prepare('INSERT INTO recovery_codes(hash,admin_id) VALUES(?,?)')
      .run(digest(code), adminId);
  return codes;
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function boundedBody(request: Request, max: number) {
  if (Number(request.headers.get('content-length') || 0) > max)
    throw new HttpError(413, 'The file or request is too large.');
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new HttpError(413, 'The file or request is too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function jsonBody(request: Request, max = 2_000_000) {
  const text = (await boundedBody(request, max)).toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Invalid request.');
  }
}
export function errorResponse(error: unknown) {
  const e = error as Error;
  if (e instanceof HttpError)
    return Response.json({ error: e.message }, { status: e.status });
  if (e.name === 'ZodError')
    return Response.json(
      {
        error:
          'Please check the required fields and use valid email and website addresses.',
      },
      { status: 400 },
    );
  console.error(e.message);
  return Response.json(
    { error: 'The request could not be completed. Please try again.' },
    { status: 500 },
  );
}
