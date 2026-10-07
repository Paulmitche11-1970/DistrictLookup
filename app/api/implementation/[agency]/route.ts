import { instanceFor } from '@/lib/instances';
import { hasClientPreviewAccess } from '@/lib/client-preview-access';
import { inAgency } from '@/lib/agency-scope';
import { inClientPreview } from '@/lib/client-preview-scope';
import { state } from '@/lib/store';
import { implementationSchema } from '@/lib/implementation-model';
import {
  createImplementation,
  ImplementationError,
} from '@/lib/implementation-store';
import {
  checkOrigin,
  jsonBody,
  HttpError,
  errorResponse,
  rateLimit,
} from '@/lib/security';
import { recordPreviewAction } from '@/lib/outreach-activity';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(
  request: Request,
  context: { params: Promise<{ agency: string }> },
) {
  try {
    checkOrigin(request);
    const { agency } = await context.params;
    if (!instanceFor(agency) || instanceFor(agency)!.id !== agency)
      throw new HttpError(404, 'Agency not found.');
    if (!(await hasClientPreviewAccess(agency)))
      throw new HttpError(401, 'Enter your agency preview password first.');
    return await inAgency(agency, () =>
      inClientPreview(async () => {
        rateLimit('implementation-request', 20, 3600);
        const input = implementationSchema.parse(
          await jsonBody(request, 16_000),
        );
        const current = state();
        const result = createImplementation(
          agency,
          input,
          current.published,
          current.revision,
        );
        if (result.created)
          await recordPreviewAction(
            agency,
            'implementation_request',
            input.layout,
          );
        return Response.json(
          { id: result.request.id, status: result.request.status },
          {
            status: result.created ? 201 : 200,
            headers: { 'Cache-Control': 'private, no-store' },
          },
        );
      }),
    );
  } catch (error) {
    return errorResponse(
      error instanceof ImplementationError
        ? new HttpError(error.status, error.message)
        : error,
    );
  }
}
