import { z } from 'zod';
import { createHash } from 'node:crypto';
import {
  activityContext,
  activityLabels,
  cleanActivityText,
  referralSource,
  type ActivityType,
} from '@/lib/activity-model';
import { recordActivity } from '@/lib/activity-store';
import {
  checkOrigin,
  jsonBody,
  errorResponse,
  HttpError,
} from '@/lib/security';
import { inAgency } from '@/lib/agency-scope';
import { addressById, publicContent } from '@/lib/store';
import { locate } from '@/lib/geo';
import { fullAddress } from '@/lib/model';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const schema = z
  .object({
    id: z.uuid(),
    visitId: z.uuid(),
    path: z.string().max(180),
    design: z.string().max(20).default(''),
    type: z.enum(
      Object.keys(activityLabels) as [ActivityType, ...ActivityType[]],
    ),
    referrer: z.string().max(3000).default(''),
    utmSource: z.string().max(80).default(''),
    medium: z.string().max(80).default(''),
    campaign: z.string().max(120).default(''),
    target: z.string().max(180).default(''),
    addressId: z.string().max(150).optional(),
    query: z.string().max(120).optional(),
  })
  .strict();
const limits = new Map<string, { count: number; expires: number }>();
function limit(request: Request) {
  const now = Date.now();
  for (const [key, value] of limits)
    if (value.expires < now) limits.delete(key);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const key = createHash('sha256').update(ip).digest('hex');
  const entry = limits.get(key) || { count: 0, expires: now + 60_000 };
  if (++entry.count > 600 || (!limits.has(key) && limits.size >= 10000))
    throw new HttpError(429, 'Please try again shortly.');
  limits.set(key, entry);
}
export async function POST(request: Request) {
  try {
    const origin = checkOrigin(request);
    limit(request);
    const body = schema.parse(await jsonBody(request, 8000));
    const context = activityContext(body.path, body.design);
    if (!context)
      throw new HttpError(400, 'Only public lookup pages can be recorded.');
    const ua = request.headers.get('user-agent') || '';
    if (/bot|crawler|spider|headless|preview|lighthouse/i.test(ua))
      return new Response(null, { status: 204 });
    let address = '',
      district = '';
    if (
      [
        'address_lookup',
        'lookup_error',
        'search_no_match',
        'district_open',
        'official_open',
      ].includes(body.type)
    ) {
      if (
        !context.agency ||
        !['Lookup', 'Embedded lookup'].includes(context.page)
      )
        throw new HttpError(400, 'An agency lookup page is required.');
      inAgency(context.agency, () => {
        if (body.type === 'address_lookup' || body.type === 'lookup_error') {
          const selected = addressById(body.addressId || '');
          if (!selected) throw new HttpError(400, 'Unknown agency address.');
          address = fullAddress(selected);
          district = locate(publicContent().map, selected) || '';
          if (body.type === 'address_lookup' && !district)
            throw new HttpError(400, 'The address has no confirmed district.');
        } else if (body.type === 'search_no_match') {
          address = cleanActivityText(body.query || '', 120);
          if (address.length < 2)
            throw new HttpError(400, 'Enter a search term.');
        } else if (body.type === 'district_open') {
          if (
            !publicContent().map.features.some(
              (f) => f.properties.district === body.target,
            )
          )
            throw new HttpError(400, 'Unknown district.');
          district = body.target;
        } else if (!publicContent().officials.some((o) => o.id === body.target))
          throw new HttpError(400, 'Unknown official.');
      });
    }
    const source = referralSource(
      body.referrer,
      new URL(origin).hostname,
      body.utmSource,
    );
    recordActivity({
      id: body.id,
      visitId: body.visitId,
      path: body.path,
      agency: context.agency,
      layout: context.layout,
      type: body.type,
      ...source,
      medium: cleanActivityText(body.medium, 80),
      campaign: cleanActivityText(body.campaign, 120),
      target: cleanActivityText(body.target),
      address,
      district,
      device: /ipad|tablet/i.test(ua)
        ? 'Tablet'
        : /mobile|iphone|android/i.test(ua)
          ? 'Phone'
          : 'Desktop / other',
    });
    return new Response(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
