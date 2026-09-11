import inventory from '../data/boundaries/index.json';

import type { BoundaryAgency, BoundaryDirectoryEntry } from './boundary-model';
export type { BoundaryAgency } from './boundary-model';
export const boundaryAgencies: BoundaryAgency[] = inventory.agencies;
export const boundaryCategories = inventory.categories;
export const boundaryImportDate = inventory.importedAt;
export const boundaryDirectoryEntries: BoundaryDirectoryEntry[] =
  boundaryAgencies.map((a) => ({
    id: a.id === 'midpeninsula-water-district' ? 'midpeninsula-water' : a.id,
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
