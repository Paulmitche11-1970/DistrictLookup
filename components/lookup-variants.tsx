'use client';
import { useEffect, useRef } from 'react';
import { ArrowRight, Compass, MapPin } from 'lucide-react';
import type { Content } from '@/lib/model';
import { colorFor } from '@/lib/model';
import type { DesignId } from '@/lib/designs';
import DistrictMapView from './district-map';
import { LookupHeader } from './lookup-header';
import {
  AddressSearch,
  CouncilList,
  LookupFooter,
  Portrait,
  RepresentativeResult,
  useDistrictLookup,
} from './lookup-shared';

export default function LookupVariant({
  content,
  design,
  embedded = false,
  preview = false,
}: {
  content: Content;
  design: Exclude<DesignId, 'classic'>;
  embedded?: boolean;
  preview?: boolean;
}) {
  const lookup = useDistrictLookup(content, preview);
  const answer = useRef<HTMLDivElement>(null);
  const officials = content.officials.filter(
    (official) => official.district !== null,
  );
  useEffect(() => {
    if (lookup.selected && (design === 'directory' || design === 'concierge')) {
      answer.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      answer.current?.focus({ preventScroll: true });
    }
  }, [lookup.selected, lookup.address?.id, design]);
  const map = (
    <DistrictMapView
      geo={content.map}
      selected={lookup.selected}
      onSelect={lookup.selectDistrict}
      address={lookup.address}
      insetLeft={design === 'explorer' ? 370 : 0}
    />
  );
  const result = <RepresentativeResult content={content} lookup={lookup} />;
  const search = <AddressSearch lookup={lookup} />;

  return (
    <div
      className={`design-page design-${design} ${lookup.selected ? 'has-result' : ''} ${embedded ? 'embedded' : ''}`}
      style={{ '--primary': content.agency.accent } as React.CSSProperties}
    >
      <a className="skip-link" href="#address-search">
        Skip to address search
      </a>
      <LookupHeader
        content={content}
        design={design}
        embedded={embedded}
        preview={preview}
      />

      {design === 'concierge' && (
        <main className="concierge-main">
          <div className="concierge-intro">
            <h1>
              Your address. <em>Your district.</em>
            </h1>
            <p>{lookup.intro}</p>
          </div>
          <div className="concierge-workspace">
            <section
              className="concierge-card"
              aria-label="Find your elected representative"
              ref={answer}
              tabIndex={-1}
            >
              {search}
              {lookup.selected ? (
                result
              ) : (
                <div className="concierge-explainer">
                  <MapPin size={21} />
                  <p>
                    Your address connects you to one of{' '}
                    {content.agency.shortName}’s {content.map.features.length}{' '}
                    council districts. Your councilmember’s details will appear
                    here.
                  </p>
                </div>
              )}
            </section>
            <section className="concierge-map" aria-label="District map">
              {map}
            </section>
          </div>
          <section
            className="concierge-roster"
            aria-label="Browse council districts"
          >
            <div className="concierge-roster-label">Or browse your council</div>
            <div className="concierge-roster-items">
              {officials.map((official) => (
                <button
                  key={official.id}
                  onClick={() => lookup.selectDistrict(official.district!)}
                  aria-pressed={lookup.selected === official.district}
                >
                  {content.agency.showPhotos && (
                    <Portrait official={official} className="avatar" />
                  )}
                  <span>
                    <small>District {official.district}</small>
                    <strong>
                      {official.vacant ? 'Vacant seat' : official.name}
                    </strong>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
          </section>
          <LookupFooter content={content} />
        </main>
      )}

      {design === 'explorer' && (
        <main className="explorer-main">
          <section
            className="explorer-toolbar"
            aria-label="Find your elected representative"
          >
            <div className="explorer-title">
              <span className="explorer-symbol">
                <Compass size={24} />
              </span>
              <div>
                <span className="eyebrow">
                  Explore {content.agency.shortName}
                </span>
                <h1>Find your district.</h1>
              </div>
            </div>
          </section>
          <div className="explorer-workspace">
            {map}
            <aside className="explorer-answer" aria-label="District details">
              <div className="explorer-search">{search}</div>
              {lookup.selected ? (
                result
              ) : (
                <>
                  <span className="eyebrow">
                    A city. {content.map.features.length} districts.
                  </span>
                  <h2>Where do you fit in?</h2>
                  <p>
                    Search your address for your councilmember, or choose a
                    district to explore.
                  </p>
                  <CouncilList content={content} lookup={lookup} />
                </>
              )}
            </aside>
          </div>
          <LookupFooter content={content} />
        </main>
      )}

      {design === 'directory' && (
        <main className="council-main">
          <section
            className="council-masthead"
            aria-label="Find your elected representative"
          >
            <div className="council-heading">
              <span className="eyebrow">Local government. Real people.</span>
              <h1>
                Meet your
                <br />
                <em>City Council.</em>
              </h1>
              <p>{lookup.intro}</p>
            </div>
            <div className="council-search">
              <span className="council-search-caption">
                <MapPin size={18} /> Find your district
              </span>
              {search}
              {lookup.selected && (
                <button className="council-search-reset" onClick={lookup.clear}>
                  Search for an address <ArrowRight size={16} />
                </button>
              )}
            </div>
          </section>
          <section
            className="council-portraits"
            aria-label="Councilmembers by district"
          >
            {officials.map((official) => (
              <button
                className="council-person"
                key={official.id}
                onClick={() => lookup.selectDistrict(official.district!)}
                aria-pressed={lookup.selected === official.district}
                style={
                  {
                    '--district-color': colorFor(official.district!),
                  } as React.CSSProperties
                }
              >
                <div className="council-photo-wrap">
                  {content.agency.showPhotos ? (
                    <Portrait official={official} className="council-photo" />
                  ) : (
                    <span className="council-photo council-no-photo">
                      {official.district}
                    </span>
                  )}
                  <span className="council-district-number">
                    0{official.district}
                  </span>
                  <span className="council-open">
                    <ArrowRight size={21} />
                  </span>
                </div>
                <div className="council-person-text">
                  <span>District {official.district}</span>
                  <h2>{official.vacant ? 'Vacant seat' : official.name}</h2>
                  <small>{official.title}</small>
                </div>
              </button>
            ))}
          </section>
          <section
            className="council-detail"
            aria-label="Your district and representative"
            ref={answer}
            tabIndex={-1}
          >
            <div className="council-detail-copy">
              {lookup.selected ? (
                result
              ) : (
                <>
                  <span className="eyebrow">Representation starts here</span>
                  <h2>
                    A closer look
                    <br />
                    at your district.
                  </h2>
                  <p>
                    Every {content.agency.shortName} address belongs to a
                    council district. Find yours above, or select a
                    councilmember to see their district and contact information.
                  </p>
                  <span className="council-detail-note">
                    <Compass size={21} /> {content.map.features.length}{' '}
                    districts. One community.
                  </span>
                </>
              )}
            </div>
            {map}
          </section>
          <LookupFooter content={content} />
        </main>
      )}
    </div>
  );
}
