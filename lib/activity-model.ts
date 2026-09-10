import { instanceFor } from './instances';
import { designs } from './designs';

export const activityLabels = {
  page_view: 'Page view',
  address_lookup: 'Address lookup',
  search_no_match: 'Search with no matches',
  lookup_error: 'Lookup error',
  district_open: 'District opened',
  official_open: 'Official opened',
  biography_click: 'Biography clicked',
  email_click: 'Email clicked',
  phone_click: 'Phone clicked',
  website_click: 'Website clicked',
  navigation_click: 'Page link clicked',
  map_control: 'Map control used',
} as const;
export type ActivityType = keyof typeof activityLabels;
export const RETENTION_DAYS = 90;
export function activityContext(path: string, design?: string) {
  if (path === '/') return { agency: '', layout: '', page: 'Agency directory' };
  if (path === '/embed')
    return {
      agency: 'martinez',
      layout: designs.some((d) => d.id === design) ? design! : 'default',
      page: 'Embedded lookup',
    };
  const parts = path.split('/').filter(Boolean);
  const agency = instanceFor(parts[0] || '');
  if (!agency) return null;
  if (parts.length === 1)
    return { agency: agency.id, layout: '', page: 'Design gallery' };
  if (
    parts.length === 3 &&
    parts[1] === 'officials' &&
    /^[a-zA-Z0-9_-]{1,30}$/.test(parts[2])
  )
    return {
      agency: agency.id,
      layout: designs.some((d) => d.id === design) ? design! : '',
      page: 'Biography',
    };
  if (parts.length !== 2) return null;
  const layout = parts[1] === 'council' ? 'directory' : parts[1];
  if (designs.some((d) => d.id === layout))
    return { agency: agency.id, layout, page: 'Lookup' };
  if (['lookup', 'embed'].includes(layout))
    return {
      agency: agency.id,
      layout: designs.some((d) => d.id === design) ? design! : 'default',
      page: layout === 'embed' ? 'Embedded lookup' : 'Lookup',
    };
  return null;
}
export const cleanActivityText = (value: string, max = 160) =>
  value
    // Control characters are intentionally removed from untrusted event labels.
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim()
    .slice(0, max);
export function referralSource(
  referrer: string,
  currentHost: string,
  utmSource = '',
) {
  let host = '';
  try {
    const url = new URL(referrer);
    if (['https:', 'http:'].includes(url.protocol))
      host = url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    /* No usable referrer is normal. */
  }
  const ownHosts = [
    'wheresmydistrict.com',
    'district-lookup-production.up.railway.app',
    currentHost.replace(/^www\./, ''),
  ];
  if (ownHosts.includes(host)) host = '';
  const campaign = cleanActivityText(utmSource, 80);
  if (campaign) return { source: 'Campaign: ' + campaign, referrerHost: host };
  const sources: [RegExp, string][] = [
    [/(^|\.)google\.(com|ca|co\.uk|com\.au|de|fr|es|co\.in)$/, 'Google'],
    [/(^|\.)bing\.com$/, 'Bing'],
    [/(^|\.)search\.yahoo\.com$/, 'Yahoo'],
    [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
    [
      /(^|\.)(facebook\.com|instagram\.com|linkedin\.com|t\.co|x\.com)$/,
      'Social media',
    ],
  ];
  return {
    source:
      sources.find(([re]) => re.test(host))?.[1] ||
      (host ? 'Website: ' + host : 'Direct / unknown'),
    referrerHost: host,
  };
}
export function pacificDay(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return ['year', 'month', 'day']
    .map((k) => p.find((v) => v.type === k)!.value)
    .join('-');
}
export function shiftDay(day: string, amount: number) {
  const date = new Date(day + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
function validDay(value?: string) {
  if (!value || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return (
    Number.isFinite(date.getTime()) && date.toISOString().startsWith(value)
  );
}
export type ActivityFilters = {
  from: string;
  to: string;
  agency: string;
  type: string;
  source: string;
  query: string;
  page: number;
};
export function activityFilters(
  params: Record<string, string | undefined>,
  today = pacificDay(),
): ActivityFilters {
  const oldest = shiftDay(today, -RETENTION_DAYS + 1);
  let from = validDay(params.from) ? params.from! : shiftDay(today, -29);
  let to = validDay(params.to) ? params.to! : today;
  from = from < oldest ? oldest : from > today ? today : from;
  to = to > today ? today : to < from ? from : to;
  return {
    from,
    to,
    agency:
      params.agency === 'directory' || instanceFor(params.agency || '')
        ? params.agency!
        : '',
    type:
      params.type && Object.hasOwn(activityLabels, params.type)
        ? params.type
        : '',
    source: cleanActivityText(params.source || '', 200),
    query: cleanActivityText(params.query || '', 100),
    page: Math.min(
      10000,
      Math.max(1, Number.parseInt(params.page || '1') || 1),
    ),
  };
}
export function csvCell(value: string | number | null | undefined) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
