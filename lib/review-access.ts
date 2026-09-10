import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validReviewToken, type ReviewScope } from './review-token';
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
