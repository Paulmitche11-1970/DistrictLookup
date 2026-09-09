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
  ShieldCheck,
} from 'lucide-react';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox';
import DistrictMapView from './district-map';
import type { Content, Address, Official } from '@/lib/model';
import { colorFor, termLabel } from '@/lib/model';
export function Brand({ name = 'Martinez' }: { name?: string }) {
  if (name.toLowerCase() === 'martinez') {
    return (
      <a className="wordmark wordmark-city-logo" href="/">
        <img
          src="/branding/martinez-logo.svg"
          alt="City of Martinez, CA — The Bay Area’s Hidden Gem"
          width={470}
          height={104}
          className="city-logo"
        />
      </a>
    );
  }
  return (
    <a className="wordmark" href="/">
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
function Portrait({
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
export default function Lookup({
  content,
  embedded = false,
  preview = false,
}: {
  content: Content;
  embedded?: boolean;
  preview?: boolean;
}) {
  const [query, setQuery] = useState('');
  const lookupRequest = useRef(0);
  const [results, setResults] = useState<Address[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const official = content.officials.find((o) => o.district === selected);
  const mayor = content.officials.find((o) => o.district === null);
  const a = content.agency;
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    const delay = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch(`/api/addresses?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
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
  }, [query]);
  async function choose(value: Address | null) {
    if (!value) return;
    const request = ++lookupRequest.current;
    setBusy(true);
    setSearchOpen(false);
    setMessage('');
    try {
      const r = await fetch(
        `/api/lookup?id=${encodeURIComponent(value.id)}${preview ? '&preview=1' : ''}`,
      );
      const data = await r.json();
      if (request !== lookupRequest.current) return;
      if (!r.ok)
        throw Error(data.error || 'We could not identify this district.');
      setAddress(data.address);
      setSelected(data.district);
      setQuery(value.label);
    } catch (e) {
      if (request !== lookupRequest.current) return;
      setSelected(null);
      setAddress(null);
      setMessage((e as Error).message);
    } finally {
      if (request === lookupRequest.current) setBusy(false);
    }
  }
  function selectDistrict(id: string) {
    lookupRequest.current++;
    setBusy(false);
    setSelected(id);
    setAddress(null);
    setMessage('');
  }
  return (
    <div
      className={`lookup ${embedded ? 'embedded' : ''} ${selected ? 'has-result' : ''}`}
      style={{ '--primary': a.accent } as React.CSSProperties}
    >
      <a className="skip-link" href="#address-search">
        Skip to address search
      </a>
      <header className="public-header">
        <Brand name={a.shortName} />
        <div className="header-links">
          <span className="preview-label small muted">
            {preview ? 'Unpublished preview' : 'RP demonstration'}
          </span>
          <a
            className="website-link row"
            href={a.website}
            target="_blank"
            rel="noreferrer"
          >
            City website <ArrowUpRight size={15} />
          </a>
          {!embedded && <a href="/admin">Agency sign in</a>}
        </div>
      </header>
      <main className="lookup-main">
        <section
          className="lookup-side"
          aria-label="Find your elected representative"
        >
          <div>
            <div className="eyebrow">Your address. Your district.</div>
            <h1>{a.heading}</h1>
            <p className="intro">{a.intro}</p>
          </div>
          <div className="address-search">
            <label className="search-label" htmlFor="address-search">
              Your street address
            </label>
            <Combobox
              items={results}
              filter={null}
              value={address}
              onValueChange={choose}
              inputValue={query}
              onInputValueChange={(text, details) => {
                if (
                  details.reason === 'input-change' ||
                  details.reason === 'input-clear'
                ) {
                  lookupRequest.current++;
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
                    ? 'Searching Martinez addresses…'
                    : query.trim().length < 2
                      ? 'Type at least two characters.'
                      : 'No matching city address. Try the street number and name.'}
                </ComboboxEmpty>
                <ComboboxList>
                  {(item: Address) => (
                    <ComboboxItem key={item.id} value={item}>
                      <div className="search-item">
                        <MapPin size={17} />
                        <div>
                          {item.label}
                          <small>Martinez, California</small>
                        </div>
                      </div>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <div className="search-helper">
              <ShieldCheck size={14} />
              Only addresses inside Martinez city limits
            </div>
            {!selected && (
              <p className="small muted" style={{ marginTop: 14 }}>
                Try{' '}
                <button
                  className="example-link"
                  onClick={() => {
                    lookupRequest.current++;
                    setQuery('525 Henrietta');
                    setSearchOpen(true);
                  }}
                >
                  525 Henrietta Street
                </button>
              </p>
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
          {selected && (
            <div className="result-card" aria-live="polite">
              <div className="row space-between" style={{ marginBottom: 18 }}>
                <div
                  className="result-district"
                  style={{ color: colorFor(selected), margin: 0 }}
                >
                  <MapPin size={17} />
                  District {selected}
                </div>
                <button
                  className="clear-result"
                  onClick={() => {
                    setSelected(null);
                    setAddress(null);
                    setQuery('');
                  }}
                >
                  <ArrowLeft size={14} />
                  Start again
                </button>
              </div>
              {address ? (
                <p className="small muted" style={{ marginBottom: 18 }}>
                  {address.label}
                </p>
              ) : (
                <p className="small muted" style={{ marginBottom: 18 }}>
                  Exploring this district. Search your address to confirm yours.
                </p>
              )}
              {official && !official.vacant ? (
                <>
                  <div className="official-heading">
                    {a.showPhotos && (
                      <Portrait official={official} className="result-photo" />
                    )}
                    <div>
                      <div className="eyebrow">{official.title}</div>
                      <h2>{official.name}</h2>
                      {a.showTerm && official.termEnd && (
                        <p className="term">
                          Term ends {termLabel(official.termEnd)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="contact-list">
                    {a.showEmail && official.email && (
                      <a href={`mailto:${official.email}`}>
                        <Mail size={18} />
                        <span>{official.email}</span>
                      </a>
                    )}
                    {a.showPhone && official.phone && (
                      <a href={`tel:${official.phone.replace(/[^+0-9]/g, '')}`}>
                        <Phone size={18} />
                        <span>
                          {official.phone}
                          <small>{official.phoneLabel}</small>
                        </span>
                      </a>
                    )}
                    {a.showWebsite && official.website && (
                      <a
                        href={official.website}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Globe size={18} />
                        <span>About {official.name.split(' ')[0]}</span>
                        <ArrowUpRight
                          size={15}
                          style={{ marginLeft: 'auto' }}
                        />
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
                        <a href={`mailto:${official.staffEmail}`}>
                          {official.staffEmail}
                        </a>
                      )}
                      {official.staffPhone && <p>{official.staffPhone}</p>}
                    </div>
                  )}
                </>
              ) : (
                <div className="notice">
                  <h3>District {selected}</h3>
                  <p style={{ marginTop: 8 }}>
                    This seat is currently vacant. Contact the city for
                    assistance.
                  </p>
                  <a href={`tel:${a.contactPhone.replace(/[^+0-9]/g, '')}`}>
                    {a.contactPhone}
                  </a>
                </div>
              )}
              {a.showMayor && mayor && !mayor.vacant && (
                <div className="mayor-line">
                  {a.showPhotos && (
                    <Portrait official={mayor} className="avatar" />
                  )}
                  <div>
                    <small>Also represents you citywide</small>
                    <strong>
                      {mayor.title} {mayor.name}
                    </strong>
                    {a.showEmail && mayor.email && (
                      <small>
                        <a href={`mailto:${mayor.email}`}>Contact the mayor</a>
                      </small>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {!selected && (
            <div className="district-list">
              <div className="row space-between list-heading">
                <span className="eyebrow">Explore the council</span>
                <span className="small muted">
                  {content.map.features.length} districts
                </span>
              </div>
              {content.officials
                .filter((o) => o.district)
                .map((o) => (
                  <button
                    className="district-choice"
                    key={o.id}
                    onClick={() => selectDistrict(o.district!)}
                  >
                    {a.showPhotos && (
                      <Portrait official={o} className="avatar" />
                    )}
                    <div>
                      <strong>{o.vacant ? 'Vacant seat' : o.name}</strong>
                      <span>District {o.district}</span>
                    </div>
                    <i
                      className="district-dot"
                      style={{ background: colorFor(o.district!) }}
                    />
                    <ChevronRight size={17} className="chevron" />
                  </button>
                ))}
            </div>
          )}
          <footer className="public-footer">
            <span>
              Powered by{' '}
              <a
                href="https://redistrictingpartners.com"
                target="_blank"
                rel="noreferrer"
              >
                Redistricting Partners
              </a>
            </span>
            <a href={content.sourceUrl} target="_blank" rel="noreferrer">
              Sources
            </a>
          </footer>
        </section>
        <DistrictMapView
          geo={content.map}
          selected={selected}
          onSelect={selectDistrict}
          address={address}
        />
      </main>
    </div>
  );
}
