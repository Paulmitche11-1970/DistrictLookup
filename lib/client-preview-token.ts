import { createHmac, timingSafeEqual } from 'node:crypto';
import { instanceFor } from './instances';

// Server-only preview credentials. These grant no access to live administration.
const prefixes: Record<string, string> = {
  'san-jose-evergreen': 'SJECCD',
  'barstow-college': 'BARSTOW',
  'placer-union-high-school': 'PUHSD',
  'california-city': 'CALCITY',
  'olivenhain-water': 'OMWD',
  galt: 'GALT',
  martinez: 'MARTINEZ',
  arpeeville: 'ARPEEVILLE',
  'solano-county': 'SOLANO',
  'san-mateo': 'SANMATEO',
  burlingame: 'BURLINGAME',
  millbrae: 'MILLBRAE',
  carpinteria: 'CARPINTERIA',
  'diamond-bar': 'DIAMONDBAR',
  'butte-county': 'BUTTE',
  'yolo-county': 'YOLO',
  belmont: 'BELMONT',
  'midpeninsula-water': 'MPWD',
};
export const clientPreviewCookie = (id: string) => `client_preview_${id}`;
export function clientPreviewPassword(id: string) {
  if (!instanceFor(id) || !prefixes[id]) return '';
  return (
    process.env[
      'AGENCY_PREVIEW_PASSWORD_' + id.replaceAll('-', '_').toUpperCase()
    ] || prefixes[id] + 'Preview'
  );
}
export function matchesClientPreviewPassword(id: string, password: string) {
  const expected = clientPreviewPassword(id);
  const supplied = Buffer.from(password);
  return (
    !!expected &&
    supplied.length === Buffer.byteLength(expected) &&
    timingSafeEqual(supplied, Buffer.from(expected))
  );
}
function signature(id: string, expiry: string) {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32 || !clientPreviewPassword(id)) return '';
  const revision =
    process.env[
      'AGENCY_PREVIEW_REVISION_' + id.replaceAll('-', '_').toUpperCase()
    ] || '1';
  return createHmac('sha256', secret)
    .update(
      `client-preview-editor:v1:${id}:${expiry}:${revision}:${clientPreviewPassword(id)}`,
    )
    .digest('hex');
}
export const previewSessionSeconds = 7 * 24 * 60 * 60;
export function createClientPreviewToken(id: string, now = Date.now()) {
  const expiry = String(now + previewSessionSeconds * 1000);
  const sig = signature(id, expiry);
  if (!sig) throw Error('Preview access is not configured.');
  return `${expiry}:${sig}`;
}
export function validClientPreviewToken(
  id: string,
  token?: string,
  now = Date.now(),
) {
  const [expiry, supplied] = (token || '').split(':');
  if (
    !/^\d{13}$/.test(expiry || '') ||
    !/^[a-f0-9]{64}$/.test(supplied || '') ||
    Number(expiry) <= now ||
    Number(expiry) > now + previewSessionSeconds * 1000
  )
    return false;
  const expected = signature(id, expiry);
  return (
    !!expected && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  );
}
