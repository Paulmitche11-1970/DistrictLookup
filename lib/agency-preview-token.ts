import { createHmac, timingSafeEqual } from 'node:crypto';
import { instanceFor } from './instances';

export const agencyPreviewCookie = (id: string) => `agency_preview_${id}`;

// Retained to validate legacy sending links, which now redirect to the password
// screen. These tokens never authorize preview editing or live administration.
export function agencyPreviewToken(id: string) {
  const secret = process.env.APP_SECRET;
  if (!instanceFor(id) || !secret || secret.length < 32) return '';
  const revision =
    process.env[
      'AGENCY_PREVIEW_REVISION_' + id.replaceAll('-', '_').toUpperCase()
    ] || '1';
  return createHmac('sha256', secret)
    .update(`agency-published-preview:v1:${id}:${revision}`)
    .digest('base64url');
}

export function validAgencyPreviewToken(id: string, token?: string) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const expected = agencyPreviewToken(id);
  return (
    !!expected && timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  );
}

export function agencySendingPath(id: string) {
  const token = agencyPreviewToken(id);
  return token ? `/preview/${id}` : '';
}
