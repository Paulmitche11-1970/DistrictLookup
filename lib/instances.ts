import records from '../data/instances.json';
export type AgencyInstance = {
  id: string;
  name: string;
  shortName: string;
  kind: 'city' | 'county' | 'school' | 'college' | 'special';
  seedDirectory: string;
  bounds: number[];
  logo: string;
  slogan?: string;
  addressMode: 'local' | 'pending';
  sampleAddress?: string;
  addressNote?: string;
  previewDirectory?: string;
  sandbox?: boolean;
  districtCount?: number;
  officialCount?: number;
};
export const instances = records as AgencyInstance[];
export function instanceFor(id: string) {
  return instances.find((record) => record.id === id.toLowerCase());
}
export function apiPath(id: string) {
  return id === 'martinez'
    ? '/api'
    : id === 'arpeeville'
      ? '/api/arpeeville'
      : '/api/agencies/' + id;
}
export function adminPath(id: string) {
  return id === 'martinez' ? '/admin' : '/' + id + '/admin';
}
