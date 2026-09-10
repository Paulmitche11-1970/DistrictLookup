import { cookies } from 'next/headers';
import { createReviewToken, reviewHash } from '@/lib/review-token';
import {
  boundedBody,
  checkOrigin,
  digest,
  errorResponse,
  HttpError,
  passwordMatches,
  rateLimit,
} from '@/lib/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = new URLSearchParams(
      (await boundedBody(request, 3000)).toString('utf8'),
    );
    const scope = body.get('scope') === 'rp' ? 'rp' : 'martinez';
    const next =
      scope === 'rp'
        ? [
            '/arpeeville',
            '/arpeeville/administration',
            '/arpeeville/preview',
          ].includes(body.get('next') || '')
          ? body.get('next')!
          : '/'
        : body.get('next') === '/martinez/administration'
          ? '/martinez/administration'
          : '/martinez';
    const base = process.env.APP_URL || new URL(request.url).origin;
    const login = new URL('/review-access', base);
    login.searchParams.set('scope', scope);
    login.searchParams.set('next', next);
    const reject = (reason: string) => {
      login.searchParams.set('error', reason);
      return Response.redirect(login, 303);
    };
    try {
      const ip = (request.headers.get('x-forwarded-for') || 'unknown')
        .split(',')[0]
        .trim();
      rateLimit('review:' + scope + ':' + digest(ip), 12);
      rateLimit('review-global:' + scope, 300);
    } catch (e) {
      if (e instanceof HttpError && e.status === 429) return reject('limited');
      throw e;
    }
    if (!reviewHash(scope)) return reject('unavailable');
    const password = body.get('password') || '';
    if (password.length > 128 || !passwordMatches(password, reviewHash(scope)))
      return reject('incorrect');
    const jar = await cookies();
    jar.set(`${scope}_review`, createReviewToken(scope), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    });
    return Response.redirect(new URL(next, base), 303);
  } catch (e) {
    return errorResponse(e);
  }
}
