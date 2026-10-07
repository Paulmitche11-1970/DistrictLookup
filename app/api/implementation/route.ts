import { hasReviewAccess } from '@/lib/review-access';
import { implementationUpdateSchema } from '@/lib/implementation-model';
import {
  updateImplementation,
  ImplementationError,
} from '@/lib/implementation-store';
import {
  checkOrigin,
  jsonBody,
  HttpError,
  errorResponse,
} from '@/lib/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (!(await hasReviewAccess('rp')))
      throw new HttpError(401, 'RP team sign-in required.');
    const input = implementationUpdateSchema.parse(
      await jsonBody(request, 8000),
    );
    const updated = updateImplementation(input);
    return Response.json(
      { version: updated.version },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(
      error instanceof ImplementationError
        ? new HttpError(error.status, error.message)
        : error,
    );
  }
}
