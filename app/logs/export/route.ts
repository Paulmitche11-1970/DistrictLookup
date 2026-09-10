import { hasReviewAccess } from '@/lib/review-access';
import { activityFilters, activityLabels, csvCell } from '@/lib/activity-model';
import { activityRows } from '@/lib/activity-store';
import { instanceFor } from '@/lib/instances';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  if (!(await hasReviewAccess('rp')))
    return Response.json(
      { error: 'RP team sign-in required.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  const filters = activityFilters(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  const rows = activityRows(filters, 10000, 0);
  const csv = [
    [
      'Time (UTC)',
      'Agency',
      'Layout',
      'Page',
      'Activity',
      'Address / search',
      'District',
      'Action',
      'Source',
      'Referral host',
      'Medium',
      'Campaign',
      'Device',
    ],
    ...rows.map((r) => [
      new Date(r.createdAt).toISOString(),
      instanceFor(r.agency)?.shortName || 'Agency directory',
      r.layout,
      r.path,
      activityLabels[r.type],
      r.address,
      r.district,
      r.target,
      r.source,
      r.referrerHost,
      r.medium,
      r.campaign,
      r.device,
    ]),
  ]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
  return new Response('\uFEFF' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="lookup-activity-${filters.from}-${filters.to}.csv"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
