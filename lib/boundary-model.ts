export type BoundaryAgency = {
  id: string;
  name: string;
  category: string;
  status: string;
  mapAvailable: boolean;
  source: string;
  shapefile: string;
  selectionNote: string;
  districts: string[];
  districtField: string;
  sourceRecords: number;
  excludedRecords: number;
  warnings: string[];
  localRosterCount: number;
  currentAdoptionVerified: boolean;
  sourceCrs?: string;
  bounds?: number[];
  parts?: Partial<Record<string, number>>;
  overlaps?: { districts: string[]; squareMeters: number }[];
  mapSha256?: string;
};
export type BoundaryDirectoryEntry = {
  id: string;
  name: string;
  type: string;
  state: string;
  status: string;
  boundaryId: string;
  boundaryDistrictCount: number;
  boundaryNeedsReview: boolean;
};
export function boundaryStatus(agency: BoundaryAgency) {
  return !agency.mapAvailable
    ? 'Source review needed'
    : agency.status === 'imported-needs-review'
      ? 'Imported · review needed'
      : 'Boundaries imported';
}
