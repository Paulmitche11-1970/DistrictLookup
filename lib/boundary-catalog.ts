import inventory from '../data/boundaries/index.json';

import type { BoundaryAgency, BoundaryDirectoryEntry } from './boundary-model';
export type { BoundaryAgency } from './boundary-model';
export const boundaryAgencies: BoundaryAgency[] = inventory.agencies;
export const boundaryCategories = inventory.categories;
export const boundaryImportDate = inventory.importedAt;
const lookupIds: Record<string, string> = {
  'midpeninsula-water-district': 'midpeninsula-water',
  'san-jose-evergreen-community-college-district': 'san-jose-evergreen',
  'barstow-community-college-district': 'barstow-college',
  'placer-union-high-school-district': 'placer-union-high-school',
  'olivenhain-municipal-water-district': 'olivenhain-water',
};
export const boundaryDirectoryEntries: BoundaryDirectoryEntry[] =
  boundaryAgencies.map((a) => ({
    id: lookupIds[a.id] || a.id,
    name: a.name,
    type:
      a.category === 'Community colleges'
        ? 'colleges'
        : a.category === 'Special districts'
          ? 'special'
          : 'schools',
    state: 'CA',
    status: a.mapAvailable ? 'boundaries-imported' : 'source-review',
    boundaryId: a.id,
    boundaryDistrictCount: a.districts.length,
    boundaryNeedsReview: a.status !== 'imported',
  }));
export function boundaryFor(id: string) {
  return boundaryAgencies.find((agency) => agency.id === id);
}
