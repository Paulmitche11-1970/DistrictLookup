// Fictional labels dispersed within the demo districts. Prefer existing
// San Mateo address coordinates; the fictional northern band uses an interior grid.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import assert from 'node:assert/strict';

const root = 'data/arpeeville/';
const original = JSON.parse(readFileSync(root + 'addresses.json', 'utf8'));
const jokes = JSON.parse(readFileSync(root + 'joke-addresses.json', 'utf8'));
const map = JSON.parse(readFileSync(root + 'districts.geojson', 'utf8'));
const source = JSON.parse(
  gunzipSync(readFileSync('data/agencies/san-mateo/addresses.json.gz')),
);
const distance = (a, b) =>
  Math.hypot((a.lon - b.lon) * 88000, (a.lat - b.lat) * 111000);
// The most familiar suggestions now lead to different councilmembers.
jokes.forEach((a, i) => {
  a.district = String((i % 5) + 1);
});
for (const feature of map.features) {
  const district = feature.properties.district;
  const candidates = source.filter((a) =>
    booleanPointInPolygon([a.lon, a.lat], feature, { ignoreBoundary: true }),
  );
  if (candidates.length < 13) {
    const ring = feature.geometry.coordinates[0];
    const xs = ring.map((p) => p[0]),
      ys = ring.map((p) => p[1]);
    const bounds = [
      Math.min(...xs),
      Math.min(...ys),
      Math.max(...xs),
      Math.max(...ys),
    ];
    for (let lon = bounds[0] + 0.001; lon < bounds[2]; lon += 0.003)
      for (let lat = bounds[1] + 0.001; lat < bounds[3]; lat += 0.003)
        if (
          booleanPointInPolygon([lon, lat], feature, { ignoreBoundary: true })
        )
          candidates.push({ lon, lat });
  }
  assert.ok(
    candidates.length >= 13,
    `Too few land locations in district ${district}`,
  );
  const center = candidates.reduce(
    (acc, a) => ({
      lon: acc.lon + a.lon / candidates.length,
      lat: acc.lat + a.lat / candidates.length,
    }),
    { lon: 0, lat: 0 },
  );
  candidates.sort((a, b) => distance(a, center) - distance(b, center));
  const selected = [candidates[0]];
  while (selected.length < 13) {
    let best,
      spacing = -1;
    for (const a of candidates) {
      const nearest = Math.min(...selected.map((b) => distance(a, b)));
      if (nearest > spacing) {
        best = a;
        spacing = nearest;
      }
    }
    assert.ok(spacing > 150, `District ${district} locations are too close`);
    selected.push(best);
  }
  const labels = [
    ...jokes.filter((a) => a.district === district),
    ...original.filter((a) => a.id.split('-')[1] === district),
  ];
  labels.forEach((a, i) => {
    a.lon = selected[i].lon;
    a.lat = selected[i].lat;
  });
  console.log(
    `District ${district}: ${labels.length} dispersed fictional addresses`,
  );
}
for (const [file, values] of [
  ['addresses.json', original],
  ['joke-addresses.json', jokes],
])
  writeFileSync(root + file, JSON.stringify(values, null, 2) + '\n');
