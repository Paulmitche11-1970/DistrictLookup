'use client';
import { useState } from 'react';
import {
  ArrowRight,
  Building2,
  Landmark,
  GraduationCap,
  School,
  Waves,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type { Content } from '@/lib/model';
import clientAgencies from '@/data/agency-directory.json';
const categories = [
  { id: 'cities', name: 'Cities', icon: Building2 },
  { id: 'counties', name: 'Counties', icon: Landmark },
  {
    id: 'schools',
    name: 'School districts & boards of education',
    icon: School,
  },
  { id: 'colleges', name: 'Community college districts', icon: GraduationCap },
  { id: 'special', name: 'Special districts', icon: Waves },
];
const statuses = [
  { id: 'in-progress', name: 'In progress' },
  { id: 'ready', name: 'Ready' },
  { id: 'claimed', name: 'Claimed' },
  { id: 'paid', name: 'Paid' },
];
export default function InstanceDirectory({ content }: { content: Content }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const visible = clientAgencies.filter(
    (a) =>
      (status === 'all' || a.status === status) &&
      a.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="instance-directory">
      <header className="instances-header">
        <a href="/" className="rp-gallery-brand">
          <span>RP</span> RP Data
        </a>
        <nav aria-label="Site navigation">
          <span className="small muted">Internal team workspace</span>
          <a href="/admin">
            RP administration <ArrowRight size={15} />
          </a>
        </nav>
      </header>
      <main className="instances-main">
        <div className="instances-intro">
          <span className="eyebrow">RP DATA</span>
          <h1>RP Data Voter Lookup Instances</h1>
          <p>Your agencies, from first draft to launch.</p>
        </div>
        <div className="directory-controls">
          <label className="directory-search">
            <Search size={18} />
            <span className="sr-only">Search agencies</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find an agency…"
            />
          </label>
          <div className="directory-statuses" aria-label="Filter by status">
            <button
              aria-pressed={status === 'all'}
              onClick={() => setStatus('all')}
            >
              All <small>{clientAgencies.length}</small>
            </button>
            {statuses.map((s) => (
              <button
                key={s.id}
                aria-pressed={status === s.id}
                onClick={() => setStatus(s.id)}
              >
                {s.name}{' '}
                <small>
                  {clientAgencies.filter((a) => a.status === s.id).length}
                </small>
              </button>
            ))}
          </div>
        </div>
        <nav className="instance-types" aria-label="Agency types">
          {categories.map((c) => (
            <a href={'#' + c.id} key={c.id}>
              <c.icon size={17} />
              {c.name}
              <small>
                {clientAgencies.filter((a) => a.type === c.id).length}
              </small>
            </a>
          ))}
        </nav>
        {!visible.length && (
          <p className="directory-no-results" role="status">
            No agencies match this search and status.
          </p>
        )}
        {categories.map((c) => {
          const rows = visible
            .filter((a) => a.type === c.id)
            .sort((a, b) => a.name.localeCompare(b.name));
          return (
            <section
              className="instance-section"
              id={c.id}
              key={c.id}
              aria-labelledby={c.id + '-heading'}
            >
              <div className="instance-section-title">
                <c.icon size={21} />
                <h2 id={c.id + '-heading'}>{c.name}</h2>
                <span>{rows.length} agencies</span>
              </div>
              <div className="agency-card-grid">
                {rows.map((a) => {
                  const built = a.id === 'martinez';
                  const name =
                    a.type === 'cities' && a.name !== 'New York City'
                      ? 'City of ' + a.name
                      : a.name;
                  const body = (
                    <>
                      <div
                        className={
                          a.logoDark
                            ? 'compact-agency-brand dark-brand'
                            : 'compact-agency-brand'
                        }
                      >
                        {a.logo ? (
                          <img src={a.logo} alt={name} />
                        ) : (
                          <span
                            className="agency-initials"
                            aria-label="Agency logo pending"
                          >
                            {a.name
                              .split(' ')
                              .slice(0, 2)
                              .map((x) => x[0])
                              .join('')}
                          </span>
                        )}
                      </div>
                      <h3>{name}</h3>
                      <p className="agency-card-meta">
                        {a.state}
                        {built
                          ? ' · ' +
                            content.map.features.length +
                            ' districts · ' +
                            content.officials.filter((o) => o.district !== null)
                              .length +
                            ' councilmembers'
                          : ''}
                      </p>
                      <span className="agency-build-note">
                        {built
                          ? '4 designs · Review workspace'
                          : 'Lookup preparation pending'}
                      </span>
                    </>
                  );
                  return (
                    <article className="compact-agency-card" key={a.id}>
                      {built ? (
                        <a href="/martinez" className="compact-agency-main">
                          {body}
                          <ArrowRight className="card-open-arrow" size={16} />
                        </a>
                      ) : (
                        <div className="compact-agency-main">{body}</div>
                      )}
                      <div className="agency-card-bottom">
                        {built ? (
                          <a href="/admin">
                            <ShieldCheck size={13} /> RP admin
                          </a>
                        ) : (
                          <span className="admin-pending">
                            RP admin · Pending
                          </span>
                        )}
                        <span className={'agency-status status-' + a.status}>
                          {statuses.find((s) => s.id === a.status)?.name}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
              {!rows.length && (
                <div className="instance-empty">
                  {clientAgencies.some((a) => a.type === c.id)
                    ? 'No agencies match the selected filters.'
                    : 'Agency inventory will be added here.'}
                </div>
              )}
            </section>
          );
        })}
        <footer className="instances-footer">
          <span>RP Data · Agency workspace</span>
          <span>
            Martinez is in design review. Other listed agencies are queued.
          </span>
        </footer>
      </main>
    </div>
  );
}
