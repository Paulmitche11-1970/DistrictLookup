import { z } from 'zod';
import { hasReviewAccess } from '@/lib/review-access';
import {
  checkOrigin,
  jsonBody,
  errorResponse,
  HttpError,
} from '@/lib/security';
import {
  createWebsitePage,
  saveWebsiteDocument,
  unpublishWebsitePage,
  restoreWebsiteRevision,
  websiteHistory,
  websiteRecords,
  websiteMedia,
  WebsiteError,
} from '@/lib/website-store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function authorize() {
  if (!(await hasReviewAccess('rp')))
    throw new HttpError(
      401,
      'Sign in with RP staff access to edit the website.',
    );
}
function response(value: unknown) {
  return Response.json(value, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
function failure(error: unknown) {
  return error instanceof WebsiteError
    ? Response.json({ error: error.message }, { status: error.status })
    : errorResponse(error);
}
export async function GET(request: Request) {
  try {
    await authorize();
    const history = new URL(request.url).searchParams.get('history');
    return response(
      history
        ? { history: websiteHistory(history) }
        : { records: websiteRecords(), media: websiteMedia() },
    );
  } catch (error) {
    return failure(error);
  }
}
const actionSchema = z.object({
  action: z.enum(['create', 'save', 'publish', 'unpublish', 'restore']),
  id: z.string().max(100).optional(),
  revision: z.number().int().positive().optional(),
  historyId: z.number().int().positive().optional(),
  document: z.unknown().optional(),
});
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await authorize();
    const value = actionSchema.parse(await jsonBody(request, 2_000_000));
    if (value.action === 'create')
      return response({ record: createWebsitePage(value.document) });
    if (!value.id || !value.revision)
      throw new HttpError(400, 'A page and its revision are required.');
    const record =
      value.action === 'unpublish'
        ? unpublishWebsitePage(value.id, value.revision)
        : value.action === 'restore'
          ? restoreWebsiteRevision(
              value.id,
              z.number().int().positive().parse(value.historyId),
              value.revision,
            )
          : saveWebsiteDocument(
              value.id,
              value.document,
              value.revision,
              value.action === 'publish',
            );
    return response({ record });
  } catch (error) {
    return failure(error);
  }
}
