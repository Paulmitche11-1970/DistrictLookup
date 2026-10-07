import { requireReviewAccess } from '@/lib/review-access';
import { activityFilters, audienceLabels } from '@/lib/activity-model';
import { outreachReport } from '@/lib/outreach-report';
import { implementationRequests } from '@/lib/implementation-store';
import { instances, instanceFor } from '@/lib/instances';
import { designs } from '@/lib/designs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Outreach & implementation | RP Data',
  robots: { index: false, follow: false },
};
const time = (n: number | string) =>
  new Date(n).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
const name = (id: string) => instanceFor(id)?.shortName || id;
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireReviewAccess('rp', '/admin/outreach');
  const raw = await searchParams;
  const params = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : undefined,
    ]),
  );
  const filters = activityFilters(params);
  const report = outreachReport(filters, params.staff === '1');
  const requests = implementationRequests().filter(
    (r) => !filters.agency || r.agency === filters.agency,
  );
  const agencies = instances
    .filter((a) => !filters.agency || a.id === filters.agency)
    .map((a) => ({
      ...a,
      activity: report.agencies.find((r) => r.agency === a.id),
    }))
    .sort(
      (a, b) =>
        (b.activity?.lastSeen || 0) - (a.activity?.lastSeen || 0) ||
        a.shortName.localeCompare(b.shortName),
    );
  const sum = (key: 'visits' | 'views' | 'saves') =>
    report.agencies.reduce((n, a) => n + a[key], 0);
  const logs = (agency: string, visit?: string) =>
    '/logs?' +
    new URLSearchParams({
      from: filters.from,
      to: filters.to,
      agency,
      ...(visit ? { visit } : {}),
    });
  return (
    <div className="logs-page">
      <header className="logs-header">
        <a className="rp-gallery-brand" href="/admin">
          <span>RP</span> RP Data
        </a>
        <a href="/admin">← RP administration</a>
      </header>
      <main>
        <div className="logs-title">
          <div>
            <p className="eyebrow">FROM FIRST VISIT TO LAUNCH</p>
            <h1>Outreach & implementation</h1>
            <p>
              See which agency previews get attention and follow up on requests
              to use the tool.
            </p>
          </div>
          <a className="btn" href="/logs">
            All activity logs
          </a>
        </div>
        <form method="get" className="logs-filters">
          <label className="field">
            From
            <input name="from" type="date" defaultValue={filters.from} />
          </label>
          <label className="field">
            Through
            <input name="to" type="date" defaultValue={filters.to} />
          </label>
          <label className="field">
            Agency
            <select name="agency" defaultValue={filters.agency}>
              <option value="">All agencies</option>
              {instances.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.shortName}
                </option>
              ))}
            </select>
          </label>
          <label className="implementation-check">
            <input
              type="checkbox"
              name="staff"
              value="1"
              defaultChecked={params.staff === '1'}
            />{' '}
            Include signed-in RP staff
          </label>
          <button className="btn primary">Apply / refresh</button>
        </form>
        <div className="outreach-stats">
          <div>
            <strong>{report.agencies.length}</strong>Agency previews visited
          </div>
          <div>
            <strong>{sum('visits')}</strong>Anonymous preview visits
          </div>
          <div>
            <strong>{sum('views')}</strong>Pages viewed
          </div>
          <div>
            <strong>{sum('saves')}</strong>Preview edits saved
          </div>
        </div>
        <p className="outreach-note">
          This reports preview activity, not email opens. A visit is an
          anonymous browser session, not a named person. RP staff are excluded
          by default when signed in. A shared preview password identifies the
          agency, not the individual. Names and billing contacts appear only
          after an implementation request. Historical activity before this
          update remains in the general logs as unclassified. Browser blocking
          and missing referrers can limit counts.
        </p>
        <section className="logs-panel">
          <h2>Agency interest</h2>
          <p>
            Preview activity for the selected dates. Click an agency to focus
            the report.
          </p>
          <div className="logs-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Agency</th>
                  <th>Visits / page views</th>
                  <th>Password logins</th>
                  <th>Layouts tried</th>
                  <th>Editor opens / saves</th>
                  <th>Latest visit · Pacific</th>
                  <th>Implementation</th>
                </tr>
              </thead>
              <tbody>
                {agencies.map((a) => {
                  const v = a.activity,
                    request = requests.find(
                      (r) => r.agency === a.id && r.status !== 'cancelled',
                    );
                  return (
                    <tr key={a.id}>
                      <td>
                        <a
                          href={
                            '/admin/outreach?' +
                            new URLSearchParams({
                              from: filters.from,
                              to: filters.to,
                              agency: a.id,
                              ...(params.staff === '1' ? { staff: '1' } : {}),
                            })
                          }
                        >
                          {a.shortName}
                        </a>
                      </td>
                      <td>
                        {v?.visits || 0} / {v?.views || 0}
                      </td>
                      <td>{v?.logins || 0}</td>
                      <td>
                        {v?.layouts
                          ?.split(',')
                          .map(
                            (id) =>
                              designs.find((d) => d.id === id)?.name || id,
                          )
                          .join(', ') || '—'}
                      </td>
                      <td>
                        {v?.editors || 0} / {v?.saves || 0}
                      </td>
                      <td>
                        {v ? time(v.lastSeen) : 'No recorded preview visit'}
                      </td>
                      <td>
                        {request ? (
                          <a href={'/admin/outreach/' + request.id}>
                            {request.status}
                          </a>
                        ) : (
                          'No request'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <section className="logs-panel">
          <h2>Implementation & billing queue</h2>
          <p>
            All requests for the selected agency, regardless of visit dates.
            Each confirmation creates a request and first invoice draft. Invoice
            delivery and recurring collection are handled through your billing
            system.
          </p>
          {!requests.length ? (
            <p>
              No agencies have confirmed yet. Their preview now includes a “Use
              this tool” button.
            </p>
          ) : (
            <div className="logs-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Agency / contact</th>
                    <th>Received</th>
                    <th>Layout</th>
                    <th>Implementation</th>
                    <th>Billing</th>
                    <th>Paid service no earlier than</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <a href={'/admin/outreach/' + r.id}>{name(r.agency)}</a>
                        <small>
                          {r.input.name} · {r.input.email}
                        </small>
                      </td>
                      <td>{time(r.createdAt)}</td>
                      <td>
                        {designs.find((d) => d.id === r.input.layout)?.name}
                      </td>
                      <td>{r.status}</td>
                      <td>
                        {r.billingStatus} · ${r.amountCents / 100} /{' '}
                        {r.input.frequency === 'annual' ? 'year' : 'month'}
                      </td>
                      <td>{r.billingStarts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="logs-panel">
          <h2>Pages browsed</h2>
          <p>Up to 100 pages in this date range.</p>
          <div className="logs-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Agency</th>
                  <th>Page</th>
                  <th>Views</th>
                  <th>Visits</th>
                </tr>
              </thead>
              <tbody>
                {report.pages.map((p) => (
                  <tr key={p.agency + p.path + p.layout}>
                    <td>{name(p.agency)}</td>
                    <td>
                      <a href={logs(p.agency)}>
                        {p.path}
                        {p.layout
                          ? ' · ' +
                            (designs.find((d) => d.id === p.layout)?.name ||
                              p.layout)
                          : ''}
                      </a>
                    </td>
                    <td>{p.views}</td>
                    <td>{p.visits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="logs-panel">
          <h2>Recent visits</h2>
          <p>
            Open a visit to see its pages and actions in order. Up to 50
            sessions; activity is retained for 90 days.
          </p>
          <div className="logs-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Agency / visit</th>
                  <th>First / last activity · Pacific</th>
                  <th>Source / campaign</th>
                  <th>Activity</th>
                </tr>
              </thead>
              <tbody>
                {report.sessions.map((s) => (
                  <tr key={s.agency + s.visitId}>
                    <td>
                      <a href={logs(s.agency, s.visitId)}>
                        {name(s.agency)} · {s.visitId.slice(0, 8)}
                      </a>
                      <small>
                        {s.audiences
                          .split(',')
                          .map(
                            (k) =>
                              audienceLabels[
                                k as keyof typeof audienceLabels
                              ] || k,
                          )
                          .join(', ')}
                      </small>
                    </td>
                    <td>
                      {time(s.firstSeen)}
                      <small>{time(s.lastSeen)}</small>
                    </td>
                    <td>
                      {s.sources}
                      <small>{s.campaigns}</small>
                    </td>
                    <td>
                      {s.views} pages · {s.saves} saves · {s.requests} requests
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
