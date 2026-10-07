import { cookies } from 'next/headers';
import { inAgency } from '@/lib/agency-scope';
import { inClientPreview } from '@/lib/client-preview-scope';
import { instanceFor } from '@/lib/instances';
import {
  clientPreviewCookie,
  createClientPreviewToken,
  matchesClientPreviewPassword,
  previewSessionSeconds,
} from '@/lib/client-preview-token';
import { hasClientPreviewAccess } from '@/lib/client-preview-access';
import {
  boundedBody,
  checkOrigin,
  digest,
  errorResponse,
  HttpError,
  jsonBody,
  rateLimit,
} from '@/lib/security';
import { state, resetClientPreview } from '@/lib/store';
import { recordPreviewAction } from '@/lib/outreach-activity';
import * as admin from '../../../admin/route';
import * as photos from '../../../photos/route';
import * as photo from '../../../photos/[id]/route';
import * as addresses from '../../../addresses/route';
import * as lookup from '../../../lookup/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ agency: string; action: string[] }> };
const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};
export async function POST(request: Request, context: Context) {
  const { agency, action } = await context.params;
  if (!instanceFor(agency) || instanceFor(agency)!.id !== agency)
    return new Response('Not found', { status: 404 });
  return inAgency(agency, async () => {
    try {
      const origin = checkOrigin(request);
      if (action.join('/') === 'login') {
        const body = new URLSearchParams(
          (await boundedBody(request, 3000)).toString('utf8'),
        );
        const login = new URL('/preview/' + agency, origin);
        const reject = (reason: string) => {
          login.searchParams.set('error', reason);
          return Response.redirect(login, 303);
        };
        try {
          const ip = (request.headers.get('x-forwarded-for') || 'unknown')
            .split(',')[0]
            .trim();
          rateLimit('preview-login:' + digest(ip), 12);
          rateLimit('preview-login-global', 300);
        } catch (e) {
          if (e instanceof HttpError && e.status === 429)
            return reject('limited');
          throw e;
        }
        if (!matchesClientPreviewPassword(agency, body.get('password') || ''))
          return reject('incorrect');
        (await cookies()).set(
          clientPreviewCookie(agency),
          createClientPreviewToken(agency),
          {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: previewSessionSeconds,
          },
        );
        await recordPreviewAction(agency, 'preview_login');
        return new Response(null, {
          status: 303,
          headers: { ...privateHeaders, Location: '/' + agency },
        });
      }
      if (!(await hasClientPreviewAccess(agency)))
        throw new HttpError(401, 'Enter your agency preview password.');
      if (action.join('/') === 'logout') {
        (await cookies()).delete(clientPreviewCookie(agency));
        return Response.json({ ok: true }, { headers: privateHeaders });
      }
      return await inClientPreview(async () => {
        state();
        rateLimit('preview-write', 300, 3600);
        if (action.join('/') === 'admin') {
          // The live handler supplies validation, but only preview storage is selected here.
          const body = await jsonBody(request.clone(), 12_000_000);
          if (['publish', 'discard'].includes(String(body.action)))
            throw new HttpError(
              400,
              'Save your preview, or use Return to default.',
            );
          const response = await admin.POST(request);
          if (response.ok)
            await recordPreviewAction(
              agency,
              'preview_save',
              String(body.action),
            );
          return response;
        }
        if (action.join('/') === 'photos') return photos.POST(request);
        if (action.join('/') === 'reset') {
          const body = await jsonBody(request, 1000);
          if (
            !Number.isInteger(body.revision) ||
            body.revision !== state().revision
          )
            throw new HttpError(
              409,
              'Another preview edit was saved. Reload before resetting.',
            );
          resetClientPreview(body.revision as number);
          await recordPreviewAction(agency, 'preview_reset');
          return Response.json({ ok: true }, { headers: privateHeaders });
        }
        return new Response('Not found', { status: 404 });
      });
    } catch (error) {
      return errorResponse(error);
    }
  });
}
export async function GET(request: Request, context: Context) {
  const { agency, action } = await context.params;
  if (!instanceFor(agency) || instanceFor(agency)!.id !== agency)
    return new Response('Not found', { status: 404 });
  if (!(await hasClientPreviewAccess(agency)))
    return Response.json(
      { error: 'Enter your agency preview password.' },
      { status: 401, headers: privateHeaders },
    );
  return inAgency(agency, () =>
    inClientPreview(async () => {
      state();
      if (action.join('/') === 'admin') return admin.GET();
      if (action.join('/') === 'addresses') return addresses.GET(request);
      if (action.join('/') === 'lookup') return lookup.GET(request);
      if (action[0] === 'photos' && action.length === 2)
        return photo.GET(request, {
          params: Promise.resolve({ id: action[1] }),
        });
      return new Response('Not found', { status: 404 });
    }),
  );
}
