import type { Agency } from './model';

export type AgencyKind = NonNullable<Agency['kind']>;
export type OfficeTitleOption = {
  label: string;
  kinds: readonly AgencyKind[];
};

// Starter vocabulary, not a closed enum. Preserve the agency's exact title text.
// Official-source examples: docs/office-titles.md.
export const officeTitles: readonly OfficeTitleOption[] = [
  { label: 'Councilmember', kinds: ['city'] },
  { label: 'Council Member', kinds: ['city'] },
  { label: 'Mayor', kinds: ['city'] },
  { label: 'Vice Mayor', kinds: ['city'] },
  { label: 'Deputy Mayor', kinds: ['city'] },
  { label: 'Mayor Pro Tem', kinds: ['city'] },
  { label: 'Supervisor', kinds: ['county'] },
  { label: 'County Supervisor', kinds: ['county'] },
  { label: 'Board Member', kinds: ['school', 'college', 'special'] },
  { label: 'Board of Education Member', kinds: ['school'] },
  { label: 'Trustee', kinds: ['school', 'college', 'special'] },
  { label: 'Director', kinds: ['special'] },
  { label: 'Board Director', kinds: ['special'] },
  { label: 'Commissioner', kinds: ['special'] },
  { label: 'Harbor Commissioner', kinds: ['special'] },
  { label: 'Chair', kinds: ['county', 'school', 'college', 'special'] },
  { label: 'Chairperson', kinds: ['county', 'school', 'college', 'special'] },
  { label: 'Vice Chair', kinds: ['county', 'school', 'college', 'special'] },
  {
    label: 'Vice Chairperson',
    kinds: ['county', 'school', 'college', 'special'],
  },
  { label: 'President', kinds: ['county', 'school', 'college', 'special'] },
  {
    label: 'Board President',
    kinds: ['county', 'school', 'college', 'special'],
  },
  {
    label: 'Vice President',
    kinds: ['county', 'school', 'college', 'special'],
  },
  {
    label: 'Board Vice President',
    kinds: ['county', 'school', 'college', 'special'],
  },
  { label: 'Clerk', kinds: ['school', 'college', 'special'] },
  { label: 'Board Clerk', kinds: ['school', 'college', 'special'] },
  { label: 'Secretary', kinds: ['school', 'college', 'special'] },
  { label: 'Board Secretary', kinds: ['school', 'college', 'special'] },
  { label: 'Treasurer', kinds: ['special'] },
  { label: 'Vice President / Clerk', kinds: ['school', 'college'] },
  { label: 'Secretary / Treasurer', kinds: ['special'] },
];

export const CUSTOM_OFFICE_TITLE = '__custom_office_title__';

export function officeTitleGroups(kind?: AgencyKind) {
  if (!kind) return [{ label: 'Titles', options: officeTitles }];
  return [
    {
      label: 'Common for this agency',
      options: officeTitles.filter((title) => title.kinds.includes(kind)),
    },
    {
      label: 'Other titles',
      options: officeTitles.filter((title) => !title.kinds.includes(kind)),
    },
  ];
}

export function isStandardOfficeTitle(value: string) {
  return officeTitles.some((title) => title.label === value);
}

export function officialTitleParts(official: {
  title: string;
  additionalTitles?: string[];
}) {
  return [
    ...new Set([official.title, ...(official.additionalTitles || [])]),
  ].filter((title) => title.trim().length > 0);
}
