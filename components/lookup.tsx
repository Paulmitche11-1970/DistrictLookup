'use client';
import type { Content } from '@/lib/model';
import { ManagementProfiles } from './management-profiles';
import DistrictMapView from './district-map';
import {
  AddressSearch,
  CouncilList,
  LookupFooter,
  RepresentativeResult,
  useDistrictLookup,
} from './lookup-shared';
import { LookupHeader } from './lookup-header';
export { Brand } from './lookup-shared';

export default function Lookup({
  content,
  embedded = false,
  preview = false,
}: {
  content: Content;
  embedded?: boolean;
  preview?: boolean;
}) {
  const lookup = useDistrictLookup(content, preview);
  return (
    <div
      data-lookup-design="classic"
      className={[
        'lookup',
        embedded ? 'embedded' : '',
        lookup.hasResult ? 'has-result' : '',
      ].join(' ')}
      style={{ '--primary': content.agency.accent } as React.CSSProperties}
    >
      <a className="skip-link" href="#address-search">
        Skip to address search
      </a>
      <LookupHeader
        content={content}
        design="classic"
        embedded={embedded}
        preview={preview}
      />
      <main className="lookup-main">
        <section
          className="lookup-side"
          aria-label="Find your elected representative"
        >
          <div>
            <div className="eyebrow">Your address. Your district.</div>
            <h1>{content.agency.heading}</h1>
            <p className="intro">{lookup.intro}</p>
          </div>
          <AddressSearch lookup={lookup} />
          <RepresentativeResult content={content} lookup={lookup} />
          <CouncilList content={content} lookup={lookup} />
          {!lookup.hasResult && <ManagementProfiles content={content} />}
          <LookupFooter content={content} />
        </section>
        <DistrictMapView
          geo={content.map}
          selected={lookup.selected}
          onSelect={lookup.selectDistrict}
          address={lookup.address}
          approximateAddress={
            !!content.agency.addressNote?.includes('approximate parcel')
          }
        />
      </main>
    </div>
  );
}
