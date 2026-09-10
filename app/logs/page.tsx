import {
  ArrowLeft,
  ArrowRight,
  Download,
  RefreshCw,
  Activity,
  MousePointer2,
  Search,
  Users,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { requireReviewAccess } from '@/lib/review-access';
import {
  activityFilters,
  activityLabels,
  shiftDay,
  RETENTION_DAYS,
  type ActivityFilters,
} from '@/lib/activity-model';
import { activityReport } from '@/lib/activity-store';
import { instanceFor, instances } from '@/lib/instances';
import { designs } from '@/lib/designs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = {
  title: 'Activity logs | RP Data',
  robots: { index: false, follow: false },
};
const count = (value: number) => value.toLocaleString('en-US');
const time = (value: number | string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
const agencyName = (id: string) =>
  instanceFor(id)?.shortName || 'Agency directory';
const layoutName = (id: string) =>
  designs.find((d) => d.id === id)?.name ||
  (id === 'default' ? 'Agency default' : '—');
function filterUrl(
  filters: ActivityFilters,
  changes: Partial<ActivityFilters> = {},
  pathname = '/logs',
) {
  const merged = { ...filters, ...changes };
  const params = new URLSearchParams();
  Object.entries(merged).forEach(([key, value]) => {
    if (value && !(key === 'page' && value === 1))
      params.set(key, String(value));
  });
  return pathname + '?' + params;
}
export default async function Logs({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireReviewAccess('rp', '/logs');
  const raw = await searchParams;
  const filters = activityFilters(
    Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [
        k,
        typeof v === 'string' ? v : undefined,
      ]),
    ),
  );
  const report = activityReport(filters);
  const { summary } = report;
  const daily = [];
  for (let day = filters.from; day <= filters.to; day = shiftDay(day, 1))
    daily.push(
      report.daily.find((d) => d.day === day) || { day, views: 0, lookups: 0 },
    );
  const max = Math.max(1, ...daily.map((d) => Math.max(d.views, d.lookups)));
  const pages = Math.max(1, Math.ceil(summary.events / 50));
  return (
    <div className="logs-page">
      <header className="logs-header">
        <a href="/" className="rp-gallery-brand">
          <span>RP</span> RP Data
        </a>
        <div>
          <ShieldCheck size={17} /> RP team access{' '}
          <a href="/">
            <ArrowLeft size={16} /> Agency workspace
          </a>
        </div>
      </header>
      <main>
        <div className="logs-title">
          <div>
            <p className="eyebrow">LOOKUP ACTIVITY</p>
            <h1>Activity logs</h1>
            <p>
              See where residents arrive, what they explore, and which addresses
              they look up.
            </p>
          </div>
          <div className="logs-actions">
            <a className="btn" href={filterUrl(filters)}>
              <RefreshCw size={16} /> Refresh
            </a>
            <a
              className="btn primary"
              href={filterUrl(filters, {}, '/logs/export')}
            >
              <Download size={16} /> Export CSV
            </a>
          </div>
        </div>
        <form className="logs-filters" action="/logs" method="get">
          <label className="field">
            From
            <input
              type="date"
              name="from"
              defaultValue={filters.from}
              required
            />
          </label>
          <label className="field">
            Through
            <input type="date" name="to" defaultValue={filters.to} required />
          </label>
          <label className="field">
            Agency
            <select name="agency" defaultValue={filters.agency}>
              <option value="">All agencies</option>
              <option value="directory">Agency directory</option>
              {instances.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.shortName}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Activity
            <select name="type" defaultValue={filters.type}>
              <option value="">All activity</option>
              {Object.entries(activityLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Source
            <select name="source" defaultValue={filters.source}>
              <option value="">All sources</option>
              {report.sourceOptions.map((s) => (
                <option key={s.source} value={s.source}>
                  {s.source}
                </option>
              ))}
            </select>
          </label>
          <label className="field logs-search">
            Address or action
            <input
              name="query"
              defaultValue={filters.query}
              maxLength={100}
              placeholder="Search the activity log…"
            />
          </label>
          <button className="btn primary" type="submit">
            Apply filters
          </button>
          <a href="/logs" className="logs-reset">
            Reset
          </a>
        </form>
        <div className="logs-range">
          <span>
            Dates and times are Pacific · Last {RETENTION_DAYS} days retained
          </span>
          <span>Tracking enabled {time(report.startedAt)}</span>
        </div>
        <section className="logs-stats" aria-label="Activity totals">
          {[
            { label: 'Page views', value: summary.pageViews, icon: Eye },
            { label: 'Visits', value: summary.visits, icon: Users },
            { label: 'Address lookups', value: summary.lookups, icon: Search },
            {
              label: 'Clicks & map actions',
              value: summary.clicks,
              icon: MousePointer2,
            },
          ].map((m) => (
            <article key={m.label}>
              <m.icon size={21} />
              <p>{m.label}</p>
              <strong>{count(m.value)}</strong>
            </article>
          ))}
        </section>
        {!summary.events && (
          <div className="logs-empty">
            <Activity size={28} />
            <h2>No activity in this view yet</h2>
            <p>
              Open an agency lookup page and try an address. Refresh here to see
              the visit and lookup, or adjust your filters.
            </p>
          </div>
        )}
        <section className="logs-panel logs-trend" aria-label="Daily activity">
          <div className="logs-panel-title">
            <h2>Activity over time</h2>
            <div className="logs-legend">
              <span>
                <i /> Page views
              </span>
              <span>
                <i /> Address lookups
              </span>
            </div>
          </div>
          <div
            className="logs-bars"
            role="img"
            aria-label={`Daily activity from ${filters.from} through ${filters.to}. ${summary.pageViews} page views and ${summary.lookups} address lookups. Each bar has daily counts.`}
          >
            {daily.map((d) => (
              <div
                key={d.day}
                className="logs-bar-day"
                aria-label={`${d.day}: ${d.views} views, ${d.lookups} lookups`}
                title={`${d.day}: ${d.views} views · ${d.lookups} lookups`}
              >
                <i
                  style={{
                    height:
                      Math.max(d.views ? 2 : 0, (d.views / max) * 100) + '%',
                  }}
                />
                <i
                  style={{
                    height:
                      Math.max(d.lookups ? 2 : 0, (d.lookups / max) * 100) +
                      '%',
                  }}
                />
              </div>
            ))}
          </div>
          <div className="logs-chart-dates">
            <span>{filters.from}</span>
            <span>{filters.to}</span>
          </div>
        </section>
        <div className="logs-breakdowns">
          <section className="logs-panel">
            <h2>Agencies being viewed</h2>
            <div className="logs-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Agency</th>
                    <th>Views</th>
                    <th>Lookups</th>
                  </tr>
                </thead>
                <tbody>
                  {report.agencies.map((a) => (
                    <tr key={a.agency}>
                      <td>
                        <a
                          href={filterUrl(filters, {
                            agency: a.agency || 'directory',
                            page: 1,
                          })}
                        >
                          {agencyName(a.agency)}
                        </a>
                      </td>
                      <td>{count(a.views)}</td>
                      <td>{count(a.lookups)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="logs-panel">
            <h2>Where visits come from</h2>
            <div className="logs-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Visits</th>
                    <th>Lookups</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sources.map((s) => (
                    <tr key={s.source}>
                      <td>
                        <a
                          href={filterUrl(filters, {
                            source: s.source,
                            page: 1,
                          })}
                        >
                          {s.source}
                        </a>
                      </td>
                      <td>{count(s.visits)}</td>
                      <td>{count(s.lookups)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="logs-note">
              Referral host or campaign source from the start of the visit.
              Embedded pages can report the agency website. Referrers withheld
              by the browser appear as Direct / unknown.
            </p>
          </section>
          <section className="logs-panel">
            <h2>Layouts</h2>
            <div className="logs-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Layout</th>
                    <th>Views</th>
                    <th>Lookups</th>
                  </tr>
                </thead>
                <tbody>
                  {report.layouts.map((d) => (
                    <tr key={d.layout}>
                      <td>{layoutName(d.layout)}</td>
                      <td>{count(d.views)}</td>
                      <td>{count(d.lookups)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="logs-panel">
            <h2>What people do</h2>
            <div className="logs-event-list">
              {report.actions.map((a) => (
                <a
                  key={a.type}
                  href={filterUrl(filters, { type: a.type, page: 1 })}
                >
                  <span>{activityLabels[a.type]}</span>
                  <strong>{count(a.count)}</strong>
                </a>
              ))}
            </div>
          </section>
        </div>
        <section className="logs-panel logs-events">
          <div className="logs-panel-title">
            <div>
              <h2>Recent activity</h2>
              <p>
                {count(summary.events)} events match these filters ·{' '}
                {count(summary.unsuccessful)} searches or lookups without a
                result
              </p>
            </div>
            <span>Newest first</span>
          </div>
          <div className="logs-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time · Pacific</th>
                  <th>Agency / layout</th>
                  <th>Activity</th>
                  <th>Address or action</th>
                  <th>Source</th>
                  <th>Device</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="logs-time">{time(r.createdAt)}</td>
                    <td>
                      <strong>{agencyName(r.agency)}</strong>
                      <small>
                        {layoutName(r.layout)} · {r.path}
                      </small>
                    </td>
                    <td>
                      <span className={'logs-type type-' + r.type}>
                        {activityLabels[r.type]}
                      </span>
                    </td>
                    <td className="logs-detail">
                      {r.address || r.target || '—'}
                      {r.district && <small>District {r.district}</small>}
                    </td>
                    <td>
                      {r.source}
                      {r.campaign && <small>Campaign: {r.campaign}</small>}
                      {r.medium && <small>Medium: {r.medium}</small>}
                    </td>
                    <td>{r.device}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="logs-pagination">
            <span>
              Page {filters.page} of {pages} · 50 events per page
            </span>
            <div>
              {filters.page > 1 && (
                <a
                  className="btn"
                  href={filterUrl(filters, { page: filters.page - 1 })}
                >
                  <ArrowLeft size={15} /> Previous
                </a>
              )}
              {filters.page < pages && (
                <a
                  className="btn"
                  href={filterUrl(filters, { page: filters.page + 1 })}
                >
                  Next <ArrowRight size={15} />
                </a>
              )}
            </div>
          </div>
        </section>
        <footer className="logs-method">
          <strong>How to read this dashboard</strong>
          <p>
            A visit is an anonymous browser session that expires after 30
            minutes of inactivity; it is not a count of individual people.
            Address lookups record the selected address and confirmed district.
            A search with no matches records the text after a two-second pause.
            Admin screens and draft previews are excluded. Known crawler traffic
            is filtered, but browser blocking can reduce counts.
          </p>
          <p>
            RP team access only. Addresses are stored for {RETENTION_DAYS} days.
            No IP addresses, passwords, or administrator form contents are
            stored in these logs. CSV exports include up to 10,000 matching
            events, newest first.
          </p>
        </footer>
      </main>
    </div>
  );
}
