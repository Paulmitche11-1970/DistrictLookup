import { createHmac, timingSafeEqual } from 'node:crypto';
export type ReviewScope = 'rp' | 'martinez';
export function reviewHash(scope: ReviewScope) {
  return (
    process.env[
      scope === 'rp'
        ? 'RP_REVIEW_PASSWORD_HASH'
        : 'MARTINEZ_REVIEW_PASSWORD_HASH'
    ] || ''
  );
}
function signature(payload: string, scope: ReviewScope) {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32 || !reviewHash(scope)) return '';
  return createHmac('sha256', secret)
    .update(payload + ':' + reviewHash(scope))
    .digest('hex');
}
export function createReviewToken(scope: ReviewScope, now = Date.now()) {
  const payload = `${scope}:${now + 24 * 60 * 60 * 1000}`;
  const sig = signature(payload, scope);
  if (!sig) throw Error('Review access is not configured.');
  return `${payload}:${sig}`;
}
export function validReviewToken(
  token: string | undefined,
  scope: ReviewScope,
  now = Date.now(),
) {
  if (!token) return false;
  const [providedScope, expiry, supplied] = token.split(':');
  if (
    providedScope !== scope ||
    !/^\d{13}$/.test(expiry || '') ||
    !/^[a-f0-9]{64}$/.test(supplied || '') ||
    Number(expiry) <= now ||
    Number(expiry) > now + 24 * 60 * 60 * 1000
  )
    return false;
  const expected = signature(`${scope}:${expiry}`, scope);
  return (
    !!expected && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  );
}
