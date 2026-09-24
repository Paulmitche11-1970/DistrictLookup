import { instanceFor } from './instances';
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import { area } from '@turf/area';
import { intersect } from '@turf/intersect';
import type { DistrictMap, Address } from './model';
import type { Feature, Polygon, MultiPolygon, Position } from 'geojson';

type Segment = { a: Position; b: Position; box: number[] };
type Ring = { points: Position[]; segments: Segment[]; box: number[] };
const samePoint = (a: Position, b: Position) => a[0] === b[0] && a[1] === b[1];
const boxesMeet = (a: number[], b: number[]) =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
const turn = (a: Position, b: Position, c: Position) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const onSegment = (p: Position, s: Segment) =>
  p[0] >= s.box[0] && p[0] <= s.box[2] && p[1] >= s.box[1] && p[1] <= s.box[3];

function makeRing(points: Position[]): Ring {
  const segments: Segment[] = [];
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1];
    box[0] = Math.min(box[0], a[0]);
    box[1] = Math.min(box[1], a[1]);
    box[2] = Math.max(box[2], a[0]);
    box[3] = Math.max(box[3], a[1]);
    // Repeated adjacent coordinates do not change a ring's topology.
    if (!samePoint(a, b))
      segments.push({
        a,
        b,
        box: [
          Math.min(a[0], b[0]),
          Math.min(a[1], b[1]),
          Math.max(a[0], b[0]),
          Math.max(a[1], b[1]),
        ],
      });
  }
  return { points, segments, box };
}

// A proper crossing or shared segment is invalid. Isolated endpoint contacts
// are classified separately because different valid rings may touch there.
function segmentContact(s: Segment, t: Segment): Position | 'crossing' | null {
  if (!boxesMeet(s.box, t.box)) return null;
  const abC = turn(s.a, s.b, t.a),
    abD = turn(s.a, s.b, t.b);
  const cdA = turn(t.a, t.b, s.a),
    cdB = turn(t.a, t.b, s.b);
  if (abC === 0 && abD === 0) {
    const axis = Math.abs(s.b[0] - s.a[0]) >= Math.abs(s.b[1] - s.a[1]) ? 0 : 1;
    const low = Math.max(
      Math.min(s.a[axis], s.b[axis]),
      Math.min(t.a[axis], t.b[axis]),
    );
    const high = Math.min(
      Math.max(s.a[axis], s.b[axis]),
      Math.max(t.a[axis], t.b[axis]),
    );
    if (high > low) return 'crossing';
  }
  if (
    ((abC < 0 && abD > 0) || (abC > 0 && abD < 0)) &&
    ((cdA < 0 && cdB > 0) || (cdA > 0 && cdB < 0))
  )
    return 'crossing';
  if (abC === 0 && onSegment(t.a, s)) return t.a;
  if (abD === 0 && onSegment(t.b, s)) return t.b;
  if (cdA === 0 && onSegment(s.a, t)) return s.a;
  if (cdB === 0 && onSegment(s.b, t)) return s.b;
  return null;
}

function ringContacts(a: Ring, b: Ring): Set<string> | null {
  const contacts = new Set<string>();
  if (!boxesMeet(a.box, b.box)) return contacts;
  for (const s of a.segments)
    for (const t of b.segments) {
      const contact = segmentContact(s, t);
      if (contact === 'crossing') return null;
      if (contact) contacts.add(`${contact[0]},${contact[1]}`);
    }
  return contacts;
}

const polygonFeature = (coordinates: Position[][]): Feature<Polygon> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates },
});
function sharesArea(a: Feature<Polygon>, b: Feature<Polygon>) {
  const overlap = intersect({ type: 'FeatureCollection', features: [a, b] });
  return !!overlap && area(overlap) > 0;
}

function validPolygonTopology(polygons: Position[][][]) {
  const parts: { rings: Ring[]; feature: Feature<Polygon> }[] = [];
  for (const polygon of polygons) {
    const rings = polygon.map(makeRing);
    for (const ring of rings) {
      if (ring.segments.length < 3 || area(polygonFeature([ring.points])) === 0)
        return false;
      for (let i = 0; i < ring.segments.length; i++)
        for (let j = i + 1; j < ring.segments.length; j++) {
          const contact = segmentContact(ring.segments[i], ring.segments[j]);
          if (!contact) continue;
          const adjacent =
            j === i + 1 || (i === 0 && j === ring.segments.length - 1);
          if (contact === 'crossing' || !adjacent) return false;
        }
    }
    const shell = polygonFeature([polygon[0]]);
    for (const hole of polygon.slice(1)) {
      if (hole.some((p) => !booleanPointInPolygon(p, shell))) return false;
    }
    const touches = new Map<string, Set<number>>();
    for (let i = 0; i < rings.length; i++)
      for (let j = i + 1; j < rings.length; j++) {
        const contacts = ringContacts(rings[i], rings[j]);
        if (contacts === null) return false;
        if (
          i > 0 &&
          sharesArea(polygonFeature([polygon[i]]), polygonFeature([polygon[j]]))
        )
          return false;
        for (const point of contacts) {
          const touching = touches.get(point) ?? new Set<number>();
          touching.add(i);
          touching.add(j);
          touches.set(point, touching);
        }
      }
    // A cycle between rings and distinct contact points disconnects the
    // polygon interior. Several rings meeting at the same point is one node.
    const parents = new Map<string, string>();
    const root = (node: string): string => {
      let current = node;
      while (parents.has(current)) current = parents.get(current)!;
      return current;
    };
    for (const [point, ringIds] of touches)
      for (const id of ringIds) {
        const a = root(`point:${point}`),
          b = root(`ring:${id}`);
        if (a === b) return false;
        parents.set(a, b);
      }
    parts.push({ rings, feature: polygonFeature(polygon) });
  }
  for (let i = 0; i < parts.length; i++)
    for (let j = i + 1; j < parts.length; j++) {
      if (sharesArea(parts[i].feature, parts[j].feature)) return false;
      for (const a of parts[i].rings)
        for (const b of parts[j].rings)
          if (ringContacts(a, b) === null) return false;
    }
  return true;
}
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
    if (!validPolygonTopology(polygons))
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
