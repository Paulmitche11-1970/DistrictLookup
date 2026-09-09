import { readFile, writeFile } from 'node:fs/promises';
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import { createHash } from 'node:crypto';
const map = JSON.parse(await readFile('data/districts.json', 'utf8'));
const sets = JSON.parse(
  await readFile(
    '../work/martinez-addresses/county-addresses-geo.json',
    'utf8',
  ),
);
const out = [];
const seen = new Set();
let ambiguous = 0;
let excluded = 0;
for (const f of sets.flatMap((s) => s.features)) {
  const p = f.geometry?.coordinates;
  if (!p || p[0] < -122.2 || p[0] > -122 || p[1] < 37.9 || p[1] > 38.1)
    continue;
  const matches = map.features.filter((d) =>
    booleanPointInPolygon(f, d, { ignoreBoundary: true }),
  );
  if (matches.length !== 1) {
    excluded++;
    if (matches.length > 1) ambiguous++;
    continue;
  }
  const r = f.properties;
  let label = String(r.fulladd || '').trim();
  if (!label) continue;
  if (r.siteunit) label += ` ${r.siteunitty || 'Unit'} ${r.siteunit}`;
  const key = label.toLowerCase() + '|' + p.map((n) => n.toFixed(6)).join(',');
  if (seen.has(key)) continue;
  seen.add(key);
  out.push({
    id: createHash('sha256').update(key).digest('hex').slice(0, 20),
    label,
    lon: p[0],
    lat: p[1],
    district: matches[0].properties.district,
  });
}
out.sort((a, b) =>
  a.label.localeCompare(b.label, undefined, { numeric: true }),
);
await writeFile('data/addresses.json', JSON.stringify(out));
const counts = Object.fromEntries(
  map.features.map((d) => [
    d.properties.district,
    out.filter((a) => a.district === d.properties.district).length,
  ]),
);
await writeFile(
  'data/address-summary.json',
  JSON.stringify(
    {
      count: out.length,
      counts,
      excludedNearby: excluded,
      ambiguous,
      sourceDate: '2025-10-31',
      prepared: '2026-09-09',
      cityHall: out.filter((a) => /525 Henrietta/i.test(a.label)),
    },
    null,
    2,
  ),
);
console.log(
  'City addresses',
  out.length,
  'by district',
  counts,
  'city hall',
  out.filter((a) => /525 Henrietta/i.test(a.label)),
);
