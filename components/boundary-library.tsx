'use client';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Layers,
  Search,
} from 'lucide-react';
import { boundaryStatus, type BoundaryAgency } from '@/lib/boundary-model';
import styles from './boundary-library.module.css';

export default function BoundaryLibrary({
  agencies: boundaryAgencies,
  categories: boundaryCategories,
  importedAt: boundaryImportDate,
}: {
  agencies: BoundaryAgency[];
  categories: string[];
  importedAt: string;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [attention, setAttention] = useState(false);
  const imported = boundaryAgencies.filter((a) => a.mapAvailable).length;
  const flagged = boundaryAgencies.filter(
    (a) => a.status !== 'imported',
  ).length;
  const visible = boundaryAgencies.filter(
    (a) =>
      (category === 'all' || a.category === category) &&
      (!attention || a.status !== 'imported') &&
      `${a.name} ${a.shapefile}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a href="/admin">
          <ArrowLeft size={16} /> RP administration
        </a>
        <span>RP DATA · BOUNDARY LIBRARY</span>
      </header>
      <main className={styles.main}>
        <div className={styles.intro}>
          <span className="eyebrow">FIRST STEP: THE MAPS</span>
          <h1>Boundary library</h1>
          <p>
            School, college, and special-district boundaries from RP’s final,
            adopted, and approved map files.
          </p>
        </div>
        <div className={styles.stats}>
          <div>
            <strong>{boundaryAgencies.length}</strong>
            <span>Agency sources cataloged</span>
          </div>
          <div>
            <strong>{imported}</strong>
            <span>Maps imported for review</span>
          </div>
          <div>
            <strong>{flagged}</strong>
            <span>Sources needing attention</span>
          </div>
        </div>
        <div className={styles.process}>
          <Layers size={22} />
          <div>
            <strong>Boundaries first. Full lookup pages come next.</strong>
            <p>
              After map review: confirm current elected officials and district
              assignments, add photos and branding, then connect addresses and
              review the four layouts. Imported maps are available here for RP
              review.
            </p>
          </div>
        </div>
        <div className={styles.controls}>
          <label className={styles.search}>
            <Search size={18} />
            <span className="sr-only">Search boundary library</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search an agency or shapefile"
            />
          </label>
          <label>
            <span className="sr-only">Agency type</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">All agency types</option>
              {boundaryCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={attention}
              onChange={(e) => setAttention(e.target.checked)}
            />{' '}
            Needs attention
          </label>
        </div>
        <p className={styles.count} role="status">
          {visible.length} agencies shown · Imported{' '}
          {new Date(boundaryImportDate).toLocaleDateString('en-US', {
            timeZone: 'UTC',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
        {boundaryCategories.map((c) => {
          const rows = visible.filter((a) => a.category === c);
          if (!rows.length) return null;
          return (
            <section key={c} className={styles.section} aria-label={c}>
              <div className={styles.sectionTitle}>
                <h2>{c}</h2>
                <span>{rows.length} agencies</span>
              </div>
              <div className={styles.rows}>
                {rows.map((a) => (
                  <a
                    href={'/admin/boundaries/' + a.id}
                    className={styles.row}
                    key={a.id}
                  >
                    <div>
                      <h3>{a.name}</h3>
                      <p>{a.shapefile}</p>
                    </div>
                    <span className={styles.districtCount}>
                      {a.districts.length
                        ? `${a.districts.length} areas`
                        : 'Assignment pending'}
                    </span>
                    <span
                      className={
                        a.status === 'imported'
                          ? styles.imported
                          : styles.attention
                      }
                    >
                      {a.status === 'imported' && <CheckCircle2 size={14} />}{' '}
                      {boundaryStatus(a)}
                    </span>
                    <span className={styles.open}>
                      {a.mapAvailable ? 'View map' : 'Review source'}{' '}
                      <ArrowUpRight size={16} />
                    </span>
                  </a>
                ))}
              </div>
            </section>
          );
        })}
        {!visible.length && (
          <p className={styles.empty}>No agencies match these filters.</p>
        )}
        <p className={styles.footnote}>
          “Imported” confirms the source could be converted and its district
          polygons checked. Final-folder names do not establish that a plan is
          still the agency’s current adopted map. Existing live lookup sites
          keep their own reviewed data.
        </p>
      </main>
    </div>
  );
}
