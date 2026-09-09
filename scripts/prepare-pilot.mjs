import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import shp, { parseShp, parseDbf, combine } from 'shpjs';

const app = path.resolve(import.meta.dirname, '..');
const work = path.resolve(app, '../work');
await mkdir(path.join(app, 'data'), { recursive: true });
await mkdir(path.join(app, 'public/portraits'), { recursive: true });
const base =
  'C:/PDI - Redistricting Dropbox/Redistricting Files/City of Martinez/Final Redistricting Materials/Final Shapefile City of Martinez 2022/City of Martinez Final Map 2022';
const source = combine([
  parseShp(
    await readFile(base + '.shp'),
    await readFile(base + '.prj', 'utf8'),
  ),
  parseDbf(await readFile(base + '.dbf')),
]);
const map = {
  type: 'FeatureCollection',
  features: source.features
    .filter((f) => String(f.properties.DISTRICT || '').trim())
    .map((f) => ({
      type: 'Feature',
      properties: { district: String(f.properties.DISTRICT).trim() },
      geometry: f.geometry,
    })),
};
const roster = JSON.parse(
  await readFile(path.join(work, 'martinez-portraits.json'), 'utf8'),
);
async function download(url, file) {
  try {
    await access(file);
    return;
  } catch {}
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw Error(`${url} ${response.status}`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
}
console.log(
  'Districts',
  map.features.map((f) => f.properties.district).join(','),
);
await Promise.all(
  roster.officials.map(async (p) => {
    const key = String(p.district || 'mayor');
    await download(
      p.portrait_url,
      path.join(app, 'public/portraits', key + '.jpg'),
    );
    console.log('Portrait', p.name);
  }),
);
const officials = roster.officials.map((p) => ({
  id: String(p.district || 'mayor'),
  district: p.district ? String(p.district) : null,
  name: p.name,
  title: p.title,
  email: p.email,
  phone: p.office_phone,
  phoneLabel: 'City Council office',
  website: p.profile_url,
  termEnd: p.term_end,
  photo: `/portraits/${p.district || 'mayor'}.jpg`,
  bio: '',
  staffName: '',
  staffEmail: '',
  staffPhone: '',
  vacant: false,
}));
const seed = {
  agency: {
    name: 'City of Martinez',
    shortName: 'Martinez',
    state: 'California',
    heading: 'Find your councilmember',
    intro:
      'Enter your Martinez street address to find your district and the person who represents you.',
    website: 'https://www.cityofmartinez.org',
    contactEmail: '',
    contactPhone: roster.office_phone,
    accent: '#146b72',
    showMayor: true,
    showPhotos: true,
    showEmail: true,
    showPhone: true,
    showWebsite: true,
    showTerm: true,
    showStaff: false,
  },
  officials,
  map,
  mapName: path.basename(base),
  mapEffectiveDate: '2022-04-06',
  dataReviewedAt: '2026-09-09',
  sourceUrl: roster.source_page_url,
};
await writeFile(
  path.join(app, 'data/seed.json'),
  JSON.stringify(seed, null, 2),
);
await writeFile(path.join(app, 'data/districts.json'), JSON.stringify(map));
const url =
  'https://gis.cccounty.us/Downloads/General%20County%20Data/CCC_DOIT_AddressData.zip';
const addressDir = path.join(work, 'martinez-addresses');
await mkdir(addressDir, { recursive: true });
const archive = path.join(addressDir, 'county-addresses.zip');
console.log('Downloading county address file');
await download(url, archive);
console.log('Reading county address file');
const data = await shp(await readFile(archive));
const sets = Array.isArray(data) ? data : [data];
for (const dataset of sets) {
  console.log(
    'Layer',
    dataset.fileName,
    'features',
    dataset.features.length,
    'sample fields',
    JSON.stringify(dataset.features[0]?.properties),
  );
}
await writeFile(
  path.join(addressDir, 'county-addresses-geo.json'),
  JSON.stringify(sets),
);
await writeFile(
  path.join(app, 'data/provenance.json'),
  JSON.stringify(
    {
      boundarySource: base + '.shp',
      districtField: 'DISTRICT',
      excludedUnassignedRecords: source.features.length - map.features.length,
      roster,
      addressSource: url,
      addressFileDate: '2025-10-31',
      reviewedOn: '2026-09-09',
    },
    null,
    2,
  ),
);
