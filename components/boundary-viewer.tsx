'use client';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, FileCheck2, Info } from 'lucide-react';
import DistrictMapView from './district-map';
import { boundaryStatus, type BoundaryAgency } from '@/lib/boundary-model';
import type { DistrictMap } from '@/lib/model';
import { colorFor } from '@/lib/model';
import styles from './boundary-library.module.css';

export default function BoundaryViewer({
  agency,
  geo,
}: {
  agency: BoundaryAgency;
  geo: DistrictMap | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const label =
    agency.category === 'Special districts' ? 'District' : 'Trustee Area';
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a href="/admin/boundaries">
          <ArrowLeft size={16} /> Boundary library
        </a>
        <a href="/admin">
          RP administration <ArrowRight size={16} />
        </a>
      </header>
      <main className={styles.viewer}>
        <aside className={styles.sidebar}>
          <span className="eyebrow">{agency.category}</span>
          <h1>{agency.name}</h1>
          <span
            className={
              agency.status === 'imported' ? styles.imported : styles.attention
            }
          >
            {boundaryStatus(agency)}
          </span>
          <p className={styles.lede}>
            {geo
              ? `${agency.districts.length} assigned areas. Select one to inspect its boundary, or switch between street and satellite views.`
              : 'This source is cataloged. Its district assignments need review before a map can be shown.'}
          </p>
          {geo && (
            <div className={styles.areas} aria-label="District selection">
              <button
                aria-pressed={!selected}
                onClick={() => setSelected(null)}
              >
                All areas
              </button>
              {agency.districts.map((d) => (
                <button
                  key={d}
                  aria-pressed={selected === d}
                  onClick={() => setSelected(d)}
                >
                  <i style={{ background: colorFor(d) }} />
                  {label} {d}
                </button>
              ))}
            </div>
          )}
          {selected && (
            <p className={styles.selection} role="status">
              Viewing {label.toLowerCase()} {selected}
            </p>
          )}
          {agency.warnings.length > 0 && (
            <div className={styles.reviewNotes}>
              <h2>
                <Info size={18} /> Import notes
              </h2>
              <ul>
                {agency.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <div className={styles.next}>
            <h2>
              <FileCheck2 size={19} /> Next steps
            </h2>
            <ol>
              <li>Confirm current adoption and resolve map notes.</li>
              <li>Verify the elected officials and district assignments.</li>
              <li>Add portraits, logo, and local addresses.</li>
              <li>Review the four lookup layouts.</li>
            </ol>
          </div>
          <details className={styles.source}>
            <summary>Source and geometry details</summary>
            <dl>
              <dt>Shapefile</dt>
              <dd>{agency.shapefile}</dd>
              <dt>RP source folder</dt>
              <dd>{agency.source}</dd>
              <dt>District assignment field</dt>
              <dd>{agency.districtField || 'Needs confirmation'}</dd>
              <dt>Source features / excluded blank assignments</dt>
              <dd>
                {agency.sourceRecords} / {agency.excludedRecords}
              </dd>
              <dt>Source coordinate system</dt>
              <dd>{agency.sourceCrs || 'Pending'}</dd>
              <dt>Source selection</dt>
              <dd>{agency.selectionNote}</dd>
            </dl>
            {!!agency.overlaps?.length && (
              <>
                <h3>Measured overlaps</h3>
                <ul>
                  {agency.overlaps.map((o) => (
                    <li key={o.districts.join('-')}>
                      {o.districts.join(' / ')}:{' '}
                      {o.squareMeters.toLocaleString()} m²
                    </li>
                  ))}
                </ul>
              </>
            )}
            {agency.parts && (
              <p className="small muted">
                Separate polygon pieces are retained from the source; they are
                not separate districts.
              </p>
            )}
          </details>
        </aside>
        <div className={styles.mapFrame}>
          {geo ? (
            <DistrictMapView
              geo={geo}
              selected={selected}
              onSelect={setSelected}
              address={null}
              districtLabel={label}
            />
          ) : (
            <div className={styles.mapEmpty}>
              <Info size={36} />
              <h2>Source review needed</h2>
              <p>{agency.warnings[0]}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
