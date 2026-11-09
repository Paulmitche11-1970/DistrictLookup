import { cookies } from 'next/headers';
import { z } from 'zod';
import { inAgency } from '@/lib/agency-scope';
import { inClientPreview } from '@/lib/client-preview-scope';
import { instanceFor } from '@/lib/instances';
import {
  requireAdmin,
  checkOrigin,
  errorResponse,
  jsonBody,
  HttpError,
  rateLimit,
} from '@/lib/security';
import { state } from '@/lib/store';
import {
  transition,
  transitionKeyValid,
  transitionContent,
  withBoard,
  boardArchives,
  archiveContent,
  createTransition,
  saveTransition,
  launchTransition,
  rotateTransitionKey,
  discardTransition,
  transitionReadiness,
  TransitionError,
} from '@/lib/board-transition';
import { hasTransitionAccess, transitionCookie } from '@/lib/transition-access';
import * as addresses from '../../../addresses/route';
import * as lookup from '../../../lookup/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ agency: string; action?: string[] }> };
const headers = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};
function failure(e: unknown) {
  const r =
    e instanceof TransitionError
      ? Response.json({ error: e.message }, { status: e.status })
      : errorResponse(e);
  Object.entries(headers).forEach(([k, v]) => r.headers.set(k, v));
  return r;
}
async function scoped(
  request: Request,
  context: Context,
  work: (action: string, agency: string, demo: boolean) => Promise<Response>,
) {
  const { agency, action = [] } = await context.params;
  if (instanceFor(agency)?.id !== agency)
    return new Response('Not found', { status: 404 });
  const demo = new URL(request.url).searchParams.get('demo') === '1';
  try {
    return await inAgency(agency, () =>
      demo
        ? inClientPreview(() => work(action.join('/'), agency, demo))
        : work(action.join('/'), agency, demo),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function GET(request: Request, context: Context) {
  return scoped(request, context, async (action, agency, demo) => {
    const params = new URL(request.url).searchParams;
    if (action === 'access') {
      const key = params.get('key') || '';
      if (!transitionKeyValid(key))
        throw new HttpError(
          403,
          'This transition link has expired or was replaced. Ask the agency administrator for a new link.',
        );
      (await cookies()).set(transitionCookie(), key, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 604800,
      });
      return new Response(null, {
        status: 303,
        headers: {
          ...headers,
          Location: `/${agency}/transition${demo ? '?demo=1' : ''}`,
        },
      });
    }
    if (action === 'addresses' || action === 'lookup') {
      if (!(await hasTransitionAccess()))
        throw new HttpError(
          403,
          'Open your private transition preview link first.',
        );
      transitionContent(); // A consumed preview must no longer resolve requests.
      const url = new URL(request.url);
      url.searchParams.delete('preview');
      const response = await (action === 'addresses'
        ? addresses.GET(new Request(url))
        : lookup.GET(new Request(url)));
      Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      return response;
    }
    await requireAdmin();
    if (action === 'archive')
      return Response.json(
        { content: archiveContent(z.uuid().parse(params.get('id'))) },
        { headers },
      );
    if (action) throw new HttpError(404, 'Not found');
    const current = state();
    const incoming = transition();
    const content = incoming
      ? withBoard(current.published, incoming.board)
      : current.published;
    return Response.json(
      {
        transition: incoming,
        content,
        readinessIssue: incoming ? transitionReadiness(content) : null,
        liveRevision: current.revision,
        hasChanges:
          JSON.stringify(current.draft) !== JSON.stringify(current.published),
        archives: boardArchives(),
      },
      { headers },
    );
  });
}
export async function POST(request: Request, context: Context) {
  return scoped(request, context, async (action, _agency, demo) => {
    checkOrigin(request);
    const admin = await requireAdmin();
    rateLimit(
      'board-transition-write:' + (demo ? 'preview' : 'live'),
      300,
      3600,
    );
    if (action) throw new HttpError(404, 'Not found');
    const body = await jsonBody(request, 6_000_000);
    const actor = admin.admin.email;
    if (body.action === 'create' || body.action === 'restore') {
      createTransition(
        body.title,
        body.swearingIn || '',
        actor,
        body.action === 'restore' ? z.uuid().parse(body.archiveId) : undefined,
      );
    } else {
      const id = z.uuid().parse(body.id);
      const revision = z.number().int().min(1).parse(body.revision);
      if (body.action === 'save')
        saveTransition(
          id,
          revision,
          body.board,
          body.title,
          body.swearingIn,
          actor,
        );
      else if (body.action === 'launch') {
        if (body.confirm !== 'LAUNCH')
          throw new HttpError(400, 'Confirm the launch before continuing.');
        launchTransition(
          id,
          revision,
          z.number().int().min(1).parse(body.liveRevision),
          actor,
        );
      } else if (body.action === 'rotate')
        rotateTransitionKey(id, revision, actor);
      else if (body.action === 'discard')
        discardTransition(id, revision, actor);
      else throw new HttpError(400, 'Unknown action');
    }
    return Response.json({ ok: true }, { headers });
  });
}
