'use client';

import { useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Building2,
  LayoutGrid,
  Layers,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { instances, adminPath } from '@/lib/instances';
import { agencyLabels } from '@/lib/agency-labels';
import styles from './agency-administration.module.css';

export default function AgencyAdministration({
  team = false,
}: {
  team?: boolean;
}) {
  const [query, setQuery] = useState('');
  const available = instances.filter((agency) => team || !agency.sandbox);
  const agencies = available
    .filter((agency) =>
      `${agency.name} ${agency.shortName}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => {
      const priority = (id: string) =>
        id === 'martinez' ? 0 : id === 'arpeeville' ? 1 : 2;
      return (
        priority(a.id) - priority(b.id) ||
        a.shortName.localeCompare(b.shortName)
      );
    });
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a href={team ? '/' : '/admin/agencies'} className="rp-gallery-brand">
          <span>RP</span> RP Data
        </a>
        <a href={team ? '/' : '/admin'}>
          {team ? 'All lookup sites' : 'RP team sign in'}{' '}
          <ArrowUpRight size={16} />
        </a>
      </header>
      <main className={styles.main}>
        <div className={styles.intro}>
          <span className="eyebrow">
            {team ? 'RP DATA WORKSPACE' : 'AGENCY ACCESS'}
          </span>
          <h1>{team ? 'RP administration' : 'Agency administration'}</h1>
          <p>
            {team
              ? 'Choose an agency to manage, review its designs, or open site activity.'
              : 'Choose your agency to sign in with its administrator account.'}
          </p>
        </div>
        {team && (
          <nav className={styles.tools} aria-label="RP administration tools">
            <a href="/admin/boundaries">
              <Layers size={24} />
              <div>
                <h2>Boundary library</h2>
                <p>
                  Review imported school, college, and special-district maps.
                </p>
              </div>
              <ArrowUpRight size={20} />
            </a>
            <a href="/logs">
              <Activity size={24} />
              <div>
                <h2>Activity logs</h2>
                <p>
                  Page visits, address searches, clicks, and referral sources.
                </p>
              </div>
              <ArrowUpRight size={20} />
            </a>
            <a href="/">
              <LayoutGrid size={24} />
              <div>
                <h2>Agency designs</h2>
                <p>Compare layouts and see which sites are in progress.</p>
              </div>
              <ArrowUpRight size={20} />
            </a>
          </nav>
        )}
        <section aria-labelledby="agency-access-heading">
          <div className={styles.controls}>
            <div>
              <h2 id="agency-access-heading">
                {team ? 'Agency workspaces' : 'Find your agency'}
              </h2>
              <p className="small muted">
                {available.length} agencies available
              </p>
            </div>
            <label className={styles.search}>
              <Search size={18} />
              <span className="sr-only">Search agencies</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search agencies"
              />
            </label>
          </div>
          {team && (
            <p className={styles.accessNote}>
              <ShieldCheck size={17} /> Client administration uses the agency’s
              own account and verification code. Arpeeville editing uses RP team
              access.
            </p>
          )}
          <div className={styles.grid}>
            {agencies.map((agency) => {
              const labels = agencyLabels(agency);
              return (
                <article className={styles.card} key={agency.id}>
                  <div className={styles.brand}>
                    {agency.logo ? (
                      <img src={agency.logo} alt={agency.name} />
                    ) : (
                      <Building2 size={36} aria-hidden="true" />
                    )}
                  </div>
                  <h3>{agency.name}</h3>
                  <p className="small muted">
                    {agency.districtCount
                      ? `${agency.districtCount} ${labels.districtsLower}`
                      : '4 lookup designs'}
                  </p>
                  <a
                    className="btn primary"
                    href={
                      agency.sandbox
                        ? '/arpeeville/administration'
                        : adminPath(agency.id)
                    }
                  >
                    {agency.sandbox
                      ? 'Edit Arpeeville'
                      : team
                        ? 'Open agency admin'
                        : 'Sign in'}{' '}
                    <ArrowUpRight size={16} />
                  </a>
                  {team && (
                    <div className={styles.links}>
                      {!agency.sandbox && (
                        <a href={'/' + agency.id + '/administration'}>
                          Preview administration
                        </a>
                      )}
                      <a href={'/' + agency.id}>View designs</a>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {!agencies.length && (
            <p className={styles.empty} role="status">
              No agencies match “{query}”. Try another name.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
