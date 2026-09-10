import { instanceFor } from './instances';
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import { area } from '@turf/area';
import { kinks } from '@turf/kinks';
import { intersect } from '@turf/intersect';
import type { DistrictMap, Address } from './model';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
export function locate(
  map: DistrictMap,
  p: Pick<Address, 'lon' | 'lat'>,
): string | null {
  if (!Number.isFinite(p.lon) || !Number.isFinite(p.lat)) return null;
  const at = [p.lon, p.lat];
  const touching = map.features.filter((f) => booleanPointInPolygon(at, f));
  if (touching.length !== 1) return null;
  return booleanPointInPolygon(at, touching[0], { ignoreBoundary: true })
    ? touching[0].properties.district
    : null;
}
export function normalizeMap(
  input: unknown,
  field: string,
  region: string = 'martinez',
): { map: DistrictMap; skipped: number } {
  const instance = instanceFor(region);
  if (!instance) throw Error('Unknown agency map region.');
  const bounds = instance.bounds;
  if (!input || typeof input !== 'object')
    throw Error('Choose a polygon GeoJSON or a zipped shapefile.');
  const raw = input as { type?: string; features?: Feature[] };
  if (
    raw.type !== 'FeatureCollection' ||
    !Array.isArray(raw.features) ||
    !raw.features.length ||
    raw.features.length > 200
  )
    throw Error('The file must contain 1–200 district polygons.');
  const features: DistrictMap['features'] = [];
  const ids = new Set<string>();
  let skipped = 0;
  let vertices = 0;
  for (const f of raw.features) {
    const id = String(f.properties?.[field] ?? '').trim();
    if (!id) {
      skipped++;
      continue;
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9 -]{0,19}$/.test(id))
      throw Error(
        'District labels must be short letters or numbers. Choose the district field.',
      );
    if (ids.has(id))
      throw Error(
        `District ${id} occurs more than once. Dissolve its polygons into one feature first.`,
      );
    ids.add(id);
    if (!f.geometry || !['Polygon', 'MultiPolygon'].includes(f.geometry.type))
      throw Error('Only polygon district boundaries are supported.');
    const g = f.geometry as Polygon | MultiPolygon;
    const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const polygon of polygons) {
      if (!polygon.length) throw Error('A polygon is empty.');
      for (const ring of polygon) {
        if (ring.length < 4)
          throw Error('A polygon ring has fewer than four vertices.');
        vertices += ring.length;
        if (vertices > 150000)
          throw Error(
            'Please simplify this map to fewer than 150,000 vertices.',
          );
        if (ring[0][0] !== ring.at(-1)?.[0] || ring[0][1] !== ring.at(-1)?.[1])
          throw Error('A polygon ring is not closed.');
        for (const p of ring) {
          if (
            p.length < 2 ||
            !p.every(Number.isFinite) ||
            Math.abs(p[0]) > 180 ||
            Math.abs(p[1]) > 90
          )
            throw Error(
              'Coordinates must use longitude/latitude (WGS84). Include the .prj with a shapefile.',
            );
          if (
            p[0] < bounds[0] ||
            p[0] > bounds[2] ||
            p[1] < bounds[1] ||
            p[1] > bounds[3]
          )
            throw Error(`This map is outside the ${instance.shortName} area.`);
        }
      }
    }
    const feature: DistrictMap['features'][number] = {
      type: 'Feature',
      properties: { district: id },
      geometry: g,
    };
    if (area(feature) < 100) throw Error(`District ${id} has no usable area.`);
    if (kinks(feature).features.length)
      throw Error(`District ${id} contains self-intersecting boundaries.`);
    features.push(feature);
  }
  if (features.length < 2 || features.length > 20)
    throw Error(
      'Choose the district field: 2–20 named districts are required.',
    );
  // Shared edges are expected; measurable shared area would give residents ambiguous results.
  for (let i = 0; i < features.length; i++)
    for (let j = i + 1; j < features.length; j++) {
      const overlap = intersect({
        type: 'FeatureCollection',
        features: [features[i], features[j]],
      });
      if (overlap && area(overlap) > 1)
        throw Error(
          `Districts ${features[i].properties.district} and ${features[j].properties.district} overlap. Check the district boundaries.`,
        );
    }
  return { map: { type: 'FeatureCollection', features }, skipped };
}
