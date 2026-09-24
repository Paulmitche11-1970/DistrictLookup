import { cookies } from 'next/headers';
import {
  agencyPreviewCookie,
  validAgencyPreviewToken,
} from '@/lib/agency-preview-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agency: string; token: string }> },
) {
  const { agency, token } = await params;
  const headers = {
    'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  };
  if (!validAgencyPreviewToken(agency, token)) {
    return new Response(
      'This preview link is unavailable. Please ask Redistricting Partners for a new sending link.',
      { status: 404, headers },
    );
  }
  (await cookies()).set(agencyPreviewCookie(agency), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/' + agency,
    maxAge: 30 * 24 * 60 * 60,
  });
  // Strip the credential before rendering any page, analytics, or external link.
  return new Response(null, {
    status: 303,
    headers: { ...headers, Location: '/' + agency },
  });
}
