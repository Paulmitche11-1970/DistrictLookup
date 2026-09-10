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
  email: string;
  phone: string;
  phoneLabel: string;
  website: string;
  termEnd: string;
  photo: string;
  bio: string;
  staffName: string;
  staffEmail: string;
  staffPhone: string;
  vacant: boolean;
};
export type Agency = {
  instanceId?: string;
  kind?: 'city' | 'county' | 'school' | 'college' | 'special';
  logo?: string;
  slogan?: string;
  addressMode?: 'local' | 'pending';
  sampleAddress?: string;
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
  showPhotos: boolean;
  showEmail: boolean;
  showPhone: boolean;
  showWebsite: boolean;
  showTerm: boolean;
  showStaff: boolean;
  lookupDesign?: 'classic' | 'concierge' | 'explorer' | 'directory';
};
export type Content = {
  agency: Agency;
  officials: Official[];
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
  return districtColors[id] || '#64748b';
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
