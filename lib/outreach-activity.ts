import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { hasReviewAccess } from './review-access';
import { recordActivity } from './activity-store';
import { serverActivityTypes } from './activity-model';

const attribution = z.object({
  id: z.uuid(),
  touched: z.number(),
  source: z.string().max(200),
  referrerHost: z.string().max(250),
  medium: z.string().max(80),
  campaign: z.string().max(120),
});
/** Only called after a real authenticated action succeeds. Never records form contents. */
export async function recordPreviewAction(
  agency: string,
  type: (typeof serverActivityTypes)[number],
  target = '',
) {
  try {
    let visit;
    try {
      const raw = (await cookies()).get('rp_activity_context')?.value;
      const parsed = attribution.safeParse(
        JSON.parse(decodeURIComponent(raw || 'null')),
      );
      if (
        parsed.success &&
        Math.abs(Date.now() - parsed.data.touched) < 30 * 60_000
      )
        visit = parsed.data;
    } catch {
      /* Direct requests may not have browser attribution. */
    }
    recordActivity({
      id: randomUUID(),
      visitId: visit?.id || randomUUID(),
      agency,
      layout: '',
      path:
        '/' +
        agency +
        (type === 'implementation_request'
          ? '/implementation'
          : type === 'preview_login'
            ? ''
            : '/administration'),
      type,
      target,
      source: visit?.source || 'Direct / unknown',
      referrerHost: visit?.referrerHost || '',
      medium: visit?.medium || '',
      campaign: visit?.campaign || '',
      address: '',
      district: '',
      device: 'Confirmed server action',
      audience: (await hasReviewAccess('rp')) ? 'rp_staff' : 'agency_preview',
    });
  } catch {
    // A reporting failure must not undo a saved preview or confirmed request.
    console.error('Could not record agency preview activity.');
  }
}
