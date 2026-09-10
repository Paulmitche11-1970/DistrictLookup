'use client';
import { activityContext, type ActivityType } from './activity-model';
type Visit = {
  id: string;
  touched: number;
  referrer: string;
  source: string;
  medium: string;
  campaign: string;
};
let memoryVisit: Visit | undefined;
function visit() {
  let saved = memoryVisit;
  try {
    saved =
      JSON.parse(sessionStorage.getItem('rp-lookup-visit') || 'null') || saved;
  } catch {
    /* Storage may be blocked in embeds. */
  }
  const params = new URLSearchParams(location.search);
  const explicitSource = (params.get('utm_source') || '').slice(0, 80);
  if (
    !saved ||
    Date.now() - saved.touched > 30 * 60_000 ||
    (explicitSource && explicitSource !== saved.source)
  ) {
    saved = {
      id: crypto.randomUUID(),
      touched: Date.now(),
      referrer: document.referrer.slice(0, 3000),
      source: explicitSource,
      medium: params.get('utm_medium') || '',
      campaign: params.get('utm_campaign') || '',
    };
  }
  saved.touched = Date.now();
  memoryVisit = saved;
  try {
    sessionStorage.setItem('rp-lookup-visit', JSON.stringify(saved));
  } catch {
    /* Use this tab's in-memory visit. */
  }
  return saved;
}
export function trackActivity(
  type: ActivityType,
  detail: { addressId?: string; query?: string; target?: string } = {},
) {
  try {
    const params = new URLSearchParams(location.search);
    if (
      params.get('preview') === '1' ||
      !activityContext(location.pathname, params.get('design') || undefined)
    )
      return;
    const v = visit();
    const body = JSON.stringify({
      id: crypto.randomUUID(),
      visitId: v.id,
      path: location.pathname,
      design:
        document
          .querySelector('[data-lookup-design]')
          ?.getAttribute('data-lookup-design') ||
        params.get('design') ||
        '',
      type,
      referrer: v.referrer,
      utmSource: v.source,
      medium: v.medium.slice(0, 80),
      campaign: v.campaign.slice(0, 120),
      ...detail,
    });
    void fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* Analytics must never interfere with a resident's lookup. */
  }
}
