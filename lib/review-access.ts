import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validReviewToken, type ReviewScope } from './review-token';
import {
  agencyPreviewCookie,
  validAgencyPreviewToken,
} from './agency-preview-token';
export async function hasReviewAccess(scope: ReviewScope) {
  const jar = await cookies();
  return (
    validReviewToken(jar.get('rp_review')?.value, 'rp') ||
    (scope === 'martinez' &&
      validReviewToken(jar.get('martinez_review')?.value, 'martinez'))
  );
}
export async function requireReviewAccess(scope: ReviewScope, next: string) {
  if (!(await hasReviewAccess(scope)))
    redirect(`/review-access?scope=${scope}&next=${encodeURIComponent(next)}`);
}

export async function hasAgencySendingAccess(id: string) {
  return validAgencyPreviewToken(
    id,
    (await cookies()).get(agencyPreviewCookie(id))?.value,
  );
}

export async function requireAgencyReviewAccess(id: string, next: string) {
  if (await hasAgencySendingAccess(id)) return;
  await requireReviewAccess(id === 'martinez' ? 'martinez' : 'rp', next);
}
