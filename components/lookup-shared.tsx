'use client';
import { useEffect, useRef, useState } from 'react';
import {
  MapPin,
  ArrowUpRight,
  ChevronRight,
  Mail,
  Phone,
  Globe,
  ArrowLeft,
} from 'lucide-react';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox';
import type { Content, Address, Official } from '@/lib/model';
import { apiPath, instanceFor } from '@/lib/instances';
import {
  atLargeOfficials,
  districtOfficial,
  representativesFor,
  titleLabel,
  constituencyLabel,
  hasTitle,
} from '@/lib/representation';
import {
  colorFor,
  termLabel,
  fullAddress,
  lookupIntro,
  phoneHref,
} from '@/lib/model';
export function Brand({
  name = 'Martinez',
  sandbox = false,
  agencyId,
}: {
  name?: string;
  sandbox?: boolean;
  agencyId?: string;
}) {
  const instance = instanceFor(
    agencyId || (sandbox ? 'arpeeville' : name.toLowerCase()),
  );
  if (instance && !['martinez', 'arpeeville'].includes(instance.id)) {
    return (
      <a
        className="wordmark county-wordmark"
        href={'/' + instance.id}
        aria-label={instance.shortName + ' district lookup'}
      >
        {instance.logo && (
          <img src={instance.logo} alt="" width={68} height={68} />
        )}
        <div>
          <span>District lookup</span>
          <strong>{instance.shortName}</strong>
        </div>
      </a>
    );
  }
  if (instance?.logo) {
    return (
      <a
        className="wordmark wordmark-city-logo"
        href={
          instance.id === 'martinez'
            ? 'https://www.cityofmartinez.org/'
            : '/' + instance.id
        }
      >
        <img
          src={instance.logo}
          alt={instance.name + (instance.slogan ? ' — ' + instance.slogan : '')}
          width={470}
          height={104}
          className="city-logo"
        />
      </a>
    );
  }
  return (
    <a className="wordmark" href={sandbox ? '/arpeeville' : '/'}>
      <div className="wordmark-icon">
        <MapPin size={24} />
      </div>
      <div>
        <span>City of</span>
        <strong>{name.toUpperCase()}</strong>
      </div>
    </a>
  );
}
export function Portrait({
  official,
  className,
}: {
  official: Official;
  className: string;
}) {
  return official.photo ? (
    <img
      className={className}
      src={official.photo}
      alt={official.name}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  ) : (
    <div
      className={className}
      aria-hidden="true"
      style={{
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        color: '#597583',
      }}
    >
      {official.name
        .split(' ')
        .map((s) => s[0])
        .slice(0, 2)
        .join('')}
    </div>
  );
}

export function useDistrictLookup(content: Content, preview = false) {
  const [query, setQuery] = useState('');
  const lookupRequest = useRef(0);
  const [results, setResults] = useState<Address[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  // Keep the chosen combobox value immediately, while the server resolves its
  // district. Otherwise closing a slow lookup can clear the input and cancel it.
  const [searchChoice, setSearchChoice] = useState<Address | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const official = profileId
    ? content.officials.find((o) => o.id === profileId)
    : districtOfficial(content, selected);
  const mayor = atLargeOfficials(content).find((o) => hasTitle(o, 'Mayor'));
  const hasResult = !!selected || !!profileId;
  const a = content.agency;
  const apiRoot = apiPath(
    a.instanceId || (a.sandbox ? 'arpeeville' : 'martinez'),
  );
  const minSearchLength = apiRoot === '/api/arpeeville' ? 1 : 2;
  useEffect(() => {
    if (query.trim().length < minSearchLength) {
      setResults([]);
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    const delay = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch(
          `${apiRoot}/addresses?q=${encodeURIComponent(query)}`,
          {
            signal: controller.signal,
          },
        );
        const data = await r.json();
        if (!r.ok)
          throw Error(
            data.error || 'Address search is temporarily unavailable.',
          );
        setResults(data.addresses);
        setMessage('');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setResults([]);
          setMessage((e as Error).message);
        }
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 220);
    return () => {
      clearTimeout(delay);
      controller.abort();
    };
  }, [query, apiRoot, minSearchLength]);
  async function choose(value: Address | null) {
    if (!value) return;
    setSearchChoice(value);
    const request = ++lookupRequest.current;
    setBusy(true);
    setSearchOpen(false);
    setMessage('');
    try {
      const r = await fetch(
        `${apiRoot}/lookup?id=${encodeURIComponent(value.id)}${preview ? '&preview=1' : ''}`,
      );
      const data = await r.json();
      if (request !== lookupRequest.current) return;
      if (!r.ok)
        throw Error(data.error || 'We could not identify this district.');
      setAddress(data.address);
      setProfileId(null);
      setSelected(data.district);
      setQuery(value.label);
    } catch (e) {
      if (request !== lookupRequest.current) return;
      setSelected(null);
      setAddress(null);
      setSearchChoice(null);
      setMessage((e as Error).message);
    } finally {
      if (request === lookupRequest.current) setBusy(false);
    }
  }
  function selectDistrict(id: string) {
    setProfileId(null);
    lookupRequest.current++;
    setBusy(false);
    setSelected(id);
    setAddress(null);
    setSearchChoice(null);
    setQuery('');
    setResults([]);
    setSearchOpen(false);
    setMessage('');
  }

  function clear() {
    setProfileId(null);
    lookupRequest.current++;
    setBusy(false);
    setSelected(null);
    setAddress(null);
    setSearchChoice(null);
    setQuery('');
    setResults([]);
    setMessage('');
    setSearchOpen(false);
  }
  return {
    profileId,
    hasResult,
    selectOfficial: (value: Official) => {
      if (value.district !== null) selectDistrict(value.district);
      else {
        clear();
        setProfileId(value.id);
      }
    },
    query,
    setQuery,
    lookupRequest,
    results,
    minSearchLength,
    selected,
    setSelected,
    address,
    setAddress,
    searchChoice,
    setSearchChoice,
    busy,
    message,
    searchOpen,
    setSearchOpen,
    official,
    mayor,
    a,
    intro: lookupIntro(a),
    choose,
    selectDistrict,
    clear,
  };
}
export type LookupState = ReturnType<typeof useDistrictLookup>;

export function AddressSearch({ lookup }: { lookup: LookupState }) {
  const {
    results,
    searchChoice,
    setSearchChoice,
    choose,
    query,
    lookupRequest,
    setSearchOpen,
    setQuery,
    searchOpen,
    busy,
    selected,
    message,
  } = lookup;
  if (lookup.hasResult) return null;
  if (lookup.a.addressMode === 'pending')
    return (
      <p className="notice">
        Address search is being prepared. Select a district or representative
        below to explore the map.
      </p>
    );
  return (
    <>
      <div className="address-search">
        <label className="search-label" htmlFor="address-search">
          Your street address
        </label>
        <Combobox
          items={results}
          filter={null}
          value={searchChoice}
          onValueChange={choose}
          inputValue={query}
          onInputValueChange={(text, details) => {
            if (
              details.reason === 'input-change' ||
              details.reason === 'input-clear'
            ) {
              lookupRequest.current++;
              setSearchChoice(null);
              setSearchOpen(true);
            }
            setQuery(text);
          }}
          open={searchOpen}
          onOpenChange={setSearchOpen}
          itemToStringLabel={(v: Address) => v.label}
          isItemEqualToValue={(x: Address, y: Address) => x.id === y.id}
        >
          <ComboboxInput
            id="address-search"
            placeholder="Start typing an address…"
            showTrigger={false}
            autoComplete="off"
          />
          <ComboboxContent>
            <ComboboxEmpty>
              {busy
                ? `Searching ${lookup.a.shortName} addresses…`
                : query.trim().length < lookup.minSearchLength
                  ? lookup.minSearchLength === 1
                    ? 'Type to explore an address.'
                    : 'Type at least two characters.'
                  : 'No matching address within this agency. Try the street number and name.'}
            </ComboboxEmpty>
            <ComboboxList>
              {(item: Address) => (
                <ComboboxItem key={item.id} value={item}>
                  <div className="search-item">
                    <MapPin size={17} />
                    <div>
                      {item.label}
                      <small>
                        {item.city || lookup.a.shortName}, {lookup.a.state}
                        {item.zip ? ' ' + item.zip : ''}
                      </small>
                    </div>
                  </div>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        {!selected && (lookup.a.sampleAddress || !lookup.a.instanceId) && (
          <p className="small muted" style={{ marginTop: 14 }}>
            Try{' '}
            <button
              className="example-link"
              onClick={() => {
                lookupRequest.current++;
                setQuery(lookup.a.sampleAddress || '525 Henrietta');
                setSearchOpen(true);
              }}
            >
              {lookup.a.sampleAddress || '525 Henrietta Street'}
            </button>
          </p>
        )}
        {lookup.a.addressNote && (
          <p className="small muted address-note">{lookup.a.addressNote}</p>
        )}
      </div>
      {message && (
        <div className="notice error" role="alert">
          {message}
        </div>
      )}
      {busy && (
        <div className="small muted" role="status">
          Finding your address…
        </div>
      )}
    </>
  );
}

export function OfficialDetails({
  official,
  a,
}: {
  official: Official;
  a: Content['agency'];
}) {
  return (
    <section className="representative-profile" aria-label={official.name}>
      <div className="official-heading">
        {a.showPhotos && (
          <Portrait official={official} className="result-photo" />
        )}
        <div>
          <div className="eyebrow">{titleLabel(official)}</div>
          <h2>{official.name}</h2>
          {a.showTerm && official.termEnd && (
            <p className="term">Term ends {termLabel(official.termEnd)}</p>
          )}
        </div>
      </div>
      <div className="contact-list">
        {a.showEmail && official.email && (
          <a href={'mailto:' + official.email}>
            <Mail size={18} />
            <span>{official.email}</span>
          </a>
        )}
        {a.showPhone && official.phone && (
          <a href={phoneHref(official.phone)}>
            <Phone size={18} />
            <span>
              {official.phone}
              <small>{official.phoneLabel}</small>
            </span>
          </a>
        )}
        {a.showWebsite && official.website && (
          <a href={official.website} target="_blank" rel="noreferrer">
            <Globe size={18} />
            <span>About {official.name.split(' ')[0]}</span>
            <ArrowUpRight size={15} style={{ marginLeft: 'auto' }} />
          </a>
        )}
      </div>
      {official.bio && (
        <p
          className="small muted"
          style={{ marginTop: 18, whiteSpace: 'pre-line' }}
        >
          {official.bio}
        </p>
      )}
      {a.showStaff && official.staffName && (
        <div className="notice" style={{ marginTop: 18 }}>
          <strong>{official.staffName}</strong>
          <div className="small">Office contact</div>
          {official.staffEmail && (
            <a href={'mailto:' + official.staffEmail}>{official.staffEmail}</a>
          )}
          {official.staffPhone && <p>{official.staffPhone}</p>}
        </div>
      )}
    </section>
  );
}
export function RepresentativeResult({
  content,
  lookup,
}: {
  content: Content;
  lookup: LookupState;
}) {
  const { selected, address, official, profileId, hasResult, clear } = lookup;
  const a = content.agency;
  const transition = selected
    ? content.districtElections?.[selected]
    : undefined;
  const people = profileId
    ? official && !official.vacant
      ? [official]
      : []
    : selected
      ? representativesFor(content, selected)
      : [];
  if (!hasResult) return null;
  return (
    <div className="result-card" aria-live="polite">
      <div
        className="result-district"
        style={{ color: colorFor(selected || '') }}
      >
        <MapPin size={17} />
        {selected
          ? 'District ' + selected
          : official
            ? constituencyLabel(official)
            : 'At Large'}
      </div>
      <p className="small muted" style={{ margin: '16px 0' }}>
        {address
          ? fullAddress(address)
          : profileId
            ? 'Represents the entire agency.'
            : 'Exploring this district. Search your address to confirm yours.'}
      </p>
      <button className="clear-result result-reset" onClick={clear}>
        <ArrowLeft size={14} />
        {address ? 'Start again' : 'Search for an address'}
      </button>
      {address && a.addressNote && (
        <p className="small muted address-note">{a.addressNote}</p>
      )}
      {selected && transition?.status === 'transition' ? (
        <div className="notice transition-notice">
          <strong>At-large representation during the transition</strong>
          <p>
            {address ? 'Your location is in' : 'You are exploring'} District{' '}
            {selected}. This district does not yet have a serving district
            representative. The at-large members below currently represent you.
          </p>
          {transition.firstElection && (
            <p>
              First district election: {termLabel(transition.firstElection)}.
            </p>
          )}
        </div>
      ) : selected && (!official || official.vacant) ? (
        <div className="notice">
          <h3>District {selected}</h3>
          <p>
            {official?.vacant
              ? 'This seat is currently vacant. Contact the agency for assistance.'
              : 'District representative information is not yet available. Contact the agency for assistance.'}
          </p>
          {a.contactPhone && (
            <a href={phoneHref(a.contactPhone)}>{a.contactPhone}</a>
          )}
        </div>
      ) : null}
      {people.map((person) => (
        <div className="representative-result-person" key={person.id}>
          {selected && person.district === null && (
            <p className="eyebrow">Also represents you at large</p>
          )}
          <OfficialDetails official={person} a={a} />
        </div>
      ))}
    </div>
  );
}
export function CouncilList({
  content,
  lookup,
}: {
  content: Content;
  lookup: LookupState;
}) {
  if (lookup.hasResult) return null;
  const officials = [
    ...atLargeOfficials(content),
    ...content.officials.filter(
      (o) =>
        o.district !== null &&
        content.districtElections?.[o.district]?.status !== 'transition',
    ),
  ];
  return (
    <div className="district-list">
      <div className="row space-between list-heading">
        <span className="eyebrow">
          {lookup.a.kind === 'county'
            ? 'Explore the board'
            : 'Explore the council'}
        </span>
        <span className="small muted">
          {content.map.features.length} districts
        </span>
      </div>
      {officials.map((o) => (
        <button
          className={
            'district-choice' + (o.district === null ? ' at-large-choice' : '')
          }
          key={o.id}
          onClick={() => lookup.selectOfficial(o)}
        >
          {lookup.a.showPhotos && <Portrait official={o} className="avatar" />}
          <div>
            <strong>
              {o.vacant
                ? 'Vacant seat'
                : (hasTitle(o, 'Mayor') ? 'Mayor ' : '') + o.name}
            </strong>
            <span>{constituencyLabel(o)}</span>
          </div>
          {o.district !== null && (
            <i
              className="district-dot"
              style={{ background: colorFor(o.district) }}
            />
          )}
          <ChevronRight size={17} className="chevron" />
        </button>
      ))}
    </div>
  );
}

export function LookupFooter(_props: { content: Content }) {
  return (
    <footer className="public-footer">
      <span>
        Powered by{' '}
        <a
          href="https://redistrictingpartners.com"
          target="_blank"
          rel="noreferrer"
        >
          RP Data
        </a>
      </span>
    </footer>
  );
}
