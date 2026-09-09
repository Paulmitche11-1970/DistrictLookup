import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import QRCode from 'qrcode';
import { database, audit } from '@/lib/store';
import { credentialsSchema } from '@/lib/validation';
import {
  checkOrigin,
  createSession,
  session,
  requireAdmin,
  logout,
  passwordHash,
  passwordMatches,
  encrypt,
  decrypt,
  newTotpSecret,
  totp,
  confirmTotp,
  recover,
  recoveryCodes,
  rateLimit,
  equalsSecret,
  HttpError,
  errorResponse,
  jsonBody,
  type Admin,
} from '@/lib/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await params;
    if (action === 'status') {
      const s = await session();
      const count = (
        database().prepare('SELECT COUNT(*) AS n FROM admins').get() as {
          n: number;
        }
      ).n;
      return Response.json(
        {
          setupRequired: count === 0,
          stage: s?.stage || null,
          name: s?.admin.name || null,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (action === 'enroll') {
      const s = await session();
      if (
        !s ||
        s.stage !== 'enroll' ||
        s.admin.totp_active ||
        !s.admin.totp_secret
      )
        throw new HttpError(401, 'Start account setup first.');
      const secret = decrypt(s.admin.totp_secret);
      const uri = totp(secret, s.admin.email).toString();
      return Response.json(
        { secret, qr: await QRCode.toDataURL(uri, { margin: 1, width: 240 }) },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    throw new HttpError(404, 'Not found.');
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    checkOrigin(request);
    const { action } = await params;
    const body = await jsonBody(request, 6000);
    const db = database();
    if (action === 'setup') {
      rateLimit('setup', 15);
      const input = credentialsSchema
        .extend({
          name: z.string().trim().min(2).max(100),
          setupToken: z.string().min(20).max(200),
        })
        .parse(body);
      if (
        !process.env.ADMIN_SETUP_TOKEN ||
        !equalsSecret(input.setupToken, process.env.ADMIN_SETUP_TOKEN)
      )
        throw new HttpError(403, 'The setup code is incorrect.');
      if (
        (db.prepare('SELECT COUNT(*) AS n FROM admins').get() as { n: number })
          .n
      )
        throw new HttpError(409, 'An administrator is already configured.');
      const id = randomUUID();
      const secret = encrypt(newTotpSecret());
      const password = passwordHash(input.password);
      db.exec('BEGIN IMMEDIATE');
      try {
        if (
          (
            db.prepare('SELECT COUNT(*) AS n FROM admins').get() as {
              n: number;
            }
          ).n
        )
          throw new HttpError(409, 'An administrator is already configured.');
        db.prepare(
          'INSERT INTO admins(id,email,name,password,totp_secret,created_at) VALUES(?,?,?,?,?,?)',
        ).run(
          id,
          input.email,
          input.name,
          password,
          secret,
          new Date().toISOString(),
        );
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      await createSession(id, 'enroll');
      return Response.json({ next: '/admin/enroll' });
    }
    if (action === 'login') {
      const input = credentialsSchema.parse(body);
      rateLimit('login:' + input.email);
      rateLimit('login-global', 100);
      const admin = db
        .prepare('SELECT * FROM admins WHERE email=?')
        .get(input.email) as Admin | undefined;
      const valid = passwordMatches(
        input.password,
        admin?.password || passwordHash('unavailable-account-password'),
      );
      if (!admin || !valid)
        throw new HttpError(401, 'Email or password is incorrect.');
      await createSession(admin.id, admin.totp_active ? 'challenge' : 'enroll');
      return Response.json({
        next: admin.totp_active ? '/admin/verify' : '/admin/enroll',
      });
    }
    if (action === 'verify' || action === 'enroll') {
      const s = await session();
      if (!s || !['challenge', 'enroll'].includes(s.stage))
        throw new HttpError(401, 'Please sign in again.');
      rateLimit('mfa:' + s.admin.id, 8, 300);
      const code = z.string().trim().min(6).max(20).parse(body.code);
      const enrollment = action === 'enroll';
      if (enrollment && (s.stage !== 'enroll' || s.admin.totp_active))
        throw new HttpError(403, 'Enrollment is unavailable.');
      if (!enrollment && s.stage !== 'challenge')
        throw new HttpError(403, 'Finish enrollment first.');
      const valid =
        confirmTotp(s.admin, code) ||
        (!enrollment && body.recovery === true && recover(s.admin, code));
      if (!valid)
        throw new HttpError(
          401,
          'That code is invalid or already used. Try the next code.',
        );
      let codes: string[] | undefined;
      if (enrollment) {
        db.prepare('UPDATE admins SET totp_active=1 WHERE id=?').run(
          s.admin.id,
        );
        codes = recoveryCodes(s.admin.id);
        audit(s.admin.email, 'Security', 'Two-factor authentication enabled');
      }
      await createSession(s.admin.id, 'full');
      audit(s.admin.email, 'Signed in', 'Password and second factor verified');
      return Response.json({ next: '/admin', recoveryCodes: codes });
    }
    if (action === 'logout') {
      await logout();
      return Response.json({ ok: true });
    }
    if (action === 'password') {
      const s = await requireAdmin();
      const input = z
        .object({
          currentPassword: z.string().min(1).max(128),
          password: z.string().min(12).max(128),
        })
        .parse(body);
      rateLimit('password:' + s.admin.id, 8);
      if (!passwordMatches(input.currentPassword, s.admin.password))
        throw new HttpError(401, 'Current password is incorrect.');
      db.prepare('UPDATE admins SET password=? WHERE id=?').run(
        passwordHash(input.password),
        s.admin.id,
      );
      db.prepare('DELETE FROM sessions WHERE admin_id=?').run(s.admin.id);
      await createSession(s.admin.id, 'full');
      audit(
        s.admin.email,
        'Security',
        'Password changed; other sessions revoked',
      );
      return Response.json({ ok: true });
    }
    if (action === 'recovery') {
      const s = await requireAdmin();
      rateLimit('recovery:' + s.admin.id, 5);
      if (!passwordMatches(String(body.password || ''), s.admin.password))
        throw new HttpError(401, 'Password is incorrect.');
      return Response.json({ recoveryCodes: recoveryCodes(s.admin.id) });
    }
    throw new HttpError(404, 'Not found.');
  } catch (e) {
    return errorResponse(e);
  }
}
