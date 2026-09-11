import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
export type DistrictMap = FeatureCollection<
  Polygon | MultiPolygon,
  { district: string }
>;
export type Official = {
  id: string;
  district: string | null;
  name: string;
  title: string;
  additionalTitles?: string[];
  selectionMethod?: 'elected' | 'appointed';
  email: string;
  phone: string;
  phoneLabel: string;
  website: string;
  termEnd: string;
  photo: string;
  bio: string;
  bioFormat?: 'text' | 'html';
  staffName: string;
  staffEmail: string;
  staffPhone: string;
  vacant: boolean;
};
export type ManagementProfile = {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  phoneLabel?: string;
  website: string;
  photo: string;
  bio: string;
  visible: boolean;
};
export type DistrictElection = {
  status: 'district' | 'transition';
  firstElection?: string;
};
export type DistrictLabel = 'District' | 'Division' | 'Zone' | 'Trustee Area';
export type Agency = {
  instanceId?: string;
  kind?: 'city' | 'county' | 'school' | 'college' | 'special';
  districtLabel?: DistrictLabel;
  logo?: string;
  slogan?: string;
  addressMode?: 'local' | 'pending';
  sampleAddress?: string;
  addressNote?: string;
  sandbox?: boolean;
  name: string;
  shortName: string;
  state: string;
  heading: string;
  intro: string;
  website: string;
  contactEmail: string;
  contactPhone: string;
  accent: string;
  showMayor: boolean;
  showManagement?: boolean;
  showPhotos: boolean;
  showEmail: boolean;
  showPhone: boolean;
  showWebsite: boolean;
  showTerm: boolean;
  showBiographies?: boolean;
  showStaff: boolean;
  lookupDesign?: 'classic' | 'concierge' | 'explorer' | 'directory';
};
export type Content = {
  agency: Agency;
  officials: Official[];
  management?: ManagementProfile[];
  districtElections?: Record<string, DistrictElection>;
  map: DistrictMap;
  mapName: string;
  mapEffectiveDate: string;
  dataReviewedAt: string;
  sourceUrl: string;
};
export type Address = {
  city?: string;
  id: string;
  label: string;
  lon: number;
  lat: number;
  district?: string;
  zip?: string;
};
export const districtColors: Record<string, string> = {
  '1': '#2a808b',
  '2': '#c68b35',
  '3': '#7972b6',
  '4': '#4f91c9',
  '5': '#b06580',
};
export function colorFor(id: string) {
  if (districtColors[id]) return districtColors[id];
  const palette = [
    '#2a808b',
    '#c68b35',
    '#7972b6',
    '#4f91c9',
    '#b06580',
    '#658a45',
    '#b7653f',
    '#517c99',
    '#956696',
    '#84783c',
  ];
  // Preserve existing 1–5 colors and support lettered and larger district plans.
  const suffix = id.toUpperCase().match(/(?:^|\D)(\d+)$|([A-Z])$/);
  const index = suffix?.[1]
    ? Number(suffix[1]) - 1
    : suffix?.[2]
      ? suffix[2].charCodeAt(0) - 65
      : -1;
  return index >= 0 ? palette[index % palette.length] : '#64748b';
}
export function phoneHref(value: string) {
  const match = value.match(
    /^(.*?)(?:\s*(?:ext\.?|extension|x|#)\s*(\d+))?\s*$/i,
  );
  const number = (match?.[1] || value).replace(/[^+0-9]/g, '');
  return 'tel:' + number + (match?.[2] ? ';ext=' + match[2] : '');
}
export function termLabel(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value + '-01T12:00:00Z'));
}

export function fullAddress(address: Address) {
  return `${address.label}, ${address.city || 'Martinez'}, California${address.zip ? ` ${address.zip}` : ''}`;
}
export function lookupIntro(agency: Agency) {
  if (agency.sandbox && /fictional|test address/i.test(agency.intro))
    return 'Enter your street address to find your district and connect with your councilmember.';
  return agency.intro.replace(
    'Enter your Martinez street address to find your district',
    'Enter your street address to find your council district',
  );
}
