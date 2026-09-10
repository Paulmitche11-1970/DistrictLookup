'use client';
import { useEffect, useRef, useState } from 'react';
import { Map as MapIcon, Satellite, Maximize, Plus, Minus } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DistrictMap, Address } from '@/lib/model';
import { colorFor, fullAddress } from '@/lib/model';
import type L from 'leaflet';
import { pointOnFeature } from '@turf/point-on-feature';
export default function DistrictMapView({
  geo,
  selected,
  onSelect,
  address,
  insetLeft = 0,
}: {
  geo: DistrictMap;
  selected: string | null;
  onSelect: (id: string) => void;
  address: Address | null;
  insetLeft?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<L.GeoJSON | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const labels = useRef<L.LayerGroup | null>(null);
  const selectRef = useRef(onSelect);
  const fitRef = useRef<() => void>(() => {});
  useEffect(() => {
    selectRef.current = (id) => {
      if (!address) onSelect(id);
    };
  }, [onSelect, address]);
  const [mode, setMode] = useState('street');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    import('leaflet')
      .then((L) => {
        if (cancelled || !ref.current) return;
        const m = L.map(ref.current, {
          zoomControl: false,
          scrollWheelZoom: true,
          zoomSnap: 0.25,
          zoomDelta: 0.25,
          wheelPxPerZoomLevel: 160,
          minZoom: 3,
          maxZoom: 19,
        });
        map.current = m;
        labels.current = L.layerGroup().addTo(m);
        setReady(true);
        const ro = new ResizeObserver(() => {
          m.invalidateSize();
          fitRef.current();
        });
        ro.observe(ref.current);
        (m as L.Map & { _ro?: ResizeObserver })._ro = ro;
      })
      .catch(() =>
        setError(
          'The map could not load. You can still search for your representative.',
        ),
      );
    return () => {
      cancelled = true;
      const m = map.current as (L.Map & { _ro?: ResizeObserver }) | null;
      m?._ro?.disconnect();
      m?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    let cancelled = false;
    import('leaflet')
      .then((L) => {
        if (cancelled || !map.current) return;
        tiles.current?.remove();
        setError('');
        const url =
          mode === 'street'
            ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        const attribution =
          mode === 'street'
            ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            : 'Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community';
        const tile = L.tileLayer(url, {
          attribution,
          maxZoom: 19,
          crossOrigin: true,
        }).addTo(map.current);
        let failures = 0;
        tile.on('tileerror', () => {
          if (++failures >= 3)
            setError(
              'Background imagery is unavailable. District boundaries and address results remain available.',
            );
        });
        tiles.current = tile;
      })
      .catch(() =>
        setError(
          'The map could not update. Reload the page; the address result remains available.',
        ),
      );
    return () => {
      cancelled = true;
    };
  }, [mode, ready]);
  useEffect(() => {
    if (!ready || !map.current) return;
    let cancelled = false;
    import('leaflet')
      .then((L) => {
        if (cancelled || !map.current) return;
        layers.current?.remove();
        labels.current?.clearLayers();
        const g = L.geoJSON(geo, {
          style: (f) => ({
            color: colorFor(f?.properties.district),
            weight: selected === f?.properties.district ? 3 : 1.5,
            fillColor: colorFor(f?.properties.district),
            fillOpacity: selected
              ? selected === f?.properties.district?.toString()?.trim()
                ? 0.25
                : 0.04
              : 0.17,
          }),
          onEachFeature: (f, l) => {
            l.on('click', () => selectRef.current(f.properties.district));
            l.bindTooltip(`District ${f.properties.district}`, {
              sticky: true,
            });
            const [lon, lat] = pointOnFeature(f).geometry.coordinates;
            const center: [number, number] = [lat, lon];
            L.marker(center, {
              interactive: false,
              keyboard: false,
              icon: L.divIcon({
                className: 'district-label',
                html: `<span>${f.properties.district.replace(/[^0-9A-Za-z -]/g, '')}</span>`,
                iconSize: [29, 29],
              }),
            }).addTo(labels.current!);
          },
        }).addTo(map.current);
        layers.current = g;
        map.current.setMaxBounds(g.getBounds().pad(0.5));
        fitRef.current = () => {
          const m = map.current;
          if (!m) return;
          const feature = geo.features.find(
            (f) => f.properties.district === selected,
          );
          const bounds = feature
            ? L.geoJSON(feature).getBounds()
            : g.getBounds();
          // The Explorer card occupies the left edge on desktop; frame the geometry in the visible map.
          const left = m.getSize().x > 800 ? insetLeft : 0;
          m.stop();
          m.fitBounds(bounds, {
            paddingTopLeft: [left + 24, address ? 85 : 30],
            paddingBottomRight: [35, 35],
            maxZoom: 16,
            animate: false,
          });
        };
        fitRef.current();
      })
      .catch(() =>
        setError(
          'The map could not update. Reload the page; the address result remains available.',
        ),
      );
    return () => {
      cancelled = true;
    };
  }, [geo, selected, address, ready, insetLeft]);
  useEffect(() => {
    if (!ready || !map.current) return;
    let cancelled = false;
    import('leaflet')
      .then((L) => {
        if (cancelled || !map.current) return;
        pin.current?.remove();
        if (address) {
          pin.current = L.marker([address.lat, address.lon], {
            icon: L.divIcon({
              className: 'address-pin',
              html: '<svg width="38" height="48" viewBox="0 0 38 48" aria-hidden="true"><path d="M19 46S2 27 2 19a17 17 0 1 1 34 0c0 8-17 27-17 27Z" fill="#d72f40" stroke="white" stroke-width="2.5"/><circle cx="19" cy="19" r="6" fill="white"/></svg>',
              iconSize: [38, 48],
              iconAnchor: [19, 47],
            }),
            zIndexOffset: 1000,
            title: fullAddress(address),
          }).addTo(map.current);
          const text = document.createElement('span');
          const title = document.createElement('strong');
          title.textContent = 'You are here';
          text.append(title, document.createTextNode(fullAddress(address)));
          pin.current.bindTooltip(text, {
            permanent: true,
            direction: 'top',
            offset: [0, -46],
            className: 'address-tooltip',
            opacity: 1,
          });
        }
      })
      .catch(() =>
        setError(
          'The map could not update. Reload the page; the address result remains available.',
        ),
      );
    return () => {
      cancelled = true;
    };
  }, [address, ready]);
  return (
    <section className="map-surface" aria-label="District map">
      <div
        ref={ref}
        className="leaflet-map"
        role="region"
        aria-label="Interactive map. Use the address search or district buttons for a text answer."
      />
      <div className="map-tools">
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(String(v))}
          className="layer-tabs"
        >
          <TabsList aria-label="Map background">
            <TabsTrigger value="street">
              <MapIcon size={16} />
              Street
            </TabsTrigger>
            <TabsTrigger value="satellite">
              <Satellite size={16} />
              Satellite
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {error && (
        <div className="notice map-error" role="status">
          {error}
        </div>
      )}
      <div className="map-actions">
        <button
          className="icon-btn"
          aria-label="Zoom in"
          onClick={() => map.current?.zoomIn()}
        >
          <Plus size={18} />
        </button>
        <button
          className="icon-btn"
          aria-label="Zoom out"
          onClick={() => map.current?.zoomOut()}
        >
          <Minus size={18} />
        </button>
        <button
          className="icon-btn"
          aria-label="Show all districts"
          onClick={() => {
            if (layers.current)
              map.current?.fitBounds(layers.current.getBounds(), {
                padding: [35, 70],
              });
          }}
        >
          <Maximize size={17} />
        </button>
      </div>
      {!address && (
        <div className="map-legend">
          <div className="eyebrow">Districts</div>
          <div className="legend-items">
            {geo.features.map((f) => (
              <button
                key={f.properties.district}
                onClick={() => onSelect(f.properties.district)}
                aria-pressed={selected === f.properties.district}
              >
                <i style={{ background: colorFor(f.properties.district) }} />
                District {f.properties.district}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
