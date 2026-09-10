import type { Content, Official } from './model';

export function titlesFor(official: Official) {
  return [
    ...new Set(
      [official.title, ...(official.additionalTitles || [])].filter(Boolean),
    ),
  ];
}
export function hasTitle(official: Official, title: string) {
  return titlesFor(official).some(
    (t) => t.toLowerCase() === title.toLowerCase(),
  );
}
export function titleLabel(official: Official) {
  return titlesFor(official).join(' · ');
}
export function constituencyLabel(official: Official) {
  return official.district !== null
    ? 'District ' + official.district
    : official.selectionMethod === 'appointed'
      ? 'At Large · Appointed'
      : official.selectionMethod === 'elected'
        ? 'Elected At Large'
        : 'At Large';
}
export function visibleOfficial(content: Content, official: Official) {
  return (
    official.district !== null ||
    content.agency.showMayor ||
    !hasTitle(official, 'Mayor')
  );
}
export function atLargeOfficials(content: Content) {
  return content.officials
    .filter(
      (o) => o.district === null && !o.vacant && visibleOfficial(content, o),
    )
    .sort(
      (a, b) => Number(hasTitle(b, 'Mayor')) - Number(hasTitle(a, 'Mayor')),
    );
}
export function districtOfficial(content: Content, district: string | null) {
  if (
    !district ||
    content.districtElections?.[district]?.status === 'transition'
  )
    return undefined;
  return content.officials.find((o) => o.district === district);
}
export function representativesFor(content: Content, district: string) {
  const official = districtOfficial(content, district);
  return [
    ...(official && !official.vacant ? [official] : []),
    ...atLargeOfficials(content),
  ];
}
export function validateRepresentation(content: Content) {
  const districts = new Set(
    content.map.features.map((f) => f.properties.district),
  );
  const officialIds = new Set<string>();
  for (const official of content.officials) {
    if (officialIds.has(official.id))
      throw Error('Each official needs a unique identifier.');
    officialIds.add(official.id);
    if (official.district !== null && !districts.has(official.district))
      throw Error('An official is assigned to a district outside this map.');
  }
  for (const district of Object.keys(content.districtElections || {})) {
    if (!districts.has(district))
      throw Error('Election settings include a district outside this map.');
  }
  for (const district of districts) {
    const seats = content.officials.filter((o) => o.district === district);
    if (content.districtElections?.[district]?.status === 'transition') {
      if (seats.length > 1 || seats.some((o) => !o.vacant))
        throw Error(
          'A transitioning district cannot already have an occupied district seat. Keep continuing officials at large until the district term begins.',
        );
      if (!content.officials.some((o) => o.district === null && !o.vacant))
        throw Error(
          'Add the continuing at-large representatives before marking a district as transitioning.',
        );
    } else if (seats.length !== 1) {
      throw Error(
        'Each active district needs one official record or a marked vacancy.',
      );
    }
  }
}
