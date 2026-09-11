import type { Agency } from './model';

type AgencyLabelSource = Pick<Agency, 'kind' | 'districtLabel'>;

/** Public terminology comes from the trusted agency instance, shared by every layout. */
export function agencyLabels(agency: AgencyLabelSource = {}) {
  const district = agency.districtLabel || 'District';
  const districtLower = district.toLowerCase();
  const kind = agency.kind || 'city';
  const city = kind === 'city';
  const county = kind === 'county';
  const body = city
    ? 'City Council'
    : county
      ? 'Board of Supervisors'
      : kind === 'special'
        ? 'Board of Directors'
        : 'Governing Board';
  const member = city
    ? 'councilmember'
    : county
      ? 'supervisor'
      : kind === 'special'
        ? 'director'
        : 'board member';
  return {
    district,
    districts: district + 's',
    districtLower,
    districtsLower: districtLower + 's',
    body,
    bodyShort: city ? 'council' : 'board',
    member,
    members: member + 's',
    place: city ? 'city' : county ? 'county' : 'district',
    presentationBody: county ? 'Supervisors' : body,
    presentationDistrict:
      city && district === 'District' ? 'Council District' : district,
  };
}

export function districtName(agency: AgencyLabelSource, id: string) {
  return `${agencyLabels(agency).district} ${id}`;
}

/** Reword design-gallery copy for agencies whose governing body is not a council. */
export function agencyDesignCopy(text: string, agency: AgencyLabelSource) {
  if (!agency.kind || agency.kind === 'city') return text;
  const labels = agencyLabels(agency);
  return text
    .replace(/\bcouncil or board\b/g, 'board')
    .replace(/\bcouncil\b/g, 'board')
    .replace(/\bdistricts\b/g, labels.districtsLower)
    .replace(/\bdistrict\b/g, labels.districtLower)
    .replace(/\bcity\b/g, labels.place);
}
